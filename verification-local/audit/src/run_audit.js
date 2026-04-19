import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client, Query, TablesDB } from 'node-appwrite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const LOGS_DIR = path.join(ROOT, 'logs');
const STATE_DIR = path.join(ROOT, 'state');
const STATE_FILE = path.join(STATE_DIR, 'non_findable_state.json');
const ORG_HINT_WORDS = [
  'society',
  'club',
  'association',
  'conference',
  'foundation',
  'company',
  'group',
  'university',
  'college',
  'press',
  'podcast',
  'events',
  'media',
  'service',
  'project',
  'team',
  'labs',
  'laboratory',
  'restaurant',
  'cafe',
  'soc',
];

const cfg = {
  endpoint: process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1',
  projectId: process.env.APPWRITE_PROJECT_ID || '69de7f335c0489352ff1',
  apiKey: process.env.APPWRITE_API_KEY || '',
  databaseId: process.env.APPWRITE_DB_ID || 'supercharged',
  peopleTable: process.env.APPWRITE_PEOPLE_TABLE || 'people',
  peopleSocietiesTable: process.env.APPWRITE_PEOPLE_SOCIETIES_TABLE || 'people_societies',
  peopleSportsTable: process.env.APPWRITE_PEOPLE_SPORTS_TABLE || 'people_sports',
  societiesTable: process.env.APPWRITE_SOCIETIES_TABLE || 'societies',
  sportsTable: process.env.APPWRITE_SPORTS_TABLE || 'sports',
  searxngUrl: process.env.SEARXNG_URL || 'http://localhost:8080',
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  model: process.env.DEFAULT_AUDIT_MODEL || 'gemma4:e2b-it-q4_K_M',
  classifierModel: process.env.CLASSIFIER_MODEL || 'qwen2.5:0.5b',
  ollamaTimeoutMs: Number.parseInt(process.env.OLLAMA_TIMEOUT_MS || '180000', 10),
  classifierTimeoutMs: Number.parseInt(process.env.CLASSIFIER_TIMEOUT_MS || '25000', 10),
  searxngTimeoutMs: Number.parseInt(process.env.SEARXNG_TIMEOUT_MS || '15000', 10),
  maxModelOutputTokens: Number.parseInt(process.env.MAX_MODEL_OUTPUT_TOKENS || '220', 10),
  minKeepConfidence: Number.parseFloat(process.env.MIN_KEEP_CONFIDENCE || '0.70'),
  minIdentityKeepScore: Number.parseFloat(process.env.MIN_IDENTITY_KEEP_SCORE || '0.72'),
  minOxfordKeepScore: Number.parseFloat(process.env.MIN_OXFORD_KEEP_SCORE || '0.58'),
  minIdentityReviewScore: Number.parseFloat(process.env.MIN_IDENTITY_REVIEW_SCORE || '0.50'),
  minOxfordReviewScore: Number.parseFloat(process.env.MIN_OXFORD_REVIEW_SCORE || '0.35'),
  maxDeleteIdentityScore: Number.parseFloat(process.env.MAX_DELETE_IDENTITY_SCORE || '0.38'),
  maxDeleteOxfordScore: Number.parseFloat(process.env.MAX_DELETE_OXFORD_SCORE || '0.20'),
  deleteAfterFailedPasses: Number.parseInt(process.env.DELETE_AFTER_FAILED_PASSES || '2', 10),
  searchResultsLimit: Number.parseInt(process.env.SEARCH_RESULTS_LIMIT || '5', 10),
  maxPeopleLimit: Number.parseInt(process.env.MAX_PEOPLE_LIMIT || '0', 10),
};

function parseArgs(argv) {
  const args = {
    dryRun: false,
    limit: cfg.maxPeopleLimit || 0,
    personId: '',
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg === '--limit') {
      const value = Number.parseInt(argv[i + 1] || '0', 10);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error('Invalid --limit value');
      }
      args.limit = value;
      i += 1;
      continue;
    }
    if (arg === '--person-id') {
      args.personId = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function extractJsonObject(text) {
  if (!text || typeof text !== 'string') return null;
  const direct = safeJsonParse(text, null);
  if (direct && typeof direct === 'object') return direct;

  const stripped = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  const start = stripped.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < stripped.length; i += 1) {
    const ch = stripped[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return safeJsonParse(stripped.slice(start, i + 1), null);
      }
    }
  }

  return null;
}

function extractLooseModelObject(text) {
  if (!text || typeof text !== 'string') return null;

  const findNumber = (key) => {
    const re = new RegExp(`"${key}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, 'i');
    const m = text.match(re);
    if (!m) return undefined;
    const value = Number.parseFloat(m[1]);
    return Number.isFinite(value) ? value : undefined;
  };

  const findBool = (key) => {
    const re = new RegExp(`"${key}"\\s*:\\s*(true|false)`, 'i');
    const m = text.match(re);
    if (!m) return undefined;
    return m[1].toLowerCase() === 'true';
  };

  const findString = (key) => {
    const re = new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)"`, 'i');
    const m = text.match(re);
    if (!m) return undefined;
    return normalizeString(m[1].replace(/\\"/g, '"').replace(/\\n/g, ' '));
  };

  const parsed = {};

  const knownNumberKeys = [
    'identity_match_score',
    'oxford_affiliation_score',
    'confidence',
  ];
  for (const key of knownNumberKeys) {
    const value = findNumber(key);
    if (value !== undefined) parsed[key] = value;
  }

  const knownBoolKeys = [
    'found_linkedin',
    'is_person',
  ];
  for (const key of knownBoolKeys) {
    const value = findBool(key);
    if (value !== undefined) parsed[key] = value;
  }

  const knownStringKeys = [
    'linkedin_url',
    'summary',
    'decision',
    'rationale',
    'reason',
  ];
  for (const key of knownStringKeys) {
    const value = findString(key);
    if (value !== undefined) parsed[key] = value;
  }

  const signalsBlock = text.match(/"signals"\s*:\s*\[([\s\S]*?)\]/i);
  if (signalsBlock) {
    const signals = Array.from(signalsBlock[1].matchAll(/"([\s\S]*?)"/g))
      .map((m) => normalizeString((m[1] || '').replace(/\\"/g, '"').replace(/\\n/g, ' ')))
      .filter(Boolean)
      .slice(0, 8);
    if (signals.length > 0) parsed.signals = signals;
  }

  return Object.keys(parsed).length > 0 ? parsed : null;
}

async function ensureRuntimeDirs() {
  await fs.mkdir(LOGS_DIR, { recursive: true });
  await fs.mkdir(STATE_DIR, { recursive: true });
}

async function loadState() {
  const text = await fs.readFile(STATE_FILE, 'utf8').catch(() => '{}');
  const data = safeJsonParse(text, {});
  return (data && typeof data === 'object') ? data : {};
}

async function saveState(state) {
  const payload = JSON.stringify(state, null, 2);
  await fs.writeFile(STATE_FILE, payload, 'utf8');
}

function appwriteClient() {
  if (!cfg.apiKey) {
    throw new Error('APPWRITE_API_KEY is required for audit execution');
  }

  const client = new Client()
    .setEndpoint(cfg.endpoint)
    .setProject(cfg.projectId)
    .setKey(cfg.apiKey);

  return new TablesDB(client);
}

async function listRowsAll(tables, tableId, queries = []) {
  const out = [];
  let offset = 0;
  const pageSize = 100;

  while (true) {
    const page = await tables.listRows({
      databaseId: cfg.databaseId,
      tableId,
      queries: [...queries, Query.limit(pageSize), Query.offset(offset)],
    });

    const rows = page.rows || [];
    out.push(...rows);

    if (rows.length < pageSize) break;
    offset += rows.length;
  }

  return out;
}

async function buildMapById(tables, tableId) {
  const rows = await listRowsAll(tables, tableId, [Query.limit(100)]);
  const map = new Map();
  for (const row of rows) {
    map.set(row.$id, row);
  }
  return map;
}

async function getPeopleRows(tables, args) {
  if (args.personId) {
    const row = await tables.getRow({
      databaseId: cfg.databaseId,
      tableId: cfg.peopleTable,
      rowId: args.personId,
    });
    return [row];
  }

  const rows = await listRowsAll(tables, cfg.peopleTable);
  if (args.limit > 0) {
    return rows.slice(0, args.limit);
  }
  return rows;
}

async function getGroupContext(tables, personId, societiesMap, sportsMap) {
  const [socRows, sportRows] = await Promise.all([
    listRowsAll(tables, cfg.peopleSocietiesTable, [Query.equal('person_id', personId)]),
    listRowsAll(tables, cfg.peopleSportsTable, [Query.equal('person_id', personId)]),
  ]);

  const societyNames = socRows
    .map((row) => societiesMap.get(row.society_id)?.name || '')
    .map(normalizeString)
    .filter(Boolean)
    .slice(0, 3);

  const sportNames = sportRows
    .map((row) => sportsMap.get(row.sport_id)?.name || '')
    .map(normalizeString)
    .filter(Boolean)
    .slice(0, 3);

  return {
    societies: societyNames,
    sports: sportNames,
  };
}

function buildSearchQuery(person, groupContext) {
  const name = normalizeString(person.full_name || person.username || person.normalized_name || '');
  const hints = [
    ...groupContext.societies.map((s) => `${s} society`),
    ...groupContext.sports.map((s) => `${s} sport`),
  ].slice(0, 2);

  const hintSuffix = hints.length ? ` ${hints.join(' ')}` : '';
  return `site:linkedin.com ${name}${hintSuffix} Oxford University`;
}

function buildSearchQueries(person, groupContext) {
  const name = normalizeString(person.full_name || person.username || person.normalized_name || '');
  const username = normalizeString(person.username).replace(/^@+/, '');
  const hint = normalizeString(groupContext.societies[0] || groupContext.sports[0] || '');
  const queries = [
    `site:linkedin.com/in "${name}"`,
    `"${name}" linkedin`,
    `"${name}" linkedin oxford`,
    hint ? `"${name}" "${hint}" linkedin` : '',
    username ? `site:linkedin.com/in ${username}` : '',
    username ? `${username} linkedin` : '',
  ].map(normalizeString).filter(Boolean);

  return Array.from(new Set(queries));
}

async function searchWeb(query) {
  const url = `${cfg.searxngUrl}/search?format=json&language=en&q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), cfg.searxngTimeoutMs);
  let response;

  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`SearXNG timeout after ${cfg.searxngTimeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`SearXNG error ${response.status}`);
  }

  const data = await response.json();
  const results = Array.isArray(data.results) ? data.results : [];
  return results.slice(0, cfg.searchResultsLimit).map((r) => ({
    title: normalizeString(r.title),
    url: normalizeString(r.url),
    content: normalizeString(r.content),
  }));
}

async function searchWebWithFallback(queries) {
  const merged = [];
  const seen = new Set();
  const attempted = [];

  for (let i = 0; i < queries.length; i += 1) {
    const query = queries[i];
    console.log(`  → Search attempt ${i + 1}/${queries.length}: "${query}"`);

    const results = await searchWeb(query);
    attempted.push({ query, count: results.length });
    console.log(`  → Attempt ${i + 1} returned ${results.length} results`);

    for (const result of results) {
      const key = normalizeString(result.url).toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(result);
    }

    if (merged.length >= cfg.searchResultsLimit) break;
  }

  return {
    results: merged.slice(0, cfg.searchResultsLimit),
    attempted,
  };
}

function heuristicEntityClassification(person) {
  const name = normalizeString(person.full_name || person.username || person.normalized_name || '');
  const lower = name.toLowerCase();

const hasOrgHint = ORG_HINT_WORDS.some((word) => lower.includes(word));
  const hasComma = name.includes(',');
  const longTokens = name.split(/\s+/).filter(Boolean).length >= 5;

  if (hasOrgHint || hasComma || longTokens) {
    return {
      is_person: false,
      confidence: 0.7,
      reason: 'Heuristic non-person pattern',
    };
  }

  return {
    is_person: true,
    confidence: 0.55,
    reason: 'Heuristic fallback uncertain but person-like',
  };
}

function isLikelyPersonName(person) {
  const name = normalizeString(person.full_name || person.username || person.normalized_name || '');
  if (!name) return false;

  const lower = name.toLowerCase();
  if (ORG_HINT_WORDS.some((word) => lower.includes(word))) return false;

  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length >= 1 && tokens.length <= 4) {
    const hasAlphaLike = tokens.some((token) => /\p{L}/u.test(token));
    if (hasAlphaLike) return true;
  }

  return false;
}

function bestLinkedinFromResults(results) {
  const linkedIn = results.find((r) => /linkedin\.com\/(in|pub)\//i.test(r.url));
  return linkedIn ? linkedIn.url : '';
}

function domainFromUrl(url) {
  const safeUrl = normalizeString(url);
  if (!safeUrl) return '';
  try {
    const hasScheme = /^https?:\/\//i.test(safeUrl);
    const parsed = new URL(hasScheme ? safeUrl : `https://${safeUrl}`);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function normalizeEvidenceArray(items, limit = 8) {
  if (!Array.isArray(items)) return [];
  return items
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const source = normalizeString(entry.source || entry.url);
      const domain = normalizeString(entry.domain) || domainFromUrl(source);
      const snippet = normalizeString(entry.snippet || entry.rationale || entry.note);
      if (!source && !snippet) return null;
      return {
        source,
        domain,
        snippet,
      };
    })
    .filter(Boolean)
    .slice(0, limit);
}

function auditPrompt(person, groupContext, results) {
  const name = normalizeString(person.full_name || person.username || person.normalized_name || 'Unknown');
  const resultsText = results.map((r, i) => {
    return `Result ${i + 1}:\nTitle: ${r.title}\nURL: ${r.url}\nSnippet: ${r.content}`;
  }).join('\n\n');

  return `You are auditing whether this person is a real individual and has credible Oxford affiliation evidence.
Return JSON only with this exact schema:
{
  "identity_match_score": 0.0,
  "oxford_affiliation_score": 0.0,
  "found_linkedin": true,
  "linkedin_url": "",
  "identity_evidence": [
    {"source": "", "domain": "", "snippet": ""}
  ],
  "oxford_evidence": [
    {"source": "", "domain": "", "snippet": ""}
  ],
  "summary": "",
  "confidence": 0.0,
  "signals": [""],
  "decision": "keep",
  "rationale": ""
}

Rules:
- decision must be one of: "keep", "needs_review", "delete_candidate".
- identity_match_score and oxford_affiliation_score must be 0-1.
- confidence should reflect overall certainty, not only LinkedIn quality.
- LinkedIn is only one source. Do not treat any LinkedIn hit as sufficient proof of Oxford affiliation.
- If evidence is mixed or incomplete, choose needs_review.
- Only choose delete_candidate when both identity and Oxford evidence are weak.
- summary must be 60-140 words only when decision is keep or needs_review; empty for delete_candidate.
- Prefer direct profile/page URLs in evidence arrays.

Candidate:
- Name: ${name}
- Username: ${normalizeString(person.username)}
- Existing profile URL: ${normalizeString(person.profile_url)}
- Societies: ${groupContext.societies.join(', ') || 'None'}
- Sports: ${groupContext.sports.join(', ') || 'None'}

Search evidence:
${resultsText || 'No results'}
`;
}

async function runModel(promptText) {
  return ollamaJsonCall({
    model: cfg.model,
    promptText,
    label: 'Main model',
    timeoutMs: cfg.ollamaTimeoutMs,
  });
}

async function classifyPersonEntity(person) {
  const displayName = normalizeString(person.full_name || person.username || person.normalized_name || 'unknown');
  const promptText = `Classify whether this entry is a real human individual person.
Return JSON only:
{
  "is_person": true,
  "confidence": 0.0,
  "reason": ""
}

Entry:
- full_name: ${normalizeString(person.full_name)}
- username: ${normalizeString(person.username)}
- normalized_name: ${normalizeString(person.normalized_name)}

Rules:
- If this appears to be an organization, club, society, event, business, publication, or institution, set is_person=false.
- Be strict. We only want people.
`;

  try {
    const parsed = await ollamaJsonCall({
      model: cfg.classifierModel,
      promptText,
      label: 'Entity classifier',
      timeoutMs: cfg.classifierTimeoutMs,
      maxTokens: 80,
      temperature: 0,
    });

    const parsedConfidence = Number.isFinite(Number(parsed?.confidence))
      ? Math.max(0, Math.min(1, Number(parsed.confidence)))
      : 0;
    const parsedIsPerson = Boolean(parsed?.is_person);
    const likelyPerson = isLikelyPersonName(person);
    const hasStrongOrgHint = ORG_HINT_WORDS.some((word) => displayName.toLowerCase().includes(word));

    // Conservative calibration: only auto-reject as non-person when evidence is strong.
    const finalIsPerson = parsedIsPerson || likelyPerson || !(parsedConfidence >= 0.85 && hasStrongOrgHint);

    return {
      is_person: finalIsPerson,
      confidence: parsedConfidence,
      reason: normalizeString(parsed?.reason) || 'Classifier result',
      source: 'llm',
      name: displayName,
    };
  } catch (err) {
    const fallback = heuristicEntityClassification(person);
    return {
      ...fallback,
      source: 'heuristic_fallback',
      reason: `${fallback.reason}; classifier_error=${err.message}`,
      name: displayName,
    };
  }
}

async function ollamaJsonCall({
  model,
  promptText,
  label,
  timeoutMs,
  maxTokens = cfg.maxModelOutputTokens,
  temperature = 0.1,
}) {
  const payload = {
    model,
    stream: false,
    format: 'json',
    think: false,
    options: {
      temperature,
      num_predict: maxTokens,
    },
    messages: [
      { role: 'system', content: 'You are a strict JSON audit agent. Return JSON only. Do not include thinking.' },
      { role: 'user', content: promptText },
    ],
  };

  console.log(`  → Calling ${label} (${model})...`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${cfg.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${label} error ${response.status}`);
    }

    const requestMs = Date.now() - startedAt;
    console.log(`  → ${label} response received in ${requestMs}ms`);
    console.log(`  → Parsing ${label} response...`);
    const data = await response.json();
    const text = data?.message?.content || '';
    console.log(`  → Response length: ${text.length} chars`);
    
    const parsed = extractJsonObject(text);
    if (!parsed) {
      const loose = extractLooseModelObject(text);
      if (loose) {
        console.log(`  → JSON fallback parse succeeded for ${label}`);
        return loose;
      }
      console.log(`  → Raw response: ${text.slice(0, 200)}`);
      throw new Error(`${label} returned non-JSON output`);
    }

    console.log(`  → JSON parsed from ${label}`);
    return parsed;
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`${label} timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeDecision(raw, results) {
  const fallbackLinkedin = bestLinkedinFromResults(results);
  const foundLinkedin = Boolean(raw?.found_linkedin) || Boolean(fallbackLinkedin);
  const linkedin = normalizeString(raw?.linkedin_url) || fallbackLinkedin;
  const confidenceRaw = Number.parseFloat(String(raw?.confidence ?? 0));
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0;
  const signals = Array.isArray(raw?.signals) ? raw.signals.map(normalizeString).filter(Boolean).slice(0, 8) : [];
  const summary = normalizeString(raw?.summary);
  const rationale = normalizeString(raw?.rationale);
  const identityEvidence = normalizeEvidenceArray(raw?.identity_evidence);
  const oxfordEvidence = normalizeEvidenceArray(raw?.oxford_evidence);

  const identityRaw = Number.parseFloat(String(raw?.identity_match_score ?? 0));
  const identityScore = Number.isFinite(identityRaw) ? Math.max(0, Math.min(1, identityRaw)) : 0;

  const oxfordRaw = Number.parseFloat(String(raw?.oxford_affiliation_score ?? 0));
  const oxfordScore = Number.isFinite(oxfordRaw) ? Math.max(0, Math.min(1, oxfordRaw)) : 0;

  const hasCredibleLinkedin = foundLinkedin && /linkedin\.com\/(in|pub)\//i.test(linkedin);

  let decision = normalizeString(raw?.decision).toLowerCase();
  if (!['keep', 'needs_review', 'delete_candidate'].includes(decision)) {
    if (
      identityScore >= cfg.minIdentityKeepScore &&
      oxfordScore >= cfg.minOxfordKeepScore &&
      confidence >= cfg.minKeepConfidence
    ) {
      decision = 'keep';
    } else if (
      identityScore <= cfg.maxDeleteIdentityScore &&
      oxfordScore <= cfg.maxDeleteOxfordScore &&
      !hasCredibleLinkedin
    ) {
      decision = 'delete_candidate';
    } else {
      decision = 'needs_review';
    }
  }

  if (decision === 'keep' && (identityScore < cfg.minIdentityKeepScore || oxfordScore < cfg.minOxfordKeepScore)) {
    decision = 'needs_review';
  }

  if (decision === 'delete_candidate' && (
    identityScore >= cfg.minIdentityReviewScore ||
    oxfordScore >= cfg.minOxfordReviewScore ||
    hasCredibleLinkedin
  )) {
    decision = 'needs_review';
  }

  return {
    identity_match_score: identityScore,
    oxford_affiliation_score: oxfordScore,
    found_linkedin: foundLinkedin,
    linkedin_url: linkedin,
    identity_evidence: identityEvidence,
    oxford_evidence: oxfordEvidence,
    summary: (decision === 'keep' || decision === 'needs_review') ? summary : '',
    confidence,
    signals,
    decision,
    rationale,
  };
}

async function updatePersonKeep(tables, personId, normalizedDecision, dryRun) {
  const payload = {
    linkedin_url: normalizedDecision.linkedin_url || null,
    description: normalizedDecision.summary || null,
    is_enriched: true,
    last_enriched_at: new Date().toISOString(),
  };

  if (dryRun) return;

  await tables.updateRow({
    databaseId: cfg.databaseId,
    tableId: cfg.peopleTable,
    rowId: personId,
    data: payload,
  });
}

async function deleteJoinRowsByPerson(tables, tableId, personId, dryRun) {
  const rows = await listRowsAll(tables, tableId, [Query.equal('person_id', personId)]);
  if (dryRun) return rows.length;

  for (const row of rows) {
    await tables.deleteRow({
      databaseId: cfg.databaseId,
      tableId,
      rowId: row.$id,
    });
  }

  return rows.length;
}

async function deletePersonCascade(tables, personId, dryRun) {
  const deletedSocieties = await deleteJoinRowsByPerson(tables, cfg.peopleSocietiesTable, personId, dryRun);
  const deletedSports = await deleteJoinRowsByPerson(tables, cfg.peopleSportsTable, personId, dryRun);

  if (!dryRun) {
    await tables.deleteRow({
      databaseId: cfg.databaseId,
      tableId: cfg.peopleTable,
      rowId: personId,
    });
  }

  return { deletedSocieties, deletedSports };
}

function updateNonFindableState(state, personId, meta) {
  const existing = state[personId] || { failCount: 0 };
  state[personId] = {
    failCount: Number(existing.failCount || 0) + 1,
    lastSeenAt: new Date().toISOString(),
    lastReason: meta.reason || 'no linkedin evidence',
    lastConfidence: meta.confidence,
    lastQuery: meta.query,
  };
  return state[personId];
}

function clearNonFindableState(state, personId) {
  delete state[personId];
}

async function writeReport(report) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(LOGS_DIR, `audit-report-${stamp}.json`);
  await fs.writeFile(file, JSON.stringify(report, null, 2), 'utf8');
  return file;
}

async function main() {
  const args = parseArgs(process.argv);
  await ensureRuntimeDirs();

  const state = await loadState();
  const tables = appwriteClient();

  const [societiesMap, sportsMap] = await Promise.all([
    buildMapById(tables, cfg.societiesTable),
    buildMapById(tables, cfg.sportsTable),
  ]);

  const people = await getPeopleRows(tables, args);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Starting Audit');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Mode:     ${args.dryRun ? 'DRY RUN (no changes)' : 'PRODUCTION (will modify DB)'}`);
  console.log(`  People:   ${people.length}`);
  console.log(`  Model:    ${cfg.model}`);
  console.log(`  Classifier model: ${cfg.classifierModel}`);
  console.log(`  Confidence threshold: ${(cfg.minKeepConfidence * 100).toFixed(0)}%`);
  console.log(`  Timeouts: searxng=${cfg.searxngTimeoutMs}ms classifier=${cfg.classifierTimeoutMs}ms model=${cfg.ollamaTimeoutMs}ms`);
  console.log('');

  const report = {
    startedAt: new Date().toISOString(),
    dryRun: args.dryRun,
    model: cfg.model,
    minKeepConfidence: cfg.minKeepConfidence,
    deleteAfterFailedPasses: cfg.deleteAfterFailedPasses,
    total: people.length,
    keep: 0,
    needsReview: 0,
    deleteCandidates: 0,
    deleted: 0,
    errors: 0,
    records: [],
  };

  for (let i = 0; i < people.length; i += 1) {
    const person = people[i];
    const rowNum = i + 1;
    const record = {
      person_id: person.$id,
      full_name: normalizeString(person.full_name),
      action: 'none',
    };

    try {
      console.log(`[${rowNum}/${report.total}] Processing ${normalizeString(person.full_name || person.username || 'unknown')}...`);

      console.log('  → Pre-audit entity classification...');
      const entity = await classifyPersonEntity(person);
      record.entity_check = entity;
      console.log(`  → Entity result: is_person=${entity.is_person} confidence=${(entity.confidence * 100).toFixed(0)}% source=${entity.source}`);

      if (!entity.is_person) {
        report.deleteCandidates += 1;
        const failState = updateNonFindableState(state, person.$id, {
          reason: `non-person entity (${entity.reason})`,
          confidence: entity.confidence,
          query: 'skipped_non_person',
        });
        record.fail_count = failState.failCount;
        record.action = 'non_person_auto_remove_candidate';
        record.error = null;
        console.log(`  ↷ Skipping search/model pipeline: classified as non-person (${entity.reason})`);

        if (failState.failCount >= cfg.deleteAfterFailedPasses) {
          const cascade = await deletePersonCascade(tables, person.$id, args.dryRun);
          clearNonFindableState(state, person.$id);
          report.deleted += 1;
          record.action = args.dryRun ? 'non_person_delete_dry_run' : 'non_person_deleted';
          record.deleted_joins = cascade;
          console.log(`  ✗ DELETE (non-person, pass ${failState.failCount})`);
        }

        report.records.push(record);
        continue;
      }
      
      const groupContext = await getGroupContext(tables, person.$id, societiesMap, sportsMap);
      const query = buildSearchQuery(person, groupContext);
      const searchQueries = buildSearchQueries(person, groupContext);
      
      console.log(`  → Primary query: "${query}"`);
      const searchOutcome = await searchWebWithFallback(searchQueries);
      const results = searchOutcome.results;
      console.log(`  → Final merged results: ${results.length}`);
      
      const modelRaw = await runModel(auditPrompt(person, groupContext, results));
      const normalized = normalizeDecision(modelRaw, results);

      record.query = query;
      record.search_attempts = searchOutcome.attempted;
      record.signals = normalized.signals;
      record.confidence = normalized.confidence;
      record.identity_match_score = normalized.identity_match_score;
      record.oxford_affiliation_score = normalized.oxford_affiliation_score;
      record.linkedin_url = normalized.linkedin_url;
      record.identity_evidence = normalized.identity_evidence;
      record.oxford_evidence = normalized.oxford_evidence;
      record.rationale = normalized.rationale;

      if (normalized.decision === 'keep') {
        await updatePersonKeep(tables, person.$id, normalized, args.dryRun);
        clearNonFindableState(state, person.$id);
        report.keep += 1;
        record.action = args.dryRun ? 'keep_dry_run' : 'keep';
        record.summary_written = Boolean(normalized.summary);
        console.log(`  ✓ KEEP: id=${normalized.identity_match_score.toFixed(2)} oxford=${normalized.oxford_affiliation_score.toFixed(2)} conf=${(normalized.confidence * 100).toFixed(0)}% url=${normalized.linkedin_url || 'none'}`);
      } else if (normalized.decision === 'needs_review') {
        clearNonFindableState(state, person.$id);
        report.needsReview += 1;
        record.action = 'needs_review';
        record.summary_written = Boolean(normalized.summary);
        console.log(`  ~ NEEDS REVIEW: id=${normalized.identity_match_score.toFixed(2)} oxford=${normalized.oxford_affiliation_score.toFixed(2)} conf=${(normalized.confidence * 100).toFixed(0)}%`);
      } else {
        report.deleteCandidates += 1;
        const failState = updateNonFindableState(state, person.$id, {
          reason: normalized.rationale || normalized.signals[0] || 'weak identity and oxford evidence',
          confidence: normalized.confidence,
          query,
        });

        record.fail_count = failState.failCount;
        record.action = 'marked_delete_candidate';

        if (failState.failCount >= cfg.deleteAfterFailedPasses) {
          const cascade = await deletePersonCascade(tables, person.$id, args.dryRun);
          clearNonFindableState(state, person.$id);
          report.deleted += 1;
          record.action = args.dryRun ? 'delete_dry_run' : 'deleted';
          record.deleted_joins = cascade;
          console.log(`  ✗ DELETE (pass ${failState.failCount}): ${normalized.signals.slice(0, 2).join(' | ') || 'no linkedin evidence'}`);
        } else {
          console.log(`  ? CANDIDATE DELETE (pass ${failState.failCount}/${cfg.deleteAfterFailedPasses}): ${normalized.signals.slice(0, 2).join(' | ') || 'no linkedin evidence'}`);
        }
      }
    } catch (err) {
      report.errors += 1;
      record.action = 'error';
      record.error = err.message;
      console.log(`  ✗ ERROR: ${err.message}`);
    }

    report.records.push(record);
  }

  report.finishedAt = new Date().toISOString();
  await saveState(state);
  const reportFile = await writeReport(report);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('AUDIT COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Processed: ${report.total}`);
  console.log(`  Keep:      ${report.keep}`);
  console.log(`  Needs review: ${report.needsReview}`);
  console.log(`  Delete (candidate): ${report.deleteCandidates}`);
  console.log(`  Deleted:   ${report.deleted}`);
  console.log(`  Errors:    ${report.errors}`);
  console.log(`  Mode:      ${report.dryRun ? 'DRY RUN (no writes)' : 'PRODUCTION (writes applied)'}`);
  console.log('');
  console.log(`Report saved: ${reportFile}`);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
