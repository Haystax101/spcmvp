import { GoogleGenAI } from '@google/genai';
import { QdrantClient } from '@qdrant/js-client-rest';
import crypto from 'crypto';
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "https://353d6976441e378c1fadef50b50a725c@o4510971097317376.ingest.de.sentry.io/4511229967990864",
  tracesSampleRate: 1.0,
});

const COLLECTION = 'profiles';

// Same deterministic UUID function as profileSync
function getQdrantId(appwriteId) {
  const hash = crypto.createHash('md5').update(appwriteId).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    `4${hash.substring(13, 16)}`,
    `8${hash.substring(17, 20)}`,
    hash.substring(20, 32)
  ].join('-');
}

// Late-fusion: merge intent + semantic results with 40/60 weighting
function fuseResults(intentMatches, semanticMatches, excludeId) {
  const map = new Map();

  semanticMatches.forEach(m => {
    if (m.id === excludeId) return;
    map.set(m.id, {
      payload: m.payload,
      semantic_score: m.score,
      intent_score: 0,
      score: m.score * 0.6
    });
  });

  intentMatches.forEach(m => {
    if (m.id === excludeId) return;
    if (map.has(m.id)) {
      const entry = map.get(m.id);
      entry.intent_score = m.score;
      entry.score = (entry.semantic_score * 0.6) + (m.score * 0.4);
    } else {
      map.set(m.id, {
        payload: m.payload,
        semantic_score: 0,
        intent_score: m.score,
        score: m.score * 0.4
      });
    }
  });

  return Array.from(map.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(m => ({
      ...m.payload,
      score: Math.round(m.score * 100),
      semantic_pct: Math.round(m.semantic_score * 100),
      intent_pct: Math.round(m.intent_score * 100),
    }));
}

export default async ({ req, res, log, error }) => {
  const qdrant = new QdrantClient({
    url: process.env.QDRANT_ENDPOINT,
    apiKey: process.env.QDRANT_API_KEY,
  });

  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { action } = body;

    // ─── RECOMMEND: find matches based on the user's own vectors ───────────────
    if (action === 'recommend') {
      const { docId } = body;
      if (!docId) return res.json({ error: 'docId is required for recommend.' }, 400);

      const qdrantId = getQdrantId(docId);
      log(`Recommend for Qdrant ID: ${qdrantId}`);

      // Safeguard: check the point exists
      const existing = await qdrant.retrieve(COLLECTION, {
        ids: [qdrantId],
        with_payload: false,
        with_vector: false
      });

      if (!existing || existing.length === 0) {
        return res.json({ error: 'Profile not yet indexed. Please wait.' }, 404);
      }

      const [intentRes, semanticRes] = await Promise.all([
        qdrant.recommend(COLLECTION, {
          positive: [qdrantId],
          using: 'intent',
          limit: 10,
          with_payload: true,
        }),
        qdrant.recommend(COLLECTION, {
          positive: [qdrantId],
          using: 'semantic',
          limit: 10,
          with_payload: true,
        }),
      ]);

      const matches = fuseResults(intentRes, semanticRes, qdrantId);
      log(`Returning ${matches.length} matches`);
      return res.json({ matches });
    }

    // ─── SEARCH: find people matching a free-text query ─────────────────────
    if (action === 'search') {
      const { query } = body;
      if (!query || query.trim().length < 2) {
        return res.json({ matches: [] });
      }

      log(`Searching for: "${query}"`);

      const embeddingResult = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: query,
        config: { outputDimensionality: 1536 }
      });
      const queryVector = embeddingResult.embeddings[0].values.slice(0, 1536);

      const results = await qdrant.search(COLLECTION, {
        vector: { name: 'semantic', vector: queryVector },
        limit: 8,
        with_payload: true,
        score_threshold: 0.3, // filter out very weak matches
      });

      const matches = results.map(r => ({
        ...r.payload,
        score: Math.round(r.score * 100),
        semantic_pct: Math.round(r.score * 100),
        intent_pct: 0,
      }));

      log(`Search returned ${matches.length} results`);
      return res.json({ matches });
    }

    return res.json({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    error('Discovery Engine Error: ' + err.message);
    if (err.stack) error(err.stack);
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return res.json({ error: err.message }, 500);
  }
};
