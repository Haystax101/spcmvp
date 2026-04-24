import { GoogleGenAI } from '@google/genai';
import { QdrantClient } from '@qdrant/js-client-rest';
import { Client, TablesDB, Query } from 'node-appwrite';
import OpenAI from 'openai';
import crypto from 'crypto';
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "https://353d6976441e378c1fadef50b50a725c@o4510971097317376.ingest.de.sentry.io/4511229967990864",
  tracesSampleRate: 1.0,
});

const COLLECTION = 'profiles';
const SEMANTIC_WEIGHT = 0.6;
const INTENT_WEIGHT = 0.4;

const DB_ID = process.env.APPWRITE_DB_ID || 'supercharged';
const PROFILES_TABLE = process.env.APPWRITE_PROFILES_TABLE || 'profiles';
const PEOPLE_TABLE = process.env.APPWRITE_PEOPLE_TABLE || 'people';
const PEOPLE_SOCIETIES_TABLE = process.env.APPWRITE_PEOPLE_SOCIETIES_TABLE || 'people_societies';
const PEOPLE_SPORTS_TABLE = process.env.APPWRITE_PEOPLE_SPORTS_TABLE || 'people_sports';
const SOCIETIES_TABLE = process.env.APPWRITE_SOCIETIES_TABLE || 'societies';
const SPORTS_TABLE = process.env.APPWRITE_SPORTS_TABLE || 'sports';

const KIMI_DEPLOYMENT = process.env.AZURE_FOUNDRY_DEPLOYMENT || 'Kimi-K2.6-1';

const SEARCH_VARIANTS = new Set([
  'semantic_only',
  'intent_only',
  'hybrid_unfiltered',
  'hybrid_filtered',
  'external',
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
  'intellectual_venue',
  'relationship_status',
  'sexuality',
  'has_cv',
  'goals',
  'desired_connections',
  'social_circles',
  'friendship_values',
  'dating_appearance',
  'dating_personality',
  'dating_hobbies',
]);

const WEIGHTABLE_FILTER_KEYS = new Set([...ALLOWED_FILTER_KEYS]);

const ARRAY_FILTER_KEYS = new Set([
  'goals',
  'desired_connections',
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

const STRUCTURED_WEIGHT = 0.2;

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
You are a search filter generator for an Oxford student discovery engine.
Your job is to analyse a search query and produce structured filters using ONLY the exact string values listed below, plus two free-text query strings for semantic vector search.

──────────────────────────────────────────────
VALID VALUES FOR STRUCTURED FIELDS
──────────────────────────────────────────────

career_field — use exact string:
  "Finance and investing" | "Consulting and strategy" | "Technology and engineering" |
  "Startups and entrepreneurship" | "Law" | "Medicine and healthcare" |
  "Academia and research" | "Policy and public sector" |
  "Creative industries and media" | "Social impact and NGOs" | "Other"

career_subfield — use exact string (depends on career_field):
  Finance: "Investment banking" | "Private equity" | "Hedge funds" | "Venture capital" | "Asset management" | "Corporate finance" | "Financial consulting" | "Fintech" | "Trading" | "Impact investing" | "Not sure yet"
  Consulting: "Strategy consulting (MBB)" | "Big 4 consulting" | "Boutique or specialist" | "In-house strategy" | "Public sector consulting" | "Tech consulting" | "Not sure yet"
  Technology: "Software engineering" | "Machine learning and AI" | "Cybersecurity" | "Hardware and embedded" | "Data engineering" | "DevOps and infrastructure" | "Biotech or deep tech" | "Not sure yet"
  Startups: "I am already building something" | "Consumer app or platform" | "B2B SaaS" | "Deep tech or science-based" | "Social enterprise" | "Marketplace" | "Media or content" | "Hardware or physical product" | "Not sure yet"
  Law: "Corporate and M&A" | "Litigation" | "Criminal" | "Human rights and public law" | "IP and tech" | "International law" | "Barrister route" | "Not sure yet"
  Medicine: "Clinical medicine" | "Research and academia" | "Health policy" | "Biotech or pharma" | "Global health" | "Mental health" | "Medical technology" | "Not sure yet"
  Academia: "Theoretical or pure research" | "Applied research" | "Interdisciplinary" | "Policy-facing research" | "Commercialising research" | "Not sure yet"
  Policy: "Civil service" | "Think tanks" | "International institutions" | "Political advisory" | "Local government" | "Regulatory bodies" | "Not sure yet"
  Creative: "Journalism and writing" | "Film and television" | "Music" | "Architecture and design" | "Advertising and branding" | "Publishing" | "Digital content" | "Not sure yet"
  Social impact: "International development" | "Climate and environment" | "Education" | "Economic empowerment" | "Human rights" | "Effective altruism" | "Not sure yet"

primary_intent — use exact string:
  "professional" | "social" | "romantic" | "academic"

goals (array) — use exact strings:
  "professional" | "social" | "romantic" | "academic"

year_of_study — use exact string:
  "First year" | "Second year" | "Third year" | "Fourth year or above" | "Postgraduate"

college — use exact Oxford college name, e.g.:
  "All Souls" | "Balliol" | "Brasenose" | "Christ Church" | "Corpus Christi" | "Exeter" |
  "Green Templeton" | "Harris Manchester" | "Hertford" | "Jesus" | "Keble" | "Kellogg" |
  "Lady Margaret Hall" | "Linacre" | "Lincoln" | "Magdalen" | "Mansfield" | "Merton" |
  "New College" | "Oriel" | "Pembroke" | "Queen's" | "Regent's Park" | "Reuben" |
  "St Anne's" | "St Antony's" | "St Catherine's" | "St Cross" | "St Edmund Hall" |
  "St Hilda's" | "St Hugh's" | "St John's" | "St Peter's" | "Somerville" | "Trinity" |
  "University" | "Wadham" | "Wolfson" | "Worcester" | "Wycliffe Hall"

relationship_intent — use exact string:
  "Something serious" | "Keeping it casual" | "Friendship first, maybe something later" | "Not sure yet, open to seeing"

relationship_status — use exact string:
  "Single" | "In a relationship" | "It's complicated" | "Prefer not to say"

intellectual_venue — use exact string:
  "At tutorials or seminars" | "At dinner" | "At society talks or panels" |
  "One on one, on a walk or over coffee" | "Honestly, I'm still looking for those conversations"

social_circles (array) — use exact strings:
  "College events and bops" | "Cafe culture and one-on-ones" | "Sports and fitness" |
  "Society dinners and formals" | "House parties" | "Arts and cultural events" |
  "Nights out in town" | "Mostly off-campus" | "Quiet and low-key"

desired_connections (array) — use exact strings:
  "Someone 2-5 years ahead of me on this exact path" | "A peer who is as driven as I am to push me" |
  "Someone already inside who can give me honest, unfiltered advice" |
  "Someone from a completely different background who can open unexpected doors" |
  "A technical co-founder who can build what I can't" | "A commercial brain to own growth and revenue" |
  "A creative partner for product and brand" | "A domain expert who knows the space deeply" |
  "An accountability partner to keep me honest" | "An investor or someone who can open funding doors" |
  "A first customer or design partner"

dating_personality (array) — use exact strings:
  "Ambition" | "Wit and humour" | "Emotional depth" | "Confidence" | "Kindness" |
  "Curiosity" | "Independence" | "Warmth" | "Playfulness" | "Directness" | "Creativity" | "Drive"

dating_hobbies (array) — use exact strings:
  "Go to exhibitions or galleries" | "Cook or eat out" | "Hike or be outdoors" |
  "Go to gigs or festivals" | "Travel spontaneously" | "Stay in and watch films" |
  "Work out together" | "Talk for hours over coffee" | "Go out and socialise" | "Do creative things together"

dating_appearance (array) — use exact strings:
  "Tall" | "Petite" | "Athletic build" | "Slim" | "Curvy" | "Well-dressed" |
  "Natural look" | "Put-together" | "Edgy or alternative" | "Preppy" | "No strong preference"

──────────────────────────────────────────────
OUTPUT SCHEMA
──────────────────────────────────────────────
Return JSON only:
{
  "semantic_query": "rich paragraph on the ideal match's background, interests, and context",
  "intent_query": "2-3 sentences on what the ideal match wants to do or achieve",
  "filters": { /* only fields with high confidence, using exact strings above */ },
  "must_not": { "college": "string", "primary_intent": "string" },
  "attribute_weights": { /* keys must match filters, values sum to 1.0 */ },
  "strict_key": "the single highest-confidence filter key"
}

──────────────────────────────────────────────
RULES
──────────────────────────────────────────────
- Use ONLY the exact strings listed above for structured fields. Do not paraphrase or invent values.
- If the query doesn't clearly map to a value, OMIT that filter entirely — false positives destroy results.
- "semantic_query": focus on abstract meaning, personality, interests.
- "intent_query": focus on goals, connection intent, practical purpose.
- "strict_key" must be the single highest-confidence filter key.
- Weights must sum to 1.0; include only keys present in filters.
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
  const rawKeys = Object.keys(raw);
  const disallowedKeys = rawKeys.filter(k => !ALLOWED_FILTER_KEYS.has(k));

  for (const [key, value] of Object.entries(raw)) {
    if (!ALLOWED_FILTER_KEYS.has(key)) continue;
    const normalized = normalizeFilterValue(key, value);
    if (normalized === null) continue;
    cleaned[key] = normalized;
  }

  if (disallowedKeys.length > 0) {
    console.log(`[normalizeFilters] Filtered out disallowed keys: ${disallowedKeys.join(', ')}`);
  }
  if (Object.keys(cleaned).length > 0) {
    console.log(`[normalizeFilters] Kept filters: ${JSON.stringify(cleaned)}`);
  }

  return cleaned;
}

function toPositiveNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function buildDefaultWeights(filters) {
  const keys = Object.keys(filters || {}).filter((key) => WEIGHTABLE_FILTER_KEYS.has(key));
  if (keys.length === 0) return {};

  const even = 1 / keys.length;
  return keys.reduce((acc, key) => {
    acc[key] = even;
    return acc;
  }, {});
}

function normalizeAttributeWeights(rawWeights, filters) {
  const defaults = buildDefaultWeights(filters);
  if (!rawWeights || typeof rawWeights !== 'object') return defaults;

  const filtered = {};
  for (const [key, value] of Object.entries(rawWeights)) {
    if (!WEIGHTABLE_FILTER_KEYS.has(key)) continue;
    if (!(key in (filters || {}))) continue;

    const numeric = toPositiveNumber(value);
    if (numeric === null) continue;
    filtered[key] = numeric;
  }

  const sum = Object.values(filtered).reduce((acc, v) => acc + v, 0);
  if (sum <= 0) return defaults;

  const normalized = {};
  for (const [key, value] of Object.entries(filtered)) {
    normalized[key] = value / sum;
  }

  return normalized;
}

function determineStrictKey(rawStrictKey, weights, filters) {
  const filterKeys = Object.keys(filters || {});
  if (filterKeys.length === 0) return null;

  const normalizedStrict = normalizeString(rawStrictKey);
  if (normalizedStrict && filterKeys.includes(normalizedStrict)) {
    return normalizedStrict;
  }

  let bestKey = null;
  let bestWeight = -1;
  for (const [key, weight] of Object.entries(weights || {})) {
    if (!(key in (filters || {}))) continue;
    if (weight > bestWeight) {
      bestWeight = weight;
      bestKey = key;
    }
  }

  return bestKey || filterKeys[0] || null;
}

function strictOnlyFilters(translated) {
  const strictKey = translated?.strict_key;
  if (!strictKey) return {};
  if (!translated?.filters || !(strictKey in translated.filters)) return {};

  return {
    [strictKey]: translated.filters[strictKey],
  };
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
    attribute_weights: {},
    strict_key: null,
    translator: 'fallback',
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
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
    const llmFilters = normalizeFilters(parsed.filters || {});
    const filters = Object.keys(llmFilters).length > 0 ? llmFilters : inferQueryIntentFilters(query);
    const mustNot = normalizeFilters(parsed.must_not || {});
    const attributeWeights = normalizeAttributeWeights(parsed.attribute_weights || parsed.weights || {}, filters);
    const strictKey = determineStrictKey(parsed.strict_key, attributeWeights, filters);

    // Conservative guardrail: if we parsed filters but cannot determine a strict key, do not trust the translation.
    if (Object.keys(filters).length > 0 && !strictKey) {
      return fallback;
    }

    return {
      semantic_query: semanticQuery,
      intent_query: intentQuery,
      filters,
      must_not: mustNot,
      attribute_weights: attributeWeights,
      strict_key: strictKey,
      translator: Object.keys(llmFilters).length > 0 ? 'llm' : 'heuristic',
    };
  } catch (err) {
    log(`Query translation fallback due to error: ${err.message}`);
    return fallback;
  }
}

async function buildIdealProfile(query, userId, kimi, tables, ai, log) {
  const fallback = {
    semantic_query: query,
    intent_query: query,
    filters: {},
    must_not: {},
    attribute_weights: {},
    strict_key: null,
    translator: 'fallback',
  };

  try {
    log(`[buildIdealProfile] Starting with query="${query}", userId="${userId}", hasKimi=${!!kimi}, hasTables=${!!tables}`);

    let searcherContext = '';
    if (userId && tables) {
      log(`[buildIdealProfile] Fetching searcher profile for userId: ${userId}`);

      const profileRes = await tables.listRows({
        databaseId: DB_ID,
        tableId: PROFILES_TABLE,
        queries: [Query.equal('user_id', userId), Query.limit(1)]
      });
      const profile = profileRes.rows?.[0];
      if (profile) {
        const ctx = {};
        const fields = [
          'college', 'career_field', 'career_subfield', 'primary_intent',
          'goals', 'study_subject', 'year_of_study', 'desired_connections',
          'social_circles', 'building_description', 'intellectual_venue',
          'relationship_intent', 'project_stage', 'hobby', 'societies',
        ];
        for (const f of fields) {
          const v = profile[f];
          if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) {
            ctx[f] = v;
          }
        }
        if (Object.keys(ctx).length > 0) {
          searcherContext = JSON.stringify(ctx);
          log(`[buildIdealProfile] Searcher context (${Object.keys(ctx).length} fields): ${searcherContext.slice(0, 300)}...`);
        }
      }
    }

    const userPrompt = `Search query: "${query}"
${searcherContext ? `Searcher's own profile (use this to personalise results):\n${searcherContext}\n` : ''}
Using the valid values provided in your instructions, generate a structured ideal-match profile. Return JSON:
{
  "semantic_query": "...",
  "intent_query": "...",
  "filters": { },
  "attribute_weights": { },
  "strict_key": "..."
}
Only include filters you are confident about. Use exact strings from the valid values list.`;

    log(`[buildIdealProfile] Calling Grok with deployment: ${KIMI_DEPLOYMENT}`);
    const response = await kimi.chat.completions.create({
      model: KIMI_DEPLOYMENT,
      messages: [{
        role: 'system',
        content: QUERY_TRANSLATION_SYSTEM_PROMPT
      }, {
        role: 'user',
        content: userPrompt
      }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 512,
    });

    log(`[buildIdealProfile] Grok response received, choices: ${response.choices?.length || 0}`);
    const kimiContent = response.choices?.[0]?.message?.content || '';
    log(`[buildIdealProfile] Grok FULL content: ${kimiContent}`);

    const parsed = safeParseJson(kimiContent);
    if (!parsed || typeof parsed !== 'object') {
      log(`[buildIdealProfile] Grok response invalid (parsed=${!!parsed}, type=${typeof parsed}), content="${kimiContent.slice(0, 500)}"`);
      log(`[buildIdealProfile] Falling back to Gemini`);
      return await translateSearchQuery(query, ai, log);
    }
    log(`[buildIdealProfile] Grok response parsed successfully`);

    const semanticQuery = normalizeString(parsed.semantic_query) || query;
    const intentQuery = normalizeString(parsed.intent_query) || semanticQuery;
    const llmFilters = normalizeFilters(parsed.filters || {});
    const filters = Object.keys(llmFilters).length > 0 ? llmFilters : inferQueryIntentFilters(query);
    const mustNot = normalizeFilters(parsed.must_not || {});
    const attributeWeights = normalizeAttributeWeights(parsed.attribute_weights || parsed.weights || {}, filters);
    const strictKey = determineStrictKey(parsed.strict_key, attributeWeights, filters);

    if (Object.keys(filters).length > 0 && !strictKey) {
      log('Kimi filters parsed but no strict key, falling back to Gemini');
      return await translateSearchQuery(query, ai, log);
    }

    return {
      semantic_query: semanticQuery,
      intent_query: intentQuery,
      filters,
      must_not: mustNot,
      attribute_weights: attributeWeights,
      strict_key: strictKey,
      translator: Object.keys(llmFilters).length > 0 ? 'grok' : 'heuristic',
    };
  } catch (err) {
    log(`[buildIdealProfile] ERROR: ${err.message}`);
    log(`[buildIdealProfile] Error code: ${err.code}, status: ${err.status}`);
    log(`[buildIdealProfile] Full error: ${JSON.stringify(err).slice(0, 500)}`);
    Sentry.captureException(err, { tags: { context: 'buildIdealProfile' }, level: 'warning' });
    log(`[buildIdealProfile] Falling back to Gemini`);
    return await translateSearchQuery(query, ai, log);
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

function toNormalizedSet(values) {
  return new Set((Array.isArray(values) ? values : [values])
    .map((value) => normalizeText(value))
    .filter(Boolean));
}

function overlapCount(left, right) {
  const leftSet = toNormalizedSet(left);
  const rightSet = toNormalizedSet(right);
  let count = 0;
  leftSet.forEach((entry) => {
    if (rightSet.has(entry)) count += 1;
  });
  return count;
}

function scoreOverlap(left, right, maxPoints = 1) {
  if (!left || !right) return 0;
  const count = overlapCount(left, right);
  if (count === 0) return 0;
  return Math.min(maxPoints, count / Math.max(1, Array.isArray(left) ? left.length : 1));
}

function scoreScalarMatch(expected, actual) {
  const left = normalizeText(expected);
  const right = normalizeText(actual);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (right.includes(left) || left.includes(right)) return 0.65;
  return 0;
}

function scoreArrayMatch(expected, actual) {
  const left = Array.isArray(expected) ? expected : [expected];
  const right = Array.isArray(actual) ? actual : [actual];
  if (left.length === 0 || right.length === 0) return 0;

  const overlap = overlapCount(left, right);
  if (overlap === 0) return 0;

  return Math.min(1, overlap / left.length);
}

function scoreFilterMatch(key, expectedValue, match) {
  if (!(key in (match || {}))) return 0;

  const actualValue = match[key];

  if (key === 'has_cv') {
    return Boolean(actualValue) === Boolean(expectedValue) ? 1 : 0;
  }

  if (ARRAY_FILTER_KEYS.has(key)) {
    return scoreArrayMatch(expectedValue, actualValue);
  }

  return scoreScalarMatch(expectedValue, actualValue);
}

function inferQueryIntentFilters(query) {
  const text = normalizeText(query);
  const filters = {};

  for (const [phrase, intent] of Object.entries(INTENT_SYNONYMS)) {
    if (text.includes(phrase)) {
      filters.primary_intent = intent;
      break;
    }
  }

  for (const college of OXFORD_COLLEGES) {
    if (text.includes(college.toLowerCase())) {
      filters.college = college;
      break;
    }
  }

  for (const [phrase, year] of Object.entries(YEAR_SYNONYMS)) {
    if (text.includes(phrase)) {
      filters.year_of_study = year;
      break;
    }
  }

  return filters;
}

function computeStructuredScore(match, context = {}) {
  const details = [];
  let total = 0;

  if (context.type === 'search') {
    const translated = context.translated || {};
    const filters = translated.filters || {};
    const weights = normalizeAttributeWeights(translated.attribute_weights || {}, filters);
    const strictKey = translated.strict_key;
    const queryText = `${translated.semantic_query || ''} ${translated.intent_query || ''} ${context.originalQuery || ''}`;
    const keywords = extractKeywords(queryText);
    const perFilterScores = {};

    for (const [key, expectedValue] of Object.entries(filters)) {
      const score = scoreFilterMatch(key, expectedValue, match);
      perFilterScores[key] = score;

      if (score >= 0.99) {
        details.push(`${key}=exact`);
      } else if (score >= 0.5) {
        details.push(`${key}=partial`);
      }
    }

    if (strictKey && (perFilterScores[strictKey] ?? 0) <= 0) {
      return {
        score: 0,
        details: [`strict_key_miss=${strictKey}`],
      };
    }

    const weightedFilterScore = Object.entries(weights).reduce((acc, [key, weight]) => {
      return acc + ((perFilterScores[key] || 0) * weight);
    }, 0);

    total += weightedFilterScore * 0.85;

    const startupWords = ['startup', 'founder', 'cofounder', 'co-founder', 'build', 'venture', 'mvp', 'entrepreneur'];
    const matchText = [
      match.primary_intent,
      match.career_field,
      match.career_subfield,
      match.building_description,
      ...(Array.isArray(match.goals) ? match.goals : []),
      ...(Array.isArray(match.desired_connections) ? match.desired_connections : []),
      ...(Array.isArray(match.startup_connections) ? match.startup_connections : []),
    ].join(' ').toLowerCase();
    const startupHit = startupWords.some((word) => queryText.includes(word) && matchText.includes(word));
    if (startupHit) {
      total += 0.08;
      details.push('startup signal');
    }

    const keywordHits = keywords.filter((keyword) => matchText.includes(keyword)).slice(0, 3);
    if (keywordHits.length > 0) {
      total += Math.min(0.15, keywordHits.length * 0.05);
      details.push(`keywords=${keywordHits.join(', ')}`);
    }

    if (strictKey) {
      details.push(`strict_key=${strictKey}`);
    }
  }

  if (context.type === 'recommend') {
    const source = context.source || {};
    const sourceFilters = inferQueryIntentFilters([source.primary_intent, source.career_field, source.study_subject, source.year_of_study].filter(Boolean).join(' '));

    if (source.primary_intent && normalizeText(match.primary_intent) === normalizeText(source.primary_intent)) {
      total += 0.2;
      details.push('shared primary intent');
    }
    if (source.career_field && normalizeText(match.career_field) === normalizeText(source.career_field)) {
      total += 0.15;
      details.push('shared career field');
    }
    if (source.career_subfield && normalizeText(match.career_subfield) === normalizeText(source.career_subfield)) {
      total += 0.1;
      details.push('shared career subfield');
    }
    if (source.study_subject && normalizeText(match.study_subject) === normalizeText(source.study_subject)) {
      total += 0.1;
      details.push('shared study subject');
    }
    if (source.year_of_study && normalizeText(match.year_of_study) === normalizeText(source.year_of_study)) {
      total += 0.05;
      details.push('same year');
    }

    const goalsOverlap = scoreOverlap(source.goals || [], match.goals || [], 1) * 0.15;
    if (goalsOverlap > 0) {
      total += goalsOverlap;
      details.push('goal overlap');
    }

    const desiredOverlap = scoreOverlap(source.desired_connections || [], match.desired_connections || match.startup_connections || [], 1) * 0.15;
    if (desiredOverlap > 0) {
      total += desiredOverlap;
      details.push('connection overlap');
    }

    const startupOverlap = scoreOverlap(source.startup_connections || [], match.startup_connections || match.desired_connections || [], 1) * 0.2;
    if (startupOverlap > 0) {
      total += startupOverlap;
      details.push('startup overlap');
    }

    const sourceKeywords = extractKeywords([source.primary_intent, source.career_field, source.career_subfield, source.study_subject].filter(Boolean).join(' '));
    const matchText = [match.primary_intent, match.career_field, match.career_subfield, match.study_subject, match.building_description].join(' ').toLowerCase();
    const keywordHits = sourceKeywords.filter((keyword) => matchText.includes(keyword)).slice(0, 3);
    if (keywordHits.length > 0) {
      total += Math.min(0.1, keywordHits.length * 0.04);
      details.push(`keywords=${keywordHits.join(', ')}`);
    }

    if (sourceFilters.primary_intent && normalizeText(match.primary_intent) === normalizeText(sourceFilters.primary_intent)) {
      total += 0.05;
      details.push(`inferred intent=${sourceFilters.primary_intent}`);
    }
  }

  return {
    score: Math.min(1, total),
    details,
  };
}

function intersects(left = [], right = []) {
  const rightSet = new Set(right.map((v) => normalizeText(v)).filter(Boolean));
  return left.filter((v) => rightSet.has(normalizeText(v)));
}

function buildMatchReason(match, translated, originalQuery) {
  const reasons = [];
  const filters = translated.filters || {};
  const strictKey = translated.strict_key;
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

  if (strictKey && filters[strictKey] !== undefined) {
    const strictValue = filters[strictKey];
    if (Array.isArray(strictValue)) {
      reasons.unshift(`key requirement ${strictKey}: ${strictValue.join(', ')}`);
    } else {
      reasons.unshift(`key requirement ${strictKey}: ${strictValue}`);
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

function applyStructuredScoring(matches, context) {
  return matches.map((match) => {
    const structured = computeStructuredScore(match, context);
    const baseScore = Number(match.score || 0) / 100;
    const blendedScore = Math.min(1, (baseScore * (1 - STRUCTURED_WEIGHT)) + (structured.score * STRUCTURED_WEIGHT));
    return {
      ...match,
      structured_score: Math.round(structured.score * 100),
      score: Math.round(blendedScore * 100),
      score_breakdown: {
        base: Math.round(baseScore * 100),
        structured: Math.round(structured.score * 100),
        details: structured.details,
      },
    };
  });
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
    strict_key: translated.strict_key || null,
    attribute_weights: translated.attribute_weights || {},
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

  const kimi = new OpenAI({
    baseURL: process.env.AZURE_FOUNDRY_ENDPOINT,
    apiKey: process.env.AZURE_FOUNDRY_API_KEY,
  });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { action } = body;
    log(`[discoveryEngine] Received action: "${action}", body keys: ${Object.keys(body).join(', ')}`);
    log(`[discoveryEngine] Body: ${JSON.stringify(body).slice(0, 200)}...`);

    // ─── RECOMMEND: find matches based on the user's own vectors ───────────────
    if (action === 'recommend') {
      const { docId } = body;
      if (!docId) return res.json({ error: 'docId is required for recommend.' }, 400);

      const qdrantId = getQdrantId(docId);
      log(`Recommend for Qdrant ID: ${qdrantId}`);

      // Safeguard: check the point exists
      const existing = await qdrant.retrieve(COLLECTION, {
        ids: [qdrantId],
        with_payload: true,
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

      const source = existing?.[0]?.payload || null;
      const matches = applyStructuredScoring(
        fuseResults(intentRes, semanticRes, qdrantId),
        { type: 'recommend', source }
      );
      log(`Returning ${matches.length} matches`);
      return res.json({ matches });
    }

    // ─── SEARCH: find people matching a free-text query ─────────────────────
    if (action === 'search') {
      const { query } = body;
      const requestedVariant = normalizeString(body.variant);
      const variant = SEARCH_VARIANTS.has(requestedVariant) ? requestedVariant : 'hybrid_filtered';
      const userId = normalizeString(body.userId || body.user_id || '');

      if (!query || query.trim().length < 2) {
        return res.json({ matches: [] });
      }

      const startedAt = Date.now();
      log(`Searching for: "${query}" (variant=${variant})`);

      // Initialize Appwrite tables only if needed (userId provided or external search)
      let tables = null;
      if (userId || variant === 'external') {
        const appwrite = new Client()
          .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://fra.cloud.appwrite.io/v1')
          .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
          .setKey(process.env.APPWRITE_API_KEY);
        tables = new TablesDB(appwrite);
      }

      const parseStart = Date.now();
      const translated = await buildIdealProfile(query, userId, kimi, tables, ai, log);
      const parseMs = Date.now() - parseStart;

      log(`[search] Translated filters: ${JSON.stringify(translated.filters)}`);
      log(`[search] Translated must_not: ${JSON.stringify(translated.must_not)}`);

      const strictFilters = strictOnlyFilters(translated);
      log(`[search] Strict filters: ${JSON.stringify(strictFilters)}`);

      const qdrantFilter = variant === 'hybrid_filtered'
        ? buildQdrantFilter(strictFilters, translated.must_not)
        : null;

      log(`[search] Final Qdrant filter: ${JSON.stringify(qdrantFilter)}`);

      const filterForSearch = qdrantFilter || {};

      const retrievalStart = Date.now();
      let matches = [];

      if (variant === 'external') {
        try {
          log(`[external] Starting external search for query="${query}"`);
          let currentProfile = null;
          if (userId) {
            log(`[external] Fetching profile for userId: ${userId}`);
            const profileRes = await tables.listRows({
              databaseId: DB_ID,
              tableId: PROFILES_TABLE,
              queries: [Query.equal('user_id', userId), Query.limit(1)]
            });
            currentProfile = profileRes.rows?.[0] || null;
            log(`[external] Profile found: ${currentProfile ? currentProfile.full_name : 'none'}`);
          }

          // Phase 1: Identify relevant societies and sports via Kimi
          log(`[external] Phase 1: Identifying societies/sports via Kimi`);
          const groupPrompt = `Query: "${query}"
${currentProfile ? `Searcher: ${currentProfile.career_field || ''}, goals: ${(currentProfile.goals || []).join(', ')}` : ''}

Return JSON:
{
  "societies": ["society name fragments to match against"],
  "sports": ["sport name fragments to match against"]
}
Keep lists to 3–5 items max. Use short fragments (e.g. "Entrepreneurs" not full name).`;

          log(`[external] Calling Kimi for group identification`);
          const groupResponse = await kimi.chat.completions.create({
            model: KIMI_DEPLOYMENT,
            messages: [{
              role: 'system',
              content: 'You identify Oxford university societies and sports clubs relevant to a search query. Output only valid JSON.'
            }, {
              role: 'user',
              content: groupPrompt
            }],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 256,
          });
          log(`[external] Kimi grouping response received`);
          const groups = safeParseJson(groupResponse.choices?.[0]?.message?.content || '{}') || {};
          const targetSocieties = groups.societies || [];
          const targetSports = groups.sports || [];
          log(`[external] Identified societies: ${targetSocieties.join(', ') || 'none'}, sports: ${targetSports.join(', ') || 'none'}`);

          // Phase 2: Fetch all societies and sports, match by name
          const [allSocietiesRes, allSportsRes] = await Promise.all([
            tables.listRows({ databaseId: DB_ID, tableId: SOCIETIES_TABLE, queries: [Query.limit(200)] }),
            tables.listRows({ databaseId: DB_ID, tableId: SPORTS_TABLE, queries: [Query.limit(200)] }),
          ]);

          const matchedSocietyIds = allSocietiesRes.rows
            .filter(s => targetSocieties.some(t => s.name.toLowerCase().includes(t.toLowerCase())))
            .map(s => s.$id);
          const matchedSportIds = allSportsRes.rows
            .filter(s => targetSports.some(t => s.name.toLowerCase().includes(t.toLowerCase())))
            .map(s => s.$id);

          // Phase 3: Join to people via join tables
          const [societyMembersRes, sportMembersRes] = await Promise.all([
            matchedSocietyIds.length > 0
              ? tables.listRows({ databaseId: DB_ID, tableId: PEOPLE_SOCIETIES_TABLE,
                  queries: [Query.equal('society_id', matchedSocietyIds), Query.limit(60)] })
              : Promise.resolve({ rows: [] }),
            matchedSportIds.length > 0
              ? tables.listRows({ databaseId: DB_ID, tableId: PEOPLE_SPORTS_TABLE,
                  queries: [Query.equal('sport_id', matchedSportIds), Query.limit(60)] })
              : Promise.resolve({ rows: [] }),
          ]);

          const personIdSet = new Set([
            ...societyMembersRes.rows.map(r => r.person_id).filter(Boolean),
            ...sportMembersRes.rows.map(r => r.person_id).filter(Boolean),
          ]);

          // Phase 4: Fetch people and filter to those with descriptions
          const personIds = [...personIdSet].slice(0, 50);
          const peopleRes = personIds.length > 0
            ? await tables.listRows({ databaseId: DB_ID, tableId: PEOPLE_TABLE,
                queries: [Query.equal('$id', personIds), Query.limit(50)] })
            : { rows: [] };

          const withDescriptions = peopleRes.rows.filter(p => p.description?.trim().length > 0);

          if (withDescriptions.length === 0 || (matchedSocietyIds.length === 0 && matchedSportIds.length === 0)) {
            // Fallback to simple keyword search
            const keywords = extractKeywords(query);
            const peopleQueries = [Query.limit(20)];
            if (keywords.length > 0) {
              peopleQueries.push(Query.contains('description', keywords[0]));
            }
            const fallbackRes = await tables.listRows({
              databaseId: DB_ID,
              tableId: PEOPLE_TABLE,
              queries: peopleQueries
            });
            matches = fallbackRes.rows.map(p => {
              const description = p.description || '';
              let score = 50;
              const hits = keywords.filter(k => description.toLowerCase().includes(k.toLowerCase()));
              score += (hits.length * 10);
              return {
                ...p,
                is_on_app: false,
                source: 'people_db',
                score: Math.min(99, score),
                reason: `Found via keyword search`,
                affiliation: p.source || 'Oxford Network'
              };
            }).sort((a,b) => b.score - a.score).slice(0, 8);
          } else {
            // Phase 5: Rank candidates via Kimi
            log(`[external] Phase 5: Ranking ${withDescriptions.length} candidates via Kimi`);
            const candidates = withDescriptions.slice(0, 10);
            const rankPrompt = `Query: "${query}"

Candidates:
${candidates.map((p, i) => `${i}: ${p.full_name} — ${p.description.slice(0, 300)}`).join('\n')}

Return JSON array:
[{ "index": 0, "score": 85, "reason": "..." }, ...]
Score 0–100. Include all ${candidates.length} candidates.`;

            log(`[external] Calling Kimi for ranking`);
            const rankResponse = await kimi.chat.completions.create({
              model: KIMI_DEPLOYMENT,
              messages: [{
                role: 'system',
                content: 'You rank candidates by relevance to a search query. Output only valid JSON.'
              }, {
                role: 'user',
                content: rankPrompt
              }],
              response_format: { type: 'json_object' },
              temperature: 0.1,
              max_tokens: 512,
            });
            log(`[external] Kimi ranking response received`);

            let rankings = safeParseJson(rankResponse.choices?.[0]?.message?.content || '[]') || [];
            if (!Array.isArray(rankings) && rankings.rankings) {
              rankings = rankings.rankings;
            }
            log(`[external] Parsed ${rankings.length} rankings`);

            matches = (Array.isArray(rankings) ? rankings : [])
              .filter(r => r.index >= 0 && r.index < candidates.length)
              .sort((a, b) => b.score - a.score)
              .slice(0, 5)
              .map(r => ({
                ...candidates[r.index],
                is_on_app: false,
                source: 'people_db',
                score: r.score || 50,
                reason: r.reason || 'Matched via network search',
                affiliation: 'Oxford Network',
              }));

            if (matches.length === 0) {
              matches = candidates.slice(0, 5).map(p => ({
                ...p,
                is_on_app: false,
                source: 'people_db',
                score: 60,
                reason: 'Selected from network',
                affiliation: 'Oxford Network',
              }));
            }
          }
        } catch (err) {
          log(`External search error: ${err.message}`);
          Sentry.captureException(err, { tags: { context: 'external_search' }, level: 'warning' });
          matches = [];
        }

      } else if (variant === 'semantic_only') {
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

        const results = await qdrant.search(COLLECTION, request);

        matches = applyStructuredScoring(results.map((r) => ({
          ...r.payload,
          source: 'in-app',
          retrieval_variant: variant,
          score: Math.round(r.score * 100),
          semantic_pct: Math.round(r.score * 100),
          intent_pct: 0,
          applied_filters: summarizeFilter(translated.filters, translated.must_not),
          match_reason: buildMatchReason(r.payload || {}, translated, query),
        })), { type: 'search', translated, originalQuery: query });
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

        const results = await qdrant.search(COLLECTION, request);

        matches = applyStructuredScoring(results.map((r) => ({
          ...r.payload,
          source: 'in-app',
          retrieval_variant: variant,
          score: Math.round(r.score * 100),
          semantic_pct: 0,
          intent_pct: Math.round(r.score * 100),
          applied_filters: summarizeFilter(translated.filters, translated.must_not),
          match_reason: buildMatchReason(r.payload || {}, translated, query),
        })), { type: 'search', translated, originalQuery: query });
      } else {
        log(`[hybrid] Embedding both semantic and intent queries with Gemini`);
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
        log(`[hybrid] Embeddings created: semantic dim=${semanticVector.length}, intent dim=${intentVector.length}`);

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

        // Don't apply filters directly to Qdrant — rely on structured scoring instead
        // This avoids Bad Request errors when filter values don't exist in the collection
        // qdrantFilter is still used by applyStructuredScoring for ranking

        log(`[hybrid] Qdrant requests: semantic_threshold=${semanticRequest.score_threshold}, intent_threshold=${intentRequest.score_threshold}, hasFilter=${!!qdrantFilter}`);
        log(`[hybrid] Filters applied to scoring (not Qdrant): ${JSON.stringify(translated.filters)}`);
        log(`[hybrid] Qdrant will return all results; structured scoring will rank them`);
        log(`[hybrid] Semantic request keys: ${Object.keys(semanticRequest).join(', ')}`);
        log(`[hybrid] Intent request keys: ${Object.keys(intentRequest).join(', ')}`);
        log(`[hybrid] Semantic request: ${JSON.stringify(semanticRequest).slice(0, 300)}...`);
        log(`[hybrid] Intent request: ${JSON.stringify(intentRequest).slice(0, 300)}...`);

        const [semanticRes, intentRes] = await Promise.all([
          qdrant.search(COLLECTION, semanticRequest),
          qdrant.search(COLLECTION, intentRequest),
        ]);
        log(`[hybrid] Qdrant search completed: semantic results=${semanticRes.length}, intent results=${intentRes.length}`);

        matches = applyStructuredScoring(fuseResults(intentRes, semanticRes, null, {
          limit: 8,
          semanticWeight: SEMANTIC_WEIGHT,
          intentWeight: INTENT_WEIGHT,
        }), { type: 'search', translated, originalQuery: query }).map((match) => ({
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

      log(`[search] Returned ${matches.length} results, variant=${variant}, translator=${translated.translator}, elapsed=${metadata.total_ms}ms`);
      if (matches.length === 0) {
        log(`[search] WARNING: No matches found for query="${query}"`);
      }
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
