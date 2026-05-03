import { parseArgs } from 'util';

const cfg = {
  searxngUrl: process.env.SEARXNG_URL || 'http://127.0.0.1:8080',
  ollamaUrl:  process.env.OLLAMA_URL  || 'http://127.0.0.1:11434',
  model:      process.env.DEFAULT_AUDIT_MODEL || 'gemma4:e2b-it-q4_K_M',
  searchResultsLimit: 10,
};

// ──────────────────────────────────────────────────────────
// STAGE 1 — broad queries to build a description
// ──────────────────────────────────────────────────────────
function buildDescriptionQueries(name, username) {
  const queries = [
    `"${name}" oxford`,
    `${name} oxford university`,
    `${name} oxford student`,
    `${name} oxford society`,
  ];

  const parts = name.split(' ');
  if (parts.length > 2) {
    // first + last only variant
    queries.push(`"${parts[0]} ${parts[parts.length - 1]}" oxford`);
  }

  if (username && !/\d{3,}/.test(username)) {
    queries.push(`"${username}" oxford`);
    queries.push(`${username} oxford university`);
  }

  return queries;
}

// ──────────────────────────────────────────────────────────
// STAGE 2 — targeted LinkedIn search
// ──────────────────────────────────────────────────────────
function buildLinkedInQuery(name) {
  return `site:linkedin.com "${name}" "oxford"`;
}

// ──────────────────────────────────────────────────────────
// SearXNG helper
// ──────────────────────────────────────────────────────────
async function searchSearxng(query, limit = cfg.searchResultsLimit) {
  try {
    const url = `${cfg.searxngUrl}/search?format=json&language=en&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    return results.slice(0, limit).map(r => ({
      title:   r.title   || '',
      url:     r.url     || '',
      content: r.content || '',
    }));
  } catch (err) {
    console.error(`  [SearXNG error] ${err.message}`);
    return [];
  }
}

// ──────────────────────────────────────────────────────────
// LinkedIn URL validator
// ──────────────────────────────────────────────────────────
const LINKEDIN_RE = /^https?:\/\/([a-z]{2}\.)?linkedin\.com\/in\/[^/?#\s]+\/?/i;

function isLinkedInProfile(url) {
  return LINKEDIN_RE.test(url);
}

// ──────────────────────────────────────────────────────────
// LLM — describe the person
// ──────────────────────────────────────────────────────────
async function describeWithOllama(name, results) {
  // Label results with an explicit trust rank so the LLM weights them correctly
  const resultsText = results
    .map((r, i) => {
      const trust = i === 0
        ? '(MOST RELEVANT — highest trust)'
        : i <= 2
          ? `(rank ${i + 1} — high trust)`
          : i <= 5
            ? `(rank ${i + 1} — moderate trust, may be coincidental)`
            : `(rank ${i + 1} — low trust, treat with scepticism)`;
      return `[${i + 1}] ${trust}\n    URL: ${r.url}\n    Title: ${r.title}\n    Snippet: ${r.content}`;
    })
    .join('\n\n');

  const promptText = `You are an Oxford University student directory assistant. \
Your task is to identify whether "${name}" is a real Oxford student or alumnus, and if so, \
write a concise, factually grounded description of them.

IMPORTANT RULES:
1. RANKING: The results are ordered by relevance. Result [1] is the most trustworthy. \
Trust decays with each subsequent result — later results may be coincidental name matches \
or completely unrelated pages. Do NOT give equal weight to all results; prioritise early ones.
2. LOGICAL CONSISTENCY: Claims must be internally consistent. For example:
   - An undergraduate student in their first or second year is very unlikely to be leading research projects.
   - A student cannot simultaneously be described as both a DPhil researcher and a first-year undergrad.
   - If a result mentions a society or activity, only include it if it plausibly fits the person's stage.
3. RELEVANCE: Ignore any results that are clearly not about this specific person (e.g. generic \
company websites, unrelated academic papers, news articles about different people with a similar name).
4. HONESTY: If, after applying the above rules, you do not have enough reliable evidence that this \
person is an Oxford student or alumnus, set "found" to false. Do not speculate or fabricate details.

Return ONLY valid JSON in exactly this shape:
{
  "found": true,
  "description": "..."
}
or
{
  "found": false,
  "description": ""
}

Search results for "${name}":
${resultsText}`;

  try {
    const res = await fetch(`${cfg.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        stream: false,
        format: 'json',
        messages: [{ role: 'user', content: promptText }],
      }),
      signal: AbortSignal.timeout(180000),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);
    const raw = data.message?.content || '';
    // Strip markdown code fences the model sometimes adds despite format:'json'
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    return { raw, parsed: JSON.parse(cleaned) };
  } catch (err) {
    return { raw: `[Error: ${err.message}]`, parsed: null };
  }
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
function hr(char = '━', len = 55) {
  console.log(char.repeat(len));
}

function banner(text) {
  hr();
  console.log(`  ${text}`);
  hr();
}

// ──────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────
async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      name:     { type: 'string' },
      username: { type: 'string', default: '' },
    },
  });

  if (!values.name) {
    console.error('Usage: node phase3.js --name "First Last" [--username handle]');
    process.exit(1);
  }

  const name     = values.name.trim();
  const username = (values.username || '').trim();

  console.log(`\nPhase 3 — Name: "${name}"${username ? ` | Username: "${username}"` : ''}`);
  console.log(`Model: ${cfg.model} | SearXNG: ${cfg.searxngUrl}\n`);

  // ── STAGE 1: gather broad results ────────────────────────
  banner('STAGE 1 — Broad search');

  const descQueries = buildDescriptionQueries(name, username);
  const allResults  = [];
  const seenUrls    = new Set();

  for (const query of descQueries) {
    console.log(`\nQuery: ${query}`);
    const results = await searchSearxng(query);
    console.log(`  → ${results.length} results`);

    for (const r of results) {
      if (!seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        allResults.push(r);
        console.log(`    [+] ${r.title.slice(0, 80)}`);
        console.log(`        ${r.url}`);
      }
    }
  }

  console.log(`\n  TOTAL UNIQUE RESULTS: ${allResults.length}`);

  if (allResults.length === 0) {
    console.log('\n  No results found. Cannot proceed. Done.\n');
    return;
  }

  // ── STAGE 1b: describe with LLM ──────────────────────────
  banner('STAGE 1b — LLM description');
  console.log(`  Sending ${allResults.length} results to ${cfg.model}…\n`);

  const { raw: descRaw, parsed: descParsed } = await describeWithOllama(name, allResults);

  console.log('  LLM raw response:');
  console.log(' ', descRaw);
  console.log();

  if (!descParsed) {
    console.log('  ❌ Failed to parse LLM response. Aborting.\n');
    return;
  }

  if (!descParsed.found) {
    console.log(`  ❌ LLM could not identify "${name}" as an Oxford person. Stopping.\n`);
    console.log(`  Description attempt: "${descParsed.description || '(empty)'}"\n`);
    return;
  }

  console.log(`  ✅ Person identified!\n  Description: ${descParsed.description}\n`);

  // ── STAGE 2: targeted LinkedIn search ────────────────────
  banner('STAGE 2 — LinkedIn search');

  const liQuery = buildLinkedInQuery(name);
  console.log(`\n  Query: ${liQuery}`);

  const liResults = await searchSearxng(liQuery, 5);

  console.log(`  → ${liResults.length} results`);
  liResults.forEach((r, i) => {
    console.log(`  [${i + 1}] ${r.url}`);
  });
  console.log();

  // take the top result and validate
  const topResult  = liResults[0];
  const linkedInUrl = topResult?.url || '';

  if (!linkedInUrl) {
    console.log('  ⚠️  No results returned for LinkedIn search.');
  } else if (!isLinkedInProfile(linkedInUrl)) {
    console.log(`  ❌ Top result is NOT a LinkedIn profile URL — rejected.`);
    console.log(`     Got: ${linkedInUrl}`);
  } else {
    console.log(`  ✅ LinkedIn profile found: ${linkedInUrl}`);
  }

  // ── Final summary ─────────────────────────────────────────
  banner('SUMMARY');
  console.log(`  Name:        ${name}`);
  console.log(`  Found:       ${descParsed.found ? 'Yes' : 'No'}`);
  console.log(`  Description: ${descParsed.description}`);
  console.log(`  LinkedIn:    ${isLinkedInProfile(linkedInUrl) ? linkedInUrl : '(none / rejected)'}`);
  hr();
  console.log();
}

main().catch(console.error);
