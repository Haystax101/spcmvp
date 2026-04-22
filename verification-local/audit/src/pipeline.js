import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client, Query, TablesDB } from 'node-appwrite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const LOGS_DIR = path.join(ROOT, 'logs');
const STATE_DIR = path.join(ROOT, 'state');

// Config
const cfg = {
  endpoint: process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1',
  projectId: process.env.APPWRITE_PROJECT_ID || '69de7f335c0489352ff1',
  apiKey: process.env.APPWRITE_API_KEY || '',
  databaseId: process.env.APPWRITE_DB_ID || 'supercharged',
  peopleTable: process.env.APPWRITE_PEOPLE_TABLE || 'people',
  peopleSocietiesTable: process.env.APPWRITE_PEOPLE_SOCIETIES_TABLE || 'people_societies',
  peopleSportsTable: process.env.APPWRITE_PEOPLE_SPORTS_TABLE || 'people_sports',
  searxngUrl: process.env.SEARXNG_URL || 'http://localhost:8080',
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  model: process.env.DEFAULT_AUDIT_MODEL || 'gemma4:e2b-it-q4_K_M',
  classifierModel: process.env.CLASSIFIER_MODEL || 'qwen2.5:0.5b',
  ollamaTimeoutMs: 180000,
  searxngTimeoutMs: 15000,
  searchResultsLimit: 5,
};

// Logging
async function logMessage(phase, msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [Phase ${phase}] ${msg}`;
  console.log(line);
  
  const logFile = path.join(LOGS_DIR, `pipeline_phase_${phase}_run.log`);
  try {
    await fs.appendFile(logFile, line + '\n', 'utf8');
  } catch (e) {}
}

async function ensureDirs() {
  await fs.mkdir(LOGS_DIR, { recursive: true }).catch(() => {});
  await fs.mkdir(STATE_DIR, { recursive: true }).catch(() => {});
}

// Appwrite
function getAppwrite() {
  if (!cfg.apiKey) throw new Error('APPWRITE_API_KEY is required');
  const client = new Client().setEndpoint(cfg.endpoint).setProject(cfg.projectId).setKey(cfg.apiKey);
  return new TablesDB(client);
}

async function fetchAllPeople(tables) {
  const out = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const page = await tables.listRows({
      databaseId: cfg.databaseId, tableId: cfg.peopleTable, 
      queries: [Query.limit(pageSize), Query.offset(offset)]
    });
    out.push(...page.rows);
    if (page.rows.length < pageSize) break;
    offset += page.rows.length;
  }
  return out;
}

// ============================================
// Phase 1: Structural Fast-Fail
// ============================================
async function runPhase1(tables, apply) {
  await logMessage(1, `Starting Phase 1: Structural DB Filter`);
  const people = await fetchAllPeople(tables);
  await logMessage(1, `Fetched ${people.length} people.`);

  let deletedCount = 0;

  // We could optimize by fetching all people_societies/sports, but for safety lets do batched queries.
  // Actually, fetching all cross-references into memory is much faster.
  await logMessage(1, `Fetching cross-references in memory...`);
  
  const [socRows, sportRows] = await Promise.all([
      fetchAllRows(tables, cfg.peopleSocietiesTable),
      fetchAllRows(tables, cfg.peopleSportsTable)
  ]);

  const countsMap = new Map();
  const addCount = (pid) => {
    if (!pid) return;
    countsMap.set(pid, (countsMap.get(pid) || 0) + 1);
  };

  socRows.forEach(r => addCount(r.person_id));
  sportRows.forEach(r => addCount(r.person_id));

  const toDelete = [];
  for (const person of people) {
    const total = countsMap.get(person.$id) || 0;
    if (total < 2) {
      toDelete.push(person.$id);
    }
  }

  await logMessage(1, `Found ${toDelete.length} / ${people.length} users with < 2 memberships.`);

  if (apply) {
    await logMessage(1, `Applying deletions...`);
    const batchSize = 10;
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = toDelete.slice(i, i + batchSize);
      await Promise.all(batch.map(async id => {
        try {
          await tables.deleteRow({ databaseId: cfg.databaseId, tableId: cfg.peopleTable, rowId: id });
        } catch (e) {
          await logMessage(1, `Error deleting ${id}: ${e.message}`);
        }
      }));
      if (i % 500 === 0) await logMessage(1, `  Deleted ${i}/${toDelete.length}`);
    }
    await logMessage(1, `Phase 1 Apply Complete.`);
  } else {
    await logMessage(1, `Dry run complete. Use --apply to execute deletions.`);
  }
}

async function fetchAllRows(tables, tableId) {
  const out = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const page = await tables.listRows({
      databaseId: cfg.databaseId, tableId, 
      queries: [Query.limit(pageSize), Query.offset(offset)]
    });
    out.push(...page.rows);
    if (page.rows.length < pageSize) break;
    offset += page.rows.length;
  }
  return out;
}

// ============================================
// Phase 2: Entity Classifier
// ============================================
async function runPhase2(tables, apply) {
  await logMessage(2, `Starting Phase 2: Entity Classifier`);
  const people = await fetchAllPeople(tables);
  await logMessage(2, `Processing ${people.length} users.`);

  let deletedCount = 0;
  const batchSize = 4; // Concurrency limit

  for (let i = 0; i < people.length; i += batchSize) {
    const batch = people.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async person => {
      const name = (person.full_name || person.username || person.normalized_name || '').trim();
      if (!name) return;

      const promptText = `Classify if this is a human individual or an organization. Return JSON: {"is_person": true/false}. Entry: ${name}`;
      
      try {
        const res = await classifyWithOllama(cfg.classifierModel, promptText);
        const isPerson = res.is_person !== false; // Default true on fail
        
        if (!isPerson) {
          await logMessage(2, `Found Non-Person: ${name}`);
          if (apply) {
             await tables.deleteRow({ databaseId: cfg.databaseId, tableId: cfg.peopleTable, rowId: person.$id });
             deletedCount++;
          }
        }
      } catch (err) {
        // Continue on error
      }
    }));
    if (i % 100 === 0) await logMessage(2, `Processed ${i}/${people.length}`);
  }

  await logMessage(2, `Phase 2 Complete. ${apply ? "Deleted" : "Would delete"} ${deletedCount} orgs.`);
}

// ============================================
// Phase 3 & 4: Search + Deep Profiling
// ============================================
async function runPhase3and4(tables, apply) {
  await logMessage(3, `Starting Heavyweight Audit (Phase 3 & 4)`);
  const people = await fetchAllPeople(tables);
  await logMessage(3, `Processing ${people.length} users.`);

  const batchSize = 2; // Strict concurrency to avoid RAM explosion

  for (let i = 0; i < people.length; i += batchSize) {
    const batch = people.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async person => {
      const name = (person.full_name || person.normalized_name || '').trim();
      if (!name) return;

      try {
        // Phase 3: Single-shot query
        const query = `"${name}" oxford uni`;
        await logMessage(3, `[${name}] Searching: ${query}`);
        const results = await searchSearxng(query);

        // Phase 4: Heavyweight verification
        const auditRes = await auditWithOllama(cfg.model, name, results);
        await logMessage(3, `[${name}] Decision: ${auditRes.decision} - LinkedIn: ${auditRes.found_linkedin}`);

        if (apply && auditRes.decision === 'delete_candidate') {
           await tables.deleteRow({ databaseId: cfg.databaseId, tableId: cfg.peopleTable, rowId: person.$id });
           await logMessage(3, `[${name}] Deleted.`);
        }
      } catch (err) {
        await logMessage(3, `[${name}] Error: ${err.message}`);
      }
    }));
  }

  await logMessage(3, `Heavyweight Audit Complete.`);
}

// Helpers
async function classifyWithOllama(model, text) {
   const res = await fetch(`${cfg.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
         model, stream: false, format: 'json',
         messages: [{role: 'user', content: text}]
      })
   });
   const data = await res.json();
   try { return JSON.parse(data.message.content); } catch { return { is_person: true }; }
}

async function searchSearxng(query) {
   const res = await fetch(`${cfg.searxngUrl}/search?format=json&language=en&q=${encodeURIComponent(query)}`);
   const data = await res.json();
   const results = Array.isArray(data.results) ? data.results : [];
   return results.slice(0, cfg.searchResultsLimit).map(r => ({title: r.title, content: r.content, url: r.url}));
}

async function auditWithOllama(model, name, results) {
   const resultsText = results.map(r => `URL: ${r.url}\nSnippet: ${r.content}`).join('\n\n');
   const promptText = `Audit this Oxford candidate. Return exactly JSON: {"decision":"keep"|"needs_review"|"delete_candidate", "found_linkedin":true/false, "linkedin_url":""}\n\nCandidate: ${name}\nResults:\n${resultsText}`;
   const res = await fetch(`${cfg.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
         model, stream: false, format: 'json',
         messages: [{role: 'user', content: promptText}]
      })
   });
   const data = await res.json();
   try { return JSON.parse(data.message.content); } catch { return { decision: "needs_review" }; }
}

// CLI Engine
async function main() {
  await ensureDirs();
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const phaseIndex = args.findIndex(a => a === '--phase');
  const phase = phaseIndex !== -1 ? args[phaseIndex + 1] : null;

  if (!cfg.apiKey) {
    console.warn("APPWRITE_API_KEY is not set. Exiting.");
    return;
  }

  const tables = getAppwrite();
  
  if (phase === '1') await runPhase1(tables, apply);
  else if (phase === '2') await runPhase2(tables, apply);
  else if (phase === '3') await runPhase3and4(tables, apply);
  else {
    console.log("Usage: node pipeline.js --phase <1|2|3> [--apply]");
  }
}

main().catch(console.error);
