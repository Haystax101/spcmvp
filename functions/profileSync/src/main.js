import { Client, TablesDB } from 'node-appwrite';
import { GoogleGenAI } from '@google/genai';
import { QdrantClient } from '@qdrant/js-client-rest';
import crypto from 'crypto';
import * as Sentry from "@sentry/node";
import { PostHog } from 'posthog-node';

// Sentry Initialization (Global Scope - runs once when function container starts)
Sentry.init({
  dsn: process.env.SENTRY_DSN || "https://353d6976441e378c1fadef50b50a725c@o4510971097317376.ingest.de.sentry.io/4511229967990864",
  enableLogs: true, 
  sendDefaultPii: true,
  tracesSampleRate: 1.0, 
});

function generateUuidFromId(id) {
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    `4${hash.substring(13, 16)}`,
    `8${hash.substring(17, 20)}`,
    hash.substring(20, 32)
  ].join('-');
}

export default async ({ req, res, log, error }) => {
  const posthogKey = process.env.POSTHOG_KEY;
  const posthog = posthogKey ? new PostHog(posthogKey, { host: process.env.POSTHOG_HOST || 'https://app.posthog.com' }) : null;

  log("Profile Sync Triggered!");

  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
  const qdrant = new QdrantClient({
    url: process.env.QDRANT_ENDPOINT,
    apiKey: process.env.QDRANT_API_KEY,
  });

  const endpoint = process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';

  const appwrite = new Client()
    .setEndpoint(endpoint)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const tables = new TablesDB(appwrite);

  try {
    const profile = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const event = req.headers['x-appwrite-event'] || "";

    if (profile?.user_id) {
      Sentry.setUser({ id: profile.user_id });
    }

    if (event.includes('.delete')) {
      const qdrantId = generateUuidFromId(profile.$id);
      log(`Deleting profile for Document ID: ${profile.$id} (Qdrant ID: ${qdrantId})`);
      await qdrant.delete('profiles', { points: [qdrantId] });
      return res.json({ success: true, message: "Deletion sync complete." });
    }

    if (!profile || !profile.$id || !profile.user_id) {
      return res.json({ success: true, message: "Skipped - no valid payload" });
    }

    // ── CRITICAL GUARD: Skip if this is an update event and profile is already
    // indexed. Without this, updating is_indexed=true fires another update event,
    // causing an infinite embedding loop and unnecessary API calls.
    if (event.includes('.update') && profile.is_indexed === true) {
      log(`Skipped re-sync for already-indexed profile: ${profile.user_id}`);
      return res.json({ success: true, message: "Skipped - already indexed." });
    }

    log(`Syncing profile for User ID: ${profile.user_id}`);

    const intentResult = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: profile.primary_intent || "Looking to meet people",
      config: { outputDimensionality: 1536 }
    });
    const intentVector = intentResult.embeddings[0].values.slice(0, 1536);

    const semanticResult = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: profile.free_text_responses || "Student at Oxford",
      config: { outputDimensionality: 1536 }
    });
    const semanticVector = semanticResult.embeddings[0].values.slice(0, 1536);

    log("Embeddings generated (1536 dimensions). Upserting...");

    await qdrant.upsert('profiles', {
      wait: true,
      points: [{
        id: generateUuidFromId(profile.$id),
        vectors: {
          intent: intentVector,
          semantic: semanticVector,
          traits: [profile.social_energy || 3, 0, 0, 0, 0].concat(Array(1531).fill(0))
        },
        payload: {
          user_id: profile.user_id,
          full_name: profile.full_name || "",
          college: profile.college || "",
          course: profile.course || "",
          stage: profile.stage || "",
          social_energy: profile.social_energy || 3,
          primary_intent: profile.primary_intent || ""
        }
      }]
    });

    log(`Successfully upserted into Qdrant! Now updating Appwrite status...`);

    await tables.updateRow({
      databaseId: 'supercharged',
      tableId: 'profiles',
      rowId: profile.$id,
      data: { is_indexed: true, last_scanned_at: new Date().toISOString() }
    });
    log("Updated Appwrite Row is_indexed = true");

    if (posthog) {
      posthog.capture({
        distinctId: profile.user_id,
        event: 'Profile Synchronized',
        properties: { college: profile.college, stage: profile.stage }
      });
      await posthog.shutdown();
    }

    return res.json({ success: true, message: "Sync complete." });

  } catch (err) {
    error("=== PROFILE SYNC ERROR ===");
    error("Message: " + err.message);

    if (err.data) error("Detail Data: " + JSON.stringify(err.data));
    
    Sentry.captureException(err);
    await Sentry.flush(2000);

    return res.json({ success: false, error: err.message }, 500);
  }
};

