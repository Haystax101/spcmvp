import { Client, TablesDB } from 'node-appwrite';
import { GoogleGenAI } from '@google/genai';
import { QdrantClient } from '@qdrant/js-client-rest';
import crypto from 'crypto';
import * as Sentry from "@sentry/node";
import { PostHog } from 'posthog-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN || "https://353d6976441e378c1fadef50b50a725c@o4510971097317376.ingest.de.sentry.io/4511229967990864",
  enableLogs: true,
  sendDefaultPii: true,
  tracesSampleRate: 1.0,
});

// ── Deterministic UUID from Appwrite document ID ────────────────────────────
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

// ── Build a rich intent string from the goals + desired connection types ─────
function buildIntentString(profile) {
  const parts = [];

  if (profile.goals?.length) {
    parts.push(`I am here to: ${profile.goals.join(', ')}.`);
  }
  if (profile.desired_connections?.length) {
    parts.push(`I am looking for: ${profile.desired_connections.join(', ')}.`);
  }
  if (profile.career_field) {
    parts.push(`My career field is ${profile.career_field}.`);
  }
  if (profile.networking_style) {
    parts.push(`My networking style: ${profile.networking_style}.`);
  }
  if (profile.work_style) {
    parts.push(`I work best: ${profile.work_style}.`);
  }
  if (profile.project_stage) {
    parts.push(`Project stage: ${profile.project_stage}.`);
  }
  if (profile.relationship_intent) {
    parts.push(`Relationship intent: ${profile.relationship_intent}.`);
  }

  return parts.join(' ') || 'Looking to meet interesting people at Oxford.';
}

// ── Build a rich semantic string covering personality + experience ───────────
function buildSemanticString(profile) {
  const parts = [];

  if (profile.honest_thing) {
    parts.push(`The one thing most people don't realise about me is: ${profile.honest_thing}.`);
  }
  if (profile.wish_studied) {
    parts.push(`If I could study anything else it would be: ${profile.wish_studied}.`);
  }
  if (profile.intellectual_identity) {
    parts.push(`Intellectually I am: ${profile.intellectual_identity}.`);
  }
  if (profile.friendship_values?.length) {
    parts.push(`I value in friends: ${profile.friendship_values.join(', ')}.`);
  }
  if (profile.social_circles?.length) {
    parts.push(`My Oxford social life includes: ${profile.social_circles.join(', ')}.`);
  }
  if (profile.cv_parsed_text) {
    // Truncate CV to ~2000 chars to stay well within embedding token limits
    parts.push(profile.cv_parsed_text.substring(0, 2000));
  }
  if (profile.first_name || profile.college) {
    const who = [profile.first_name, profile.college ? `at ${profile.college}` : ''].filter(Boolean).join(' ');
    parts.push(`Student: ${who}.`);
  }

  return parts.join(' ') || 'Student at Oxford University.';
}

// ── Encode intellectual identity to a numeric slot ──────────────────────────
const INTELLECT_MAP = {
  'Deep specialist — I go very far in one thing': 0,
  'Generalist — I connect ideas across fields': 1,
  'Contrarian — I question received wisdom': 2,
  'Practitioner — I care about what works': 3,
  'Explorer — I follow curiosity wherever it leads': 4,
};

function buildTraitsVector(profile) {
  // Slot 0: social_energy (0–4)
  // Slot 1: intellectual_identity (0–4, encoded above)
  // Slots 2+: zeros (reserved for future trait dimensions)
  const socialEnergy = typeof profile.social_energy === 'number' ? profile.social_energy : 2;
  const intellectIdx = INTELLECT_MAP[profile.intellectual_identity] ?? 2;

  return [
    socialEnergy / 4,       // normalise to 0–1
    intellectIdx / 4,       // normalise to 0–1
    0, 0, 0                 // reserved
  ].concat(Array(1531).fill(0));
}

// ── Main export ──────────────────────────────────────────────────────────────
export default async ({ req, res, log, error }) => {
  const posthogKey = process.env.POSTHOG_KEY;
  const posthog = posthogKey
    ? new PostHog(posthogKey, { host: process.env.POSTHOG_HOST || 'https://app.posthog.com' })
    : null;

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

    // ── Handle DELETE ────────────────────────────────────────────────────────
    if (event.includes('.delete')) {
      const qdrantId = generateUuidFromId(profile.$id);
      log(`Deleting Qdrant point for Document ID: ${profile.$id} (Qdrant ID: ${qdrantId})`);
      await qdrant.delete('profiles', { points: [qdrantId] });
      return res.json({ success: true, message: "Deletion sync complete." });
    }

    if (!profile || !profile.$id || !profile.user_id) {
      return res.json({ success: true, message: "Skipped - no valid payload" });
    }

    if (profile.is_onboarding_complete === false) {
      log(`Skipped sync for incomplete onboarding: ${profile.user_id}`);
      return res.json({ success: true, message: "Onboarding not complete." });
    }

    // ── CRITICAL GUARD: skip endless loop on is_indexed update ──────────────
    if (event.includes('.update') && profile.is_indexed === true && !profile.cv_indexed) {
      log(`Skipped re-sync for already-indexed profile (non-CV update): ${profile.user_id}`);
      return res.json({ success: true, message: "Skipped - already indexed." });
    }

    log(`Syncing profile for User ID: ${profile.user_id}`);

    const intentString   = buildIntentString(profile);
    const semanticString = buildSemanticString(profile);
    const traitsVector   = buildTraitsVector(profile);

    log(`Intent:   "${intentString.substring(0, 80)}..."`);
    log(`Semantic: "${semanticString.substring(0, 80)}..."`);

    // ── Embed both vectors in parallel ──────────────────────────────────────
    const [intentResult, semanticResult] = await Promise.all([
      ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: intentString,
        config: { outputDimensionality: 1536 }
      }),
      ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: semanticString,
        config: { outputDimensionality: 1536 }
      }),
    ]);

    const intentVector   = intentResult.embeddings[0].values.slice(0, 1536);
    const semanticVector = semanticResult.embeddings[0].values.slice(0, 1536);

    log("Embeddings generated (1536 dims each). Upserting to Qdrant...");

    // ── Upsert into Qdrant with enriched payload ─────────────────────────────
    await qdrant.upsert('profiles', {
      wait: true,
      points: [{
        id: generateUuidFromId(profile.$id),
        vectors: {
          intent:   intentVector,
          semantic: semanticVector,
          traits:   traitsVector,
        },
        payload: {
          // Core identity
          user_id:    profile.user_id,
          first_name: profile.first_name  || "",
          last_name:  profile.last_name   || "",
          college:    profile.college     || "",
          email:      profile.email       || "",

          // Professional / goals
          goals:               profile.goals               || [],
          career_field:        profile.career_field        || "",
          desired_connections: profile.desired_connections || [],
          networking_style:    profile.networking_style    || "",
          work_style:          profile.work_style          || "",
          project_stage:       profile.project_stage       || "",
          relationship_intent: profile.relationship_intent || "",

          // Personality / social
          social_energy:          profile.social_energy          ?? 2,
          intellectual_identity:  profile.intellectual_identity  || "",
          social_circles:         profile.social_circles         || [],
          friendship_values:      profile.friendship_values      || [],
          wish_studied:           profile.wish_studied           || "",
          honest_thing:           profile.honest_thing           || "",

          // Derived / utility
          has_cv: !!profile.cv_file_id,
        }
      }]
    });

    log("Qdrant upsert complete. Updating Appwrite is_indexed...");

    await tables.updateRow({
      databaseId: 'supercharged',
      tableId:    'profiles',
      rowId:      profile.$id,
      data: { is_indexed: true, last_scanned_at: new Date().toISOString() }
    });
    log("Updated Appwrite Row is_indexed = true");

    if (posthog) {
      posthog.capture({
        distinctId: profile.user_id,
        event:      'Profile Synchronized',
        properties: {
          college:     profile.college,
          goals:       profile.goals,
          has_cv:      !!profile.cv_file_id,
          career_field: profile.career_field,
        }
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
