import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client, Query, TablesDB } from 'node-appwrite';
import readline from 'readline';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const LOGS_DIR = path.join(ROOT, 'logs');
const STATE_DIR = path.join(ROOT, 'state');

// Config
const cfg = {
  endpoint: process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1',
  projectId: process.env.APPWRITE_PROJECT_ID || '69de7f335c0489352ff1',
  apiKey: process.env.APPWRITE_API_KEY || 'standard_b09794b2e45415c80266a30fc15c542997e574c3fcbaee2245561b90d2dd1cdbd2a0b8d745445b7e0990f8f14bdd767ba77ac9fa177d83bfa256938d3f511ad4163c78409fb3ad81304400cc83e68d1297b3f3b582247c9a19433d04011057d020bdd0fb0116f851290cc1cf0deb039eacbcad2b95c3912c976ad67867f7c288',
  databaseId: process.env.APPWRITE_DB_ID || 'supercharged',
  peopleTable: process.env.APPWRITE_PEOPLE_TABLE || 'people',
  peopleSocietiesTable: process.env.APPWRITE_PEOPLE_SOCIETIES_TABLE || 'people_societies',
  peopleSportsTable: process.env.APPWRITE_PEOPLE_SPORTS_TABLE || 'people_sports',
  societiesTable: process.env.APPWRITE_SOCIETIES_TABLE || 'societies',
  sportsTable: process.env.APPWRITE_SPORTS_TABLE || 'sports',
  searxngUrl: process.env.SEARXNG_URL || 'http://127.0.0.1:8080',
  ollamaUrl: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
  model: process.env.DEFAULT_AUDIT_MODEL || 'gemma4:e2b-it-q4_K_M',
  classifierModel: process.env.CLASSIFIER_MODEL || 'gemma4:e2b-it-q4_K_M',
  concurrencyPhase2: parseInt(process.env.CONCURRENCY_P2) || 12, // Optimized for M1 Pro
  concurrencyPhase3: parseInt(process.env.CONCURRENCY_P3) || 4,  // Limited by Search API
  ollamaTimeoutMs: 180000,
  searxngTimeoutMs: 15000,
  searchResultsLimit: 5,
};

// Logging
async function logMessage(phase, level, msg) {
  const timestamp = new Date().toISOString();
  const levelStr = level.toUpperCase().padEnd(5);
  const line = `[${timestamp}] [Phase ${phase}] [${levelStr}] ${msg}`;
  console.log(line);

  const logFile = path.join(LOGS_DIR, `pipeline_phase_${phase}_run.log`);
  try {
    await fs.appendFile(logFile, line + '\n', 'utf8');
  } catch (e) {
    console.error(`Failed to write to log file: ${e.message}`);
  }
}

async function ensureDirs() {
  await fs.mkdir(LOGS_DIR, { recursive: true }).catch(() => { });
  await fs.mkdir(STATE_DIR, { recursive: true }).catch(() => { });
}

async function confirmAction(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
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
      queries: [
        Query.limit(pageSize),
        Query.offset(offset),
        Query.orderAsc('$id') // Ensure consistent order for resuming
      ]
    });
    out.push(...page.rows);
    if (page.rows.length < pageSize) break;
    offset += page.rows.length;
  }
  return out;
}

// State Management
async function saveState(phase, lastId, apply) {
  const stateFile = path.join(STATE_DIR, `phase_${phase}_${apply ? 'apply' : 'dry'}_resume.json`);
  await fs.mkdir(STATE_DIR, { recursive: true }).catch(() => { });
  await fs.writeFile(stateFile, JSON.stringify({ lastId, timestamp: new Date().toISOString() }), 'utf8');
}

async function loadState(phase, apply) {
  const stateFile = path.join(STATE_DIR, `phase_${phase}_${apply ? 'apply' : 'dry'}_resume.json`);
  try {
    const data = await fs.readFile(stateFile, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function clearState(phase, apply) {
  const stateFile = path.join(STATE_DIR, `phase_${phase}_${apply ? 'apply' : 'dry'}_resume.json`);
  await fs.unlink(stateFile).catch(() => { });
}

// ============================================
// Phase 1: Structural Fast-Fail
// ============================================
async function runPhase1(tables, apply) {
  await logMessage(1, 'INFO', `Starting Phase 1: Structural DB Filter`);
  await logMessage(1, 'INFO', `Mode: ${apply ? 'EXECUTE (APPLY)' : 'DRY RUN'}`);

  const people = await fetchAllPeople(tables);
  await logMessage(1, 'INFO', `Fetched ${people.length} people from ${cfg.peopleTable}`);

  await logMessage(1, 'INFO', `Fetching cross-references in memory...`);
  const [socRows, sportRows] = await Promise.all([
    fetchAllRows(tables, cfg.peopleSocietiesTable),
    fetchAllRows(tables, cfg.peopleSportsTable)
  ]);

  await logMessage(1, 'INFO', `Fetched ${socRows.length} society memberships.`);
  await logMessage(1, 'INFO', `Fetched ${sportRows.length} sport memberships.`);

  const countsMap = new Map();
  const addCount = (pid) => {
    if (!pid) return;
    countsMap.set(pid, (countsMap.get(pid) || 0) + 1);
  };

  socRows.forEach(r => addCount(r.person_id));
  sportRows.forEach(r => addCount(r.person_id));

  const toDelete = [];
  for (const person of people) {
    const count = countsMap.get(person.$id) || 0;
    if (count < 2) {
      toDelete.push({ id: person.$id, name: person.full_name || person.username, count });
    }
  }

  await logMessage(1, 'INFO', `Audit Result: Found ${toDelete.length} / ${people.length} users failing structural check (< 2 memberships).`);

  for (const item of toDelete) {
    await logMessage(1, 'DEBUG', `Candidate for deletion: ID=${item.id}, Name="${item.name}", Total Memberships=${item.count}`);
  }

  console.log(`\nTOTAL NUMBER OF CANDIDATES FOR DELETION = ${toDelete.length}\n`);

  if (toDelete.length === 0) {
    await logMessage(1, 'INFO', `No records met deletion criteria. Phase 1 complete.`);
    return;
  }

  if (apply) {
    const confirmed = await confirmAction(`Proceed with deleting ${toDelete.length} records?`);
    if (!confirmed) {
      await logMessage(1, 'INFO', `Deletion cancelled by user.`);
      return;
    }

    await logMessage(1, 'INFO', `Applying deletions for ${toDelete.length} records...`);
    const batchSize = 10;
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = toDelete.slice(i, i + batchSize);
      await Promise.all(batch.map(async item => {
        try {
          await tables.deleteRow({ databaseId: cfg.databaseId, tableId: cfg.peopleTable, rowId: item.id });
          await logMessage(1, 'SUCCESS', `Deleted record: ${item.id} (${item.name})`);
        } catch (e) {
          await logMessage(1, 'ERROR', `Error deleting ${item.id}: ${e.message}`);
        }
      }));
      if (i % 100 === 0 && i > 0) await logMessage(1, 'INFO', `Progress: Deleted ${i}/${toDelete.length}`);
    }
    await logMessage(1, 'INFO', `Phase 1 Application Complete.`);
  } else {
    await logMessage(1, 'INFO', `Dry run complete. No changes made to the database.`);
    await logMessage(1, 'INFO', `To apply these changes, run with: node pipeline.js --phase 1 --apply`);
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
async function startClassifierApi() {
  return new Promise((resolve, reject) => {
    console.log("Starting Python Classification API on MPS...");
    const py = spawn('python', ['-u', path.join(__dirname, 'classifier_api.py')]);

    py.stdout.on('data', (data) => {
      const msg = data.toString();
      process.stdout.write(`[Python] ${msg}`);
      if (msg.includes('READY')) resolve(py);
    });

    py.stderr.on('data', (data) => {
      console.error(`Python API: ${data}`);
    });

    py.on('close', (code) => {
      // Silent exit
    });

    // Timeout if it fails to start (increased for model loading)
    setTimeout(() => reject(new Error("Python API took too long to start")), 120000);
  });
}

async function runPhase2(tables, apply) {
  await logMessage(2, 'INFO', `Starting Phase 2: Entity Classifier`);
  await logMessage(2, 'INFO', `Mode: ${apply ? 'EXECUTE (APPLY)' : 'DRY RUN'}`);
  await logMessage(2, 'INFO', `Using Custom MPS Classifier Model`);

  let people = await fetchAllPeople(tables);
  await logMessage(2, 'INFO', `Fetched ${people.length} users.`);

  // Resume Logic
  const state = await loadState(2, apply);
  if (state && state.lastId) {
    const lastIndex = people.findIndex(p => p.$id === state.lastId);
    if (lastIndex !== -1 && lastIndex < people.length - 1) {
      const resume = await confirmAction(`Found previous ${apply ? 'APPLY' : 'DRY RUN'} progress (last processed ID: ${state.lastId}). Resume?`);
      if (resume) {
        people = people.slice(lastIndex + 1);
        await logMessage(2, 'INFO', `Resuming from record ${lastIndex + 2}. Remaining to process: ${people.length}`);
      } else {
        await clearState(2, apply);
      }
    }
  }

  let candidates = [];
  let errorCount = 0;

  // We can massively increase batch size because python processes vectors simultaneously on MPS
  const batchSize = 100;

  let pyServer;
  try {
    pyServer = await startClassifierApi();
  } catch (e) {
    await logMessage(2, 'ERROR', `Failed to start Python API: ${e.message}`);
    return;
  }

  for (let i = 0; i < people.length; i += batchSize) {
    const batch = people.slice(i, i + batchSize);

    // Ensure no empty strings break the python tokenizer
    const namesToClassify = batch.map(p => {
      const n = (p.full_name || p.username || p.normalized_name || '').trim();
      return n.length > 0 ? n : "Unknown Person";
    });

    try {
      const response = await fetch('http://127.0.0.1:8888', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(namesToClassify)
      });

      const results = await response.json();

      for (let j = 0; j < results.length; j++) {
        const person = batch[j];
        const res = results[j];

        if (!res.is_person) {
          await logMessage(2, 'AUDIT', `Entity Detected: "${res.name}" (ID: ${person.$id}) -> Result: NOT A PERSON`);
          candidates.push({ id: person.$id, name: res.name });
        } else {
          await logMessage(2, 'DEBUG', `Verified Person: "${res.name}" (ID: ${person.$id})`);
        }
      }
    } catch (err) {
      await logMessage(2, 'ERROR', `Batch classification failed: ${err.message}`);
      errorCount++;
    }

    // Save checkpoint
    const lastProcessedId = batch[batch.length - 1].$id;
    await saveState(2, lastProcessedId, apply);

    await logMessage(2, 'INFO', `Progress: ${Math.min(i + batchSize, people.length)}/${people.length} processed.`);
  }

  console.log(`\nTOTAL NUMBER OF CANDIDATES FOR DELETION = ${candidates.length}\n`);

  if (candidates.length === 0) {
    if (pyServer) pyServer.kill();
    await logMessage(2, 'INFO', `Phase 2 Complete. No entities found for deletion.`);
    await clearState(2, apply);
    return;
  }

  if (apply) {
    const confirmed = await confirmAction(`Proceed with deleting ${candidates.length} identified entities?`);
    if (!confirmed) {
      await logMessage(2, 'INFO', `Deletion cancelled by user.`);
      return;
    }

    let deletedCount = 0;
    for (const item of candidates) {
      try {
        await tables.deleteRow({ databaseId: cfg.databaseId, tableId: cfg.peopleTable, rowId: item.id });
        await logMessage(2, 'SUCCESS', `Deleted organization/entity: ${item.name}`);
        deletedCount++;
      } catch (e) {
        await logMessage(2, 'ERROR', `Failed to delete ${item.id}: ${e.message}`);
      }
    }
    await logMessage(2, 'INFO', `Phase 2 Complete. Deleted ${deletedCount} entities.`);
  } else {
    await logMessage(2, 'INFO', `Phase 2 Complete. ${candidates.length} entities identified.`);
    await logMessage(2, 'INFO', `Run with --apply to remove identified entities.`);
  }

  await clearState(2, apply);
  if (pyServer) pyServer.kill();
}

// ============================================
// Phase 3 & 4: Search + Deep Profiling
// ============================================
async function runPhase3and4(tables, apply) {
  await logMessage(3, 'INFO', `Starting Heavyweight Audit (Phase 3: Web Search & Phase 4: LLM Profiling)`);
  await logMessage(3, 'INFO', `Mode: ${apply ? 'EXECUTE (APPLY)' : 'DRY RUN'}`);
  await logMessage(3, 'INFO', `Using Audit Model: ${cfg.model}`);

  let people = await fetchAllPeople(tables);
  await logMessage(3, 'INFO', `Target Audience: ${people.length} users.`);

  // Test Mode Logic
  const isTestMode = process.argv.includes('--test');
  if (isTestMode) {
    people = people.slice(0, 10);
    await logMessage(3, 'INFO', `TEST MODE: Limiting execution to ${people.length} users.`);
  }

  // Resume Logic
  const state = await loadState(3, apply);
  if (state && state.lastId) {
    const lastIndex = people.findIndex(p => p.$id === state.lastId);
    if (lastIndex !== -1 && lastIndex < people.length - 1) {
      const resume = await confirmAction(`Found previous ${apply ? 'APPLY' : 'DRY RUN'} progress (last processed ID: ${state.lastId}). Resume?`);
      if (resume) {
        people = people.slice(lastIndex + 1);
        await logMessage(3, 'INFO', `Resuming from record ${lastIndex + 2}. Remaining to process: ${people.length}`);
      } else {
        await clearState(3, apply);
      }
    }
  }

  const batchSize = cfg.concurrencyPhase3;
  let candidates = [];
  let processed = 0;

  for (let i = 0; i < people.length; i += batchSize) {
    const batch = people.slice(i, i + batchSize);

    await Promise.all(batch.map(async person => {
      const name = (person.full_name || person.normalized_name || '').trim();
      if (!name) {
        await logMessage(3, 'WARN', `Skipping ID ${person.$id}: Name missing.`);
        return;
      }

      // Production Speed Hack: Skip if already processed
      if (person.description && person.linkedin_url) {
        // await logMessage(3, 'DEBUG', `[${name}] Already has description/LinkedIn. Skipping.`);
        return;
      }

      try {
        // Phase 3: Two queries — username and name
        const queries = [
          `"${person.username}" oxford`,
          `"${name}" oxford uni`
        ];

        let allResults = [];
        const seenUrls = new Set();

        for (const query of queries) {
          await logMessage(3, 'DEBUG', `[${name}] Searching: ${query}`);
          const results = await searchSearxng(query);
          for (const r of results) {
            if (!seenUrls.has(r.url)) {
              seenUrls.add(r.url);
              allResults.push(r);
            }
          }
        }

        await logMessage(3, 'DEBUG', `[${name}] Search returned ${allResults.length} total unique results.`);

        // Phase 3.5: Skip if no results found
        if (allResults.length === 0) {
          await logMessage(3, 'DEBUG', `[${name}] ⏩ No search results found. Skipping.`);
          processed++;
          return;
        }

        // Phase 4: Heavyweight verification
        await logMessage(3, 'DEBUG', `[${name}] 🔍 Sending to LLM for profiling...`);
        const auditRes = await auditWithOllama(cfg.model, name, allResults);

        const decisionEmoji = auditRes.decision === 'keep' ? '✅' : (auditRes.decision === 'delete_candidate' ? '⚠️' : '❓');
        await logMessage(3, 'AUDIT', `[${name}] Decision: ${decisionEmoji} ${auditRes.decision.toUpperCase()}`);

        // Only save data if we have high confidence (Decision: KEEP)
        if (auditRes.decision === 'keep' && (auditRes.description || auditRes.linkedin_url)) {
          if (auditRes.description) await logMessage(3, 'INFO', `[${name}] 📝 ${auditRes.description}`);
          if (auditRes.linkedin_url) await logMessage(3, 'INFO', `[${name}] 🔗 ${auditRes.linkedin_url}`);

          if (apply) {
            try {
              await tables.updateRow({
                databaseId: cfg.databaseId,
                tableId: cfg.peopleTable,
                rowId: person.$id,
                data: {
                  description: auditRes.description || person.description,
                  linkedin_url: auditRes.linkedin_url || person.linkedin_url
                }
              });
              await logMessage(3, 'SUCCESS', `[${name}] Updated database with description/LinkedIn.`);
            } catch (e) {
              await logMessage(3, 'ERROR', `[${name}] Failed to update database: ${e.message}`);
            }
          }
        } else if (auditRes.decision !== 'keep') {
          await logMessage(3, 'DEBUG', `[${name}] Low confidence. Skipping database enrichment.`);
        }
      } catch (err) {
        await logMessage(3, 'ERROR', `[${name}] Pipeline failure: ${err.message}`);
      }
      processed++;
    }));

    // Save checkpoint
    const lastProcessedId = batch[batch.length - 1].$id;
    await saveState(3, lastProcessedId);

    if (i % 10 === 0 && i > 0) {
      await logMessage(3, 'INFO', `Progress Update: ${i}/${people.length} evaluated.`);
    }
  }

  await logMessage(3, 'INFO', `Heavyweight Audit Phase Complete.`);

  if (apply) {
    await logMessage(3, 'INFO', `Production run finished. Database updated with descriptions and LinkedIn URLs.`);
  } else {
    await logMessage(3, 'INFO', `Dry run finished. No database changes made.`);
    await logMessage(3, 'INFO', `Run with --apply to save data to the database.`);
  }

  await clearState(3, apply);
}

// ============================================
// Phase 4: Build Society/Sport Descriptions
// ============================================
async function runPhase4(tables, apply) {
  await logMessage(4, 'INFO', `Starting Phase 4: Society/Sport Description Builder`);
  await logMessage(4, 'INFO', `Mode: ${apply ? 'EXECUTE (APPLY)' : 'DRY RUN'}`);

  let people = await fetchAllPeople(tables);
  await logMessage(4, 'INFO', `Fetched ${people.length} users.`);

  // Fetch memberships
  const [socRows, sportRows, societyMeta, sportMeta] = await Promise.all([
    fetchAllRows(tables, cfg.peopleSocietiesTable),
    fetchAllRows(tables, cfg.peopleSportsTable),
    fetchAllRows(tables, cfg.societiesTable || 'societies'),
    fetchAllRows(tables, cfg.sportsTable || 'sports'),
  ]);

  await logMessage(4, 'INFO', `Fetched ${socRows.length} society memberships, ${sportRows.length} sport memberships.`);
  await logMessage(4, 'INFO', `Fetched ${societyMeta.length} societies, ${sportMeta.length} sports metadata.`);

  // Build lookup maps
  const societyNameMap = {};
  const sportNameMap = {};
  for (const s of societyMeta) {
    societyNameMap[s.$id] = s.name;
  }
  for (const s of sportMeta) {
    sportNameMap[s.$id] = s.name;
  }

  const personSocieties = {};
  const personSports = {};
  for (const r of socRows) {
    if (!personSocieties[r.person_id]) personSocieties[r.person_id] = [];
    if (societyNameMap[r.society_id]) {
      personSocieties[r.person_id].push(societyNameMap[r.society_id]);
    }
  }
  for (const r of sportRows) {
    if (!personSports[r.person_id]) personSports[r.person_id] = [];
    if (sportNameMap[r.sport_id]) {
      personSports[r.person_id].push(sportNameMap[r.sport_id]);
    }
  }

  await logMessage(4, 'INFO', `Built membership lookup maps.`);

  let updated = 0;
  let skipped = 0;

  for (const person of people) {
    const societies = personSocieties[person.$id] || [];
    const sports = personSports[person.$id] || [];

    // Skip if no memberships
    if (societies.length === 0 && sports.length === 0) {
      skipped++;
      continue;
    }

    // Build templated description
    const parts = [];
    if (societies.length > 0) {
      const societyList = societies.slice(0, 3).join(', ');
      parts.push(`Active in ${societyList}.`);
    }

    if (sports.length > 0) {
      const sportList = sports.slice(0, 2).join(', ');
      const verb = societies.length > 0 ? 'Also plays' : 'Plays';
      parts.push(`${verb} ${sportList}.`);
    }

    const newDescription = parts.join(' ');

    // Append to existing description if present
    const finalDescription = person.description && person.description.trim().length > 0
      ? `${person.description.trim()} ${newDescription}`
      : newDescription;

    const name = person.full_name || person.username || person.$id;

    if (apply) {
      try {
        await tables.updateRow({
          databaseId: cfg.databaseId,
          tableId: cfg.peopleTable,
          rowId: person.$id,
          data: { description: finalDescription }
        });
        await logMessage(4, 'SUCCESS', `[${name}] Updated description (${societies.length} societies, ${sports.length} sports).`);
        updated++;
      } catch (e) {
        await logMessage(4, 'ERROR', `[${name}] Failed to update: ${e.message}`);
      }
    } else {
      await logMessage(4, 'DEBUG', `[${name}] Would update: "${finalDescription.slice(0, 80)}..."`);
      updated++;
    }
  }

  await logMessage(4, 'INFO', `Phase 4 Complete. Updated: ${updated}, Skipped (no memberships): ${skipped}.`);

  if (!apply) {
    await logMessage(4, 'INFO', `Dry run finished. No database changes made.`);
    await logMessage(4, 'INFO', `Run with --apply to save descriptions to the database.`);
  }
}

// Helpers
async function classifyWithOllama(model, text) {
  try {
    const res = await fetch(`${cfg.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, stream: false, format: 'json',
        messages: [{ role: 'user', content: text }]
      })
    });

    const data = await res.json();

    if (data.error) {
      console.error(`[Ollama Error] ${data.error}`);
      return { is_person: true, reason: `Ollama error: ${data.error}` };
    }

    if (!data.message || !data.message.content) {
      console.error(`[Ollama Error] Unexpected response format:`, data);
      return { is_person: true, reason: "Unexpected API response" };
    }

    try {
      return JSON.parse(data.message.content);
    } catch (e) {
      console.error(`[Ollama Error] Failed to parse JSON content: ${data.message.content}`);
      return { is_person: true, reason: "Invalid JSON from model" };
    }
  } catch (err) {
    console.error(`[Ollama Error] Connection failed: ${err.message}`);
    return { is_person: true, reason: "Connection failure" };
  }
}

async function searchSearxng(query) {
  const res = await fetch(`${cfg.searxngUrl}/search?format=json&language=en&q=${encodeURIComponent(query)}`);
  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];
  return results.slice(0, cfg.searchResultsLimit).map(r => ({ title: r.title, content: r.content, url: r.url }));
}

async function auditWithOllama(model, name, results) {
  const resultsText = results.map(r => `URL: ${r.url}\nSnippet: ${r.content}`).join('\n\n');
  const promptText = `Audit this Oxford candidate. Return exactly JSON: {"decision":"keep"|"needs_review"|"delete_candidate", "found_linkedin":true/false, "linkedin_url":"", "description":"[TEXT]"}\n\nCandidate: ${name}\nResults:\n${resultsText}\n\nTask: Provide an oxford-orientated description of the person based on the results. Keep it concise and useful for knowing more about what that person does or did at Oxford, as well as their general interests and achievements.`;
  const res = await fetch(`${cfg.ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, stream: false, format: 'json',
      messages: [{ role: 'user', content: promptText }]
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
    console.warn("APPWRITE_API_KEY is not set. Please set the APPWRITE_API_KEY environment variable.");
    process.exit(1);
  }

  if (!phase) {
    console.log(`
AUDIT PIPELINE CLI
------------------
Usage: node pipeline.js --phase <1|2|3|4> [--apply] [--test]

Phases:
  1: Structural Fast-Fail (Delete users with < 2 memberships)
  2: Entity Classifier (Identify and delete non-person entities using LLM)
  3: Heavyweight Audit (Web search & Deep LLM Profiling)
  4: Society/Sport Description Builder (Populate descriptions from memberships)

Options:
  --phase <n>   Run a specific audit phase
  --apply       Execute database updates (default: dry-run)
  --test        Run Phase 3 on only the first 10 users for testing

Examples:
  node pipeline.js --phase 1 --apply
  node pipeline.js --phase 3 --test
  node pipeline.js --phase 4 --apply
    `);
    return;
  }

  const tables = getAppwrite();

  try {
    if (phase === '1') await runPhase1(tables, apply);
    else if (phase === '2') await runPhase2(tables, apply);
    else if (phase === '3') await runPhase3and4(tables, apply);
    else if (phase === '4') await runPhase4(tables, apply);
    else {
      console.error(`Unknown phase: ${phase}. Use 1, 2, 3, or 4.`);
    }
  } catch (error) {
    console.error(`Pipeline execution failed:`, error);
    process.exit(1);
  }
}

main().catch(console.error);
