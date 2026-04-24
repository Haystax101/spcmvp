import { Client, TablesDB, ID, Query } from 'node-appwrite';
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

  if (profile.primary_intent) {
    parts.push(`My primary intent is ${profile.primary_intent}.`);
  }
  if (profile.goals?.length) {
    parts.push(`I am here to: ${profile.goals.join(', ')}.`);
  }
  if (profile.desired_connections?.length) {
    parts.push(`I am looking for: ${profile.desired_connections.join(', ')}.`);
  }
  if (profile.career_field) {
    parts.push(`My career field is ${profile.career_field}.`);
  }
  if (profile.career_subfield) {
    parts.push(`Career subfield: ${profile.career_subfield}.`);
  }
  if (profile.networking_style) {
    parts.push(`My networking style: ${profile.networking_style}.`);
  }
  if (profile.startup_connections?.length) {
    parts.push(`Startup connections I want: ${profile.startup_connections.join(', ')}.`);
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
  if (profile.relationship_status) {
    parts.push(`Relationship status: ${profile.relationship_status}.`);
  }
  if (profile.study_subject) {
    parts.push(`I study ${profile.study_subject}.`);
  }
  if (profile.year_of_study) {
    parts.push(`Year of study: ${profile.year_of_study}.`);
  }

  return parts.join(' ') || 'Looking to meet interesting people at Oxford.';
}

// ── Build a rich semantic string covering personality + experience ───────────
function buildSemanticString(profile) {
  const parts = [];

  if (profile.study_subject) {
    parts.push(`Study subject: ${profile.study_subject}.`);
  }
  if (profile.year_of_study) {
    parts.push(`Study year: ${profile.year_of_study}.`);
  }
  if (profile.honest_thing) {
    parts.push(`The one thing most people don't realise about me is: ${profile.honest_thing}.`);
  }
  if (profile.wish_studied) {
    parts.push(`If I could study anything else it would be: ${profile.wish_studied}.`);
  }
  if (profile.intellectual_identity) {
    parts.push(`Intellectually I am: ${profile.intellectual_identity}.`);
  }
  if (profile.intellectual_venue) {
    parts.push(`My best intellectual conversations happen in: ${profile.intellectual_venue}.`);
  }
  if (profile.intellectual_ambition) {
    parts.push(`My intellectual ambition: ${profile.intellectual_ambition}.`);
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
  if (profile.building_description) {
    parts.push(`What I am building: ${profile.building_description.substring(0, 400)}.`);
  }
  if (profile.study_wish) {
    parts.push(`I also wish I had studied: ${profile.study_wish}.`);
  }
  if (profile.hobby) {
    parts.push(`Hobbies: ${profile.hobby}.`);
  }
  if (profile.music) {
    parts.push(`Music taste: ${profile.music}.`);
  }
  if (profile.societies) {
    parts.push(`Societies or groups: ${profile.societies}.`);
  }
  if (profile.dating_personality?.length) {
    parts.push(`Dating personality preferences: ${profile.dating_personality.join(', ')}.`);
  }
  if (profile.dating_hobbies?.length) {
    parts.push(`Dating activity preferences: ${profile.dating_hobbies.join(', ')}.`);
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

    // ── Generate referral code if missing (runs on every sync, even pre-onboarding) ──
    if (!profile.referral_code) {
      const base = (profile.username || profile.first_name || '').slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, '') || crypto.randomBytes(3).toString('hex');
      const code = base || crypto.randomBytes(4).toString('hex');
      try {
        await tables.updateRow({
          databaseId: 'supercharged', tableId: 'profiles', rowId: profile.$id,
          data: { referral_code: code }
        });
        profile.referral_code = code;
        log(`Generated referral_code: ${code}`);
      } catch (refErr) {
        if (/unique/i.test(refErr.message)) {
          const uniqueCode = code + crypto.randomBytes(2).toString('hex');
          await tables.updateRow({
            databaseId: 'supercharged', tableId: 'profiles', rowId: profile.$id,
            data: { referral_code: uniqueCode }
          });
          profile.referral_code = uniqueCode;
          log(`Generated unique referral_code: ${uniqueCode}`);
        } else {
          log(`referral_code generation failed (non-fatal): ${refErr.message}`);
          Sentry.captureException(refErr, {
            tags: { context: 'referral_code_generation', userId: profile.user_id },
            level: 'warning'
          });
        }
      }
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
          full_name:  profile.full_name   || "",
          first_name: profile.first_name  || "",
          last_name:  profile.last_name   || "",
          username:   profile.username    || "",
          college:    profile.college     || "",
          email:      profile.email       || "",
          primary_intent: profile.primary_intent || "",
          study_subject: profile.study_subject || "",
          year_of_study: profile.year_of_study || "",

          // Professional / goals
          goals:               profile.goals               || [],
          career_field:        profile.career_field        || "",
          career_subfield:     profile.career_subfield     || "",
          building_description: profile.building_description || "",
          desired_connections: profile.desired_connections || [],
          startup_connections: profile.startup_connections || [],
          networking_style:    profile.networking_style    || "",
          work_style:          profile.work_style          || "",
          project_stage:       profile.project_stage       || "",
          relationship_intent: profile.relationship_intent || "",
          relationship_status: profile.relationship_status || "",
          sexuality:           profile.sexuality || "",
          dating_appearance:   profile.dating_appearance || [],
          dating_personality:  profile.dating_personality || [],
          dating_hobbies:      profile.dating_hobbies || [],

          // Personality / social
          social_energy:          profile.social_energy          ?? 2,
          intellectual_identity:  profile.intellectual_identity  || "",
          intellectual_venue:     profile.intellectual_venue     || "",
          intellectual_ambition:  profile.intellectual_ambition  || "",
          social_circles:         profile.social_circles         || [],
          friendship_values:      profile.friendship_values      || [],
          wish_studied:           profile.wish_studied           || "",
          study_wish:             profile.study_wish             || "",
          honest_thing:           profile.honest_thing           || "",
          hobby:                  profile.hobby                  || "",
          music:                  profile.music                  || "",
          societies:              profile.societies              || "",

          // Photos
          photo_file_ids: Array.isArray(profile.photo_file_ids) ? profile.photo_file_ids : [],

          // Derived / utility
          has_cv: !!profile.cv_file_id,
          payload_version: 2,
        }
      }]
    });

    log("Qdrant upsert complete. Updating Appwrite is_indexed...");

    // ── Award referral bonus on first successful sync (if referred) ───────────
    if (profile.referred_by_code && !profile.referral_bonus_awarded) {
      try {
        const referrerResult = await tables.listRows({
          databaseId: 'supercharged', tableId: 'profiles',
          queries: [Query.equal('referral_code', [profile.referred_by_code]), Query.limit(1)]
        });
        const referrer = referrerResult.rows?.[0];
        if (referrer) {
          const BONUS = 100;
          const now = new Date().toISOString();
          await Promise.all([
            tables.updateRow({ databaseId: 'supercharged', tableId: 'profiles', rowId: profile.$id,
              data: { current_voltz: (profile.current_voltz || 0) + BONUS } }),
            tables.updateRow({ databaseId: 'supercharged', tableId: 'profiles', rowId: referrer.$id,
              data: { current_voltz: (referrer.current_voltz || 0) + BONUS } }),
          ]);
          const newProfileName = profile.first_name || profile.username || 'Someone';
          await Promise.all([
            tables.createRow({ databaseId: 'supercharged', tableId: 'voltz_ledger', rowId: ID.unique(),
              data: { profile_row_id: profile.$id, event_type: 'referral_bonus', amount: BONUS,
                reason: 'Referral bonus — joined via referral link', awarded_at: now } }),
            tables.createRow({ databaseId: 'supercharged', tableId: 'voltz_ledger', rowId: ID.unique(),
              data: { profile_row_id: referrer.$id, event_type: 'referral_bonus', amount: BONUS,
                reason: `Referral bonus — ${newProfileName} joined using your link`, awarded_at: now } }),
          ]);
          await tables.updateRow({ databaseId: 'supercharged', tableId: 'profiles', rowId: profile.$id,
            data: { referral_bonus_awarded: true } });
          log(`Referral bonus awarded: ${BONUS} voltz each to ${profile.user_id} and ${referrer.user_id}`);
        } else {
          log(`Referral code ${profile.referred_by_code} not found — bonus skipped`);
        }
      } catch (bonusErr) {
        log(`Referral bonus failed (non-fatal): ${bonusErr.message}`);
        Sentry.captureException(bonusErr, {
          tags: { context: 'referral_bonus_award', userId: profile.user_id },
          extra: { referredByCode: profile.referred_by_code }
        });
      }
    }

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
