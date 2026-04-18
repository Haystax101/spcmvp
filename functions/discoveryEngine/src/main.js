import { GoogleGenAI } from '@google/genai';
import { QdrantClient } from '@qdrant/js-client-rest';
import crypto from 'crypto';
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "https://353d6976441e378c1fadef50b50a725c@o4510971097317376.ingest.de.sentry.io/4511229967990864",
  tracesSampleRate: 1.0,
});

const COLLECTION = 'profiles';
const SEMANTIC_WEIGHT = 0.6;
const INTENT_WEIGHT = 0.4;

const SEARCH_VARIANTS = new Set([
  'semantic_only',
  'intent_only',
  'hybrid_unfiltered',
  'hybrid_filtered',
]);

const OXFORD_COLLEGES = [
  'All Souls',
  'Balliol',
  'Brasenose',
  'Christ Church',
  'Corpus Christi',
  'Exeter',
  'Green Templeton',
  'Harris Manchester',
  'Hertford',
  'Jesus',
  'Keble',
  'Kellogg',
  'Lady Margaret Hall',
  'Linacre',
  'Lincoln',
  'Magdalen',
  'Mansfield',
  'Merton',
  'New College',
  'Nuffield',
  'Oriel',
  'Pembroke',
  "Queen's",
  'Reuben',
  "Regent's Park",
  'Somerville',
  "St Anne's",
  "St Antony's",
  "St Catherine's",
  'St Cross',
  'St Edmund Hall',
  "St Hilda's",
  "St Hugh's",
  "St John's",
  "St Peter's",
  'Trinity',
  'University',
  'Wadham',
  'Wolfson',
  'Worcester',
  'Wycliffe Hall',
];

const ALLOWED_FILTER_KEYS = new Set([
  'college',
  'primary_intent',
  'year_of_study',
  'study_subject',
  'career_field',
  'career_subfield',
  'relationship_intent',
  'networking_style',
  'intellectual_venue',
  'relationship_status',
  'sexuality',
  'has_cv',
  'goals',
  'desired_connections',
  'startup_connections',
  'social_circles',
  'friendship_values',
  'dating_appearance',
  'dating_personality',
  'dating_hobbies',
]);

const ARRAY_FILTER_KEYS = new Set([
  'goals',
  'desired_connections',
  'startup_connections',
  'social_circles',
  'friendship_values',
  'dating_appearance',
  'dating_personality',
  'dating_hobbies',
]);

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'their', 'about', 'would', 'could', 'should',
  'people', 'student', 'students', 'oxford', 'university', 'looking', 'find', 'search', 'someone', 'want',
  'like', 'near', 'best', 'more', 'less', 'have', 'has', 'been', 'were', 'are', 'who', 'what', 'where', 'when',
]);

const INTENT_SYNONYMS = {
  professional: 'professional',
  career: 'professional',
  work: 'professional',
  startup: 'professional',
  social: 'social',
  friendship: 'social',
  friends: 'social',
  romantic: 'romantic',
  dating: 'romantic',
  relationship: 'romantic',
  academic: 'academic',
  research: 'academic',
  study: 'academic',
  intellectual: 'academic',
};

const YEAR_SYNONYMS = {
  'first year': 'First year',
  '1st year': 'First year',
  'freshers': 'First year',
  'second year': 'Second year',
  '2nd year': 'Second year',
  'third year': 'Third year',
  '3rd year': 'Third year',
  'fourth year': 'Fourth year or above',
  '4th year': 'Fourth year or above',
  'final year': 'Fourth year or above',
  postgraduate: 'Postgraduate',
  grad: 'Postgraduate',
  masters: 'Postgraduate',
  phd: 'Postgraduate',
};

const QUERY_TRANSLATION_SYSTEM_PROMPT = `
You are a query translator for an Oxford student discovery engine.
Convert a natural-language search query into strict JSON for hybrid retrieval.

Return JSON only with this schema:
{
  "semantic_query": "string",
  "intent_query": "string",
  "filters": {
    "college": "string",
    "primary_intent": "professional|social|romantic|academic",
    "year_of_study": "string",
    "study_subject": "string",
    "career_field": "string",
    "career_subfield": "string",
    "relationship_intent": "string",
    "networking_style": "string",
    "intellectual_venue": "string",
    "relationship_status": "string",
    "sexuality": "string",
    "has_cv": true,
    "goals": ["string"],
    "desired_connections": ["string"],
    "startup_connections": ["string"],
    "social_circles": ["string"],
    "friendship_values": ["string"],
    "dating_appearance": ["string"],
    "dating_personality": ["string"],
    "dating_hobbies": ["string"]
  },
  "must_not": {
    "college": "string",
    "primary_intent": "professional|social|romantic|academic"
  }
}

Rules:
- Keep "semantic_query" focused on abstract meaning and interests.
- Keep "intent_query" focused on goals, connection intent, and practical intent.
- Extract only explicit constraints from the query into filters.
- If a field is not present in query, omit it.
- Do not invent people, names, or unsupported fields.
`;

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCollege(value) {
  const raw = normalizeString(value);
  if (!raw) return '';

  const lower = raw.toLowerCase().replace(/\s+college$/, '').trim();
  const exact = OXFORD_COLLEGES.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;

  const fuzzy = OXFORD_COLLEGES.find((c) => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()));
  return fuzzy || raw;
}

function normalizePrimaryIntent(value) {
  const raw = normalizeString(value).toLowerCase();
  return INTENT_SYNONYMS[raw] || '';
}

function normalizeYearOfStudy(value) {
  const raw = normalizeString(value).toLowerCase();
  if (!raw) return '';
  return YEAR_SYNONYMS[raw] || normalizeString(value);
}

function toBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
  }
  return null;
}

function normalizeFilterValue(key, value) {
  if (value === undefined || value === null) return null;

  if (key === 'has_cv') {
    return toBool(value);
  }

  if (key === 'primary_intent') {
    const normalized = normalizePrimaryIntent(value);
    return normalized || null;
  }

  if (key === 'college') {
    const normalized = normalizeCollege(value);
    return normalized || null;
  }

  if (key === 'year_of_study') {
    const normalized = normalizeYearOfStudy(value);
    return normalized || null;
  }

  if (ARRAY_FILTER_KEYS.has(key)) {
    const arr = Array.isArray(value) ? value : [value];
    const cleaned = arr
      .map((entry) => normalizeString(entry))
      .filter((entry) => entry.length > 0)
      .slice(0, 5);
    return cleaned.length > 0 ? cleaned : null;
  }

  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeFilters(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const cleaned = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!ALLOWED_FILTER_KEYS.has(key)) continue;
    const normalized = normalizeFilterValue(key, value);
    if (normalized === null) continue;
    cleaned[key] = normalized;
  }

  return cleaned;
}

function safeParseJson(text) {
  if (!text || typeof text !== 'string') return null;

  try {
    return JSON.parse(text);
  } catch {
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        return null;
      }
    }
  }

  return null;
}

async function translateSearchQuery(query, ai, log) {
  const fallback = {
    semantic_query: query,
    intent_query: query,
    filters: {},
    must_not: {},
    translator: 'fallback',
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: query }] }],
      config: {
        systemInstruction: QUERY_TRANSLATION_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const parsed = safeParseJson(response?.text || '');
    if (!parsed || typeof parsed !== 'object') {
      return fallback;
    }

    const semanticQuery = normalizeString(parsed.semantic_query) || query;
    const intentQuery = normalizeString(parsed.intent_query) || semanticQuery;
    const filters = normalizeFilters(parsed.filters || {});
    const mustNot = normalizeFilters(parsed.must_not || {});

    return {
      semantic_query: semanticQuery,
      intent_query: intentQuery,
      filters,
      must_not: mustNot,
      translator: 'llm',
    };
  } catch (err) {
    log(`Query translation fallback due to error: ${err.message}`);
    return fallback;
  }
}

function toQdrantConditions(filters) {
  const conditions = [];
  for (const [key, value] of Object.entries(filters || {})) {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        conditions.push({ key, match: { value: entry } });
      });
    } else {
      conditions.push({ key, match: { value } });
    }
  }
  return conditions;
}

function buildQdrantFilter(filters, mustNot) {
  const must = toQdrantConditions(filters);
  const must_not = toQdrantConditions(mustNot);

  const filter = {};
  if (must.length > 0) filter.must = must;
  if (must_not.length > 0) filter.must_not = must_not;

  return Object.keys(filter).length > 0 ? filter : null;
}

function summarizeFilter(filters, mustNot) {
  const parts = [];

  for (const [key, value] of Object.entries(filters || {})) {
    if (Array.isArray(value)) {
      parts.push(`${key} in [${value.join(', ')}]`);
    } else {
      parts.push(`${key}=${String(value)}`);
    }
  }

  for (const [key, value] of Object.entries(mustNot || {})) {
    if (Array.isArray(value)) {
      parts.push(`NOT ${key} in [${value.join(', ')}]`);
    } else {
      parts.push(`NOT ${key}=${String(value)}`);
    }
  }

  return parts;
}

function normalizeText(value) {
  return normalizeString(value).toLowerCase();
}

function extractKeywords(text) {
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token))
    .slice(0, 12);
}

function intersects(left = [], right = []) {
  const rightSet = new Set(right.map((v) => normalizeText(v)).filter(Boolean));
  return left.filter((v) => rightSet.has(normalizeText(v)));
}

function buildMatchReason(match, translated, originalQuery) {
  const reasons = [];
  const filters = translated.filters || {};
  const filterLabels = {
    college: 'college',
    year_of_study: 'study year',
    primary_intent: 'primary intent',
    study_subject: 'study subject',
    career_field: 'career field',
    career_subfield: 'career subfield',
    relationship_intent: 'relationship intent',
    networking_style: 'networking style',
    intellectual_venue: 'intellectual venue',
    relationship_status: 'relationship status',
    sexuality: 'sexuality',
    has_cv: 'CV availability',
  };

  for (const [key, value] of Object.entries(filters)) {
    if (ARRAY_FILTER_KEYS.has(key)) continue;
    if (key === 'has_cv') {
      if (Boolean(match.has_cv) === value) {
        reasons.push(value ? 'has a CV indexed' : 'matches requested CV preference');
      }
      continue;
    }

    if (normalizeText(match[key]) === normalizeText(String(value))) {
      reasons.push(`${filterLabels[key] || key}: ${value}`);
    }
  }

  for (const key of ARRAY_FILTER_KEYS) {
    const expected = Array.isArray(filters[key]) ? filters[key] : [];
    const actual = Array.isArray(match[key]) ? match[key] : [];
    if (expected.length === 0 || actual.length === 0) continue;
    const overlap = intersects(expected, actual);
    if (overlap.length > 0) {
      reasons.push(`shared ${key.replace(/_/g, ' ')}: ${overlap.slice(0, 2).join(', ')}`);
    }
  }

  const keywordPool = [
    match.career_field,
    match.career_subfield,
    match.study_subject,
    match.intellectual_identity,
    match.intellectual_ambition,
    match.intellectual_venue,
    match.honest_thing,
    match.building_description,
    ...(Array.isArray(match.goals) ? match.goals : []),
    ...(Array.isArray(match.desired_connections) ? match.desired_connections : []),
  ].filter(Boolean).join(' ').toLowerCase();

  const keywordHits = extractKeywords(translated.semantic_query || originalQuery)
    .filter((token) => keywordPool.includes(token))
    .slice(0, 3);

  if (keywordHits.length > 0) {
    reasons.push(`semantic overlap on ${keywordHits.join(', ')}`);
  }

  if (reasons.length === 0) {
    return 'Matched via hybrid intent and semantic ranking on your search query.';
  }

  return `Matched on ${reasons.slice(0, 2).join(' and ')}.`;
}

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
function fuseResults(intentMatches, semanticMatches, excludeId, options = {}) {
  const {
    limit = 5,
    semanticWeight = SEMANTIC_WEIGHT,
    intentWeight = INTENT_WEIGHT,
  } = options;

  const map = new Map();

  semanticMatches.forEach(m => {
    if (m.id === excludeId) return;
    map.set(m.id, {
      id: m.id,
      payload: m.payload,
      semantic_score: m.score,
      intent_score: 0,
      score: m.score * semanticWeight
    });
  });

  intentMatches.forEach(m => {
    if (m.id === excludeId) return;
    if (map.has(m.id)) {
      const entry = map.get(m.id);
      entry.intent_score = m.score;
      entry.score = (entry.semantic_score * semanticWeight) + (m.score * intentWeight);
    } else {
      map.set(m.id, {
        id: m.id,
        payload: m.payload,
        semantic_score: 0,
        intent_score: m.score,
        score: m.score * intentWeight
      });
    }
  });

  return Array.from(map.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(m => ({
      ...m.payload,
      qdrant_id: m.id,
      score: Math.round(m.score * 100),
      semantic_pct: Math.round(m.semantic_score * 100),
      intent_pct: Math.round(m.intent_score * 100),
    }));
}

function buildSearchMetadata({ variant, translated, filters, startedAt, parseMs, retrievalMs, resultCount }) {
  return {
    variant,
    translator: translated.translator,
    semantic_query: translated.semantic_query,
    intent_query: translated.intent_query,
    filter_count: (filters.must || []).length + (filters.must_not || []).length,
    applied_filters: summarizeFilter(translated.filters, translated.must_not),
    parse_ms: parseMs,
    retrieval_ms: retrievalMs,
    total_ms: Date.now() - startedAt,
    result_count: resultCount,
  };
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
      const requestedVariant = normalizeString(body.variant);
      const variant = SEARCH_VARIANTS.has(requestedVariant) ? requestedVariant : 'hybrid_filtered';

      if (!query || query.trim().length < 2) {
        return res.json({ matches: [] });
      }

      const startedAt = Date.now();
      log(`Searching for: "${query}" (variant=${variant})`);

      const parseStart = Date.now();
      const translated = await translateSearchQuery(query, ai, log);
      const parseMs = Date.now() - parseStart;

      const qdrantFilter = variant === 'hybrid_filtered'
        ? buildQdrantFilter(translated.filters, translated.must_not)
        : null;

      const filterForSearch = qdrantFilter || {};

      const retrievalStart = Date.now();
      let matches = [];

      if (variant === 'semantic_only') {
        const embeddingResult = await ai.models.embedContent({
          model: 'gemini-embedding-001',
          contents: translated.semantic_query,
          config: { outputDimensionality: 1536 }
        });
        const queryVector = embeddingResult.embeddings[0].values.slice(0, 1536);

        const request = {
          vector: { name: 'semantic', vector: queryVector },
          limit: 8,
          with_payload: true,
          score_threshold: 0.3,
        };
        if (qdrantFilter) request.filter = qdrantFilter;

        const results = await qdrant.search(COLLECTION, request);

        matches = results.map((r) => ({
          ...r.payload,
          source: 'in-app',
          retrieval_variant: variant,
          score: Math.round(r.score * 100),
          semantic_pct: Math.round(r.score * 100),
          intent_pct: 0,
          applied_filters: summarizeFilter(translated.filters, translated.must_not),
          match_reason: buildMatchReason(r.payload || {}, translated, query),
        }));
      } else if (variant === 'intent_only') {
        const embeddingResult = await ai.models.embedContent({
          model: 'gemini-embedding-001',
          contents: translated.intent_query,
          config: { outputDimensionality: 1536 }
        });
        const queryVector = embeddingResult.embeddings[0].values.slice(0, 1536);

        const request = {
          vector: { name: 'intent', vector: queryVector },
          limit: 8,
          with_payload: true,
          score_threshold: 0.2,
        };
        if (qdrantFilter) request.filter = qdrantFilter;

        const results = await qdrant.search(COLLECTION, request);

        matches = results.map((r) => ({
          ...r.payload,
          source: 'in-app',
          retrieval_variant: variant,
          score: Math.round(r.score * 100),
          semantic_pct: 0,
          intent_pct: Math.round(r.score * 100),
          applied_filters: summarizeFilter(translated.filters, translated.must_not),
          match_reason: buildMatchReason(r.payload || {}, translated, query),
        }));
      } else {
        const [semanticEmbedding, intentEmbedding] = await Promise.all([
          ai.models.embedContent({
            model: 'gemini-embedding-001',
            contents: translated.semantic_query,
            config: { outputDimensionality: 1536 }
          }),
          ai.models.embedContent({
            model: 'gemini-embedding-001',
            contents: translated.intent_query,
            config: { outputDimensionality: 1536 }
          }),
        ]);

        const semanticVector = semanticEmbedding.embeddings[0].values.slice(0, 1536);
        const intentVector = intentEmbedding.embeddings[0].values.slice(0, 1536);

        const semanticRequest = {
          vector: { name: 'semantic', vector: semanticVector },
          limit: 16,
          with_payload: true,
          score_threshold: variant === 'hybrid_filtered' ? 0.18 : 0.24,
        };
        const intentRequest = {
          vector: { name: 'intent', vector: intentVector },
          limit: 16,
          with_payload: true,
          score_threshold: variant === 'hybrid_filtered' ? 0.12 : 0.18,
        };

        if (qdrantFilter) {
          semanticRequest.filter = filterForSearch;
          intentRequest.filter = filterForSearch;
        }

        const [semanticRes, intentRes] = await Promise.all([
          qdrant.search(COLLECTION, semanticRequest),
          qdrant.search(COLLECTION, intentRequest),
        ]);

        matches = fuseResults(intentRes, semanticRes, null, {
          limit: 8,
          semanticWeight: SEMANTIC_WEIGHT,
          intentWeight: INTENT_WEIGHT,
        }).map((match) => ({
          ...match,
          source: 'in-app',
          retrieval_variant: variant,
          applied_filters: summarizeFilter(translated.filters, translated.must_not),
          match_reason: buildMatchReason(match, translated, query),
        }));
      }

      const retrievalMs = Date.now() - retrievalStart;
      const metadata = buildSearchMetadata({
        variant,
        translated,
        filters: qdrantFilter || {},
        startedAt,
        parseMs,
        retrievalMs,
        resultCount: matches.length,
      });

      log(`Search returned ${matches.length} results in ${metadata.total_ms}ms`);
      return res.json({ matches, metadata });
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
