#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { Client, ID, Query, TablesDB } from 'node-appwrite';
import 'dotenv/config';

const DB_ID = process.env.APPWRITE_DB_ID || 'supercharged';
const PEOPLE_TABLE = process.env.APPWRITE_PEOPLE_TABLE || 'people';
const PEOPLE_SOCIETIES_TABLE = process.env.APPWRITE_PEOPLE_SOCIETIES_TABLE || 'people_societies';
const PEOPLE_SPORTS_TABLE = process.env.APPWRITE_PEOPLE_SPORTS_TABLE || 'people_sports';
const SOCIETIES_TABLE = process.env.APPWRITE_SOCIETIES_TABLE || 'societies';
const SPORTS_TABLE = process.env.APPWRITE_SPORTS_TABLE || 'sports';

function printHelp() {
  console.log(`
Import members CSV into people + join tables.

Usage:
  # Single members CSV
  node scripts/import_group_csv.js \\
    --file example.csv \\
    --group-type society|sport \\
    --group-name "Oxford CS Graduate Society"

  # Batch manifest CSV (first column path, second column group name)
  node scripts/import_group_csv.js \\
    --file import_manifest.csv

Options:
  --file <path>                Members CSV or manifest CSV path (required)
  --group-type <society|sport> Membership type (required)
  --group-name <name>          Society or sport name (required unless --group-id)
  --group-id <rowId>           Existing societies/sports row id (optional)
  --source-csv <label>         Source label saved in join rows (default: csv filename)
  --limit <n>                  Only process first n data rows (optional)
  --dry-run                    Parse and resolve only, no writes (fast local mode)
  --check-db                   With --dry-run, also query Appwrite for dedupe realism (slower)
  --no-create-group            Do not create societies/sports row if missing
  --help                       Show this help

Notes:
  - Members CSV uses: URL, Username, Name
  - Manifest CSV can use headers (recommended): path, group_name, group_type, group_id
  - Manifest fallback without headers: col1=path, col2=group_name, col3=group_type (optional)
  - group_type defaults to "society" if missing
  - All other columns are ignored
`);
}

const MEMBER_HEADERS = ['url', 'username', 'name'];
const MANIFEST_PATH_HEADERS = ['path', 'file', 'file_path', 'csv', 'csv_path'];
const MANIFEST_GROUP_HEADERS = ['group_name', 'society_name', 'sport_name', 'group', 'society', 'sport', 'name'];
const MANIFEST_TYPE_HEADERS = ['group_type', 'type', 'kind'];
const MANIFEST_ID_HEADERS = ['group_id', 'society_id', 'sport_id'];
const MANIFEST_SOURCE_HEADERS = ['source_csv', 'source_label', 'source'];

function parseArgs(argv) {
  const out = {
    dryRun: false,
    checkDb: false,
    createGroupIfMissing: true,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      out.help = true;
      continue;
    }

    if (arg === '--dry-run') {
      out.dryRun = true;
      continue;
    }

    if (arg === '--check-db') {
      out.checkDb = true;
      continue;
    }

    if (arg === '--no-create-group') {
      out.createGroupIfMissing = false;
      continue;
    }

    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }

    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    out[key] = value;
    i += 1;
  }

  return out;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toLowerKey(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeUsername(value) {
  const raw = normalizeString(value).replace(/^@+/, '');
  return raw.toLowerCase().slice(0, 128);
}

function normalizeName(value) {
  const raw = normalizeString(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return raw.toLowerCase().slice(0, 200);
}

function truncate(value, maxLen) {
  return normalizeString(value).slice(0, maxLen);
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];

    if (ch === '"') {
      const next = content[i + 1];
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && content[i + 1] === '\n') {
        i += 1;
      }

      row.push(field);
      field = '';

      const isEmpty = row.every((entry) => normalizeString(entry) === '');
      if (!isEmpty) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += ch;
  }

  // flush final row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    const isEmpty = row.every((entry) => normalizeString(entry) === '');
    if (!isEmpty) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return { headers: [], records: [] };
  }

  const headers = rows[0].map((h) => normalizeString(h));
  const records = rows.slice(1);
  return { headers, records };
}

function buildHeaderMap(headers) {
  const map = new Map();
  headers.forEach((header, idx) => {
    map.set(toLowerKey(header), idx);
  });
  return map;
}

function getColumnIndex(headerMap, candidateHeaders, fallback = null) {
  for (const key of candidateHeaders) {
    if (headerMap.has(key)) {
      return headerMap.get(key);
    }
  }
  return fallback;
}

function isMembersCsv(headerMap) {
  return headerMap.has('url') || headerMap.has('username') || headerMap.has('name');
}

function isValidGroupType(value) {
  const type = toLowerKey(value);
  return type === 'society' || type === 'sport';
}

function parseManifestEntries({ manifestPath, headers, records }) {
  const headerMap = buildHeaderMap(headers);
  const pathIndex = getColumnIndex(headerMap, MANIFEST_PATH_HEADERS, 0);
  const groupIndex = getColumnIndex(headerMap, MANIFEST_GROUP_HEADERS, 1);
  const typeIndex = getColumnIndex(headerMap, MANIFEST_TYPE_HEADERS, 2);
  const groupIdIndex = getColumnIndex(headerMap, MANIFEST_ID_HEADERS, null);
  const sourceIndex = getColumnIndex(headerMap, MANIFEST_SOURCE_HEADERS, null);

  if (pathIndex === null || groupIndex === null) {
    throw new Error('Manifest CSV must provide path and group_name columns (or have them in first two columns).');
  }

  const manifestDir = path.dirname(path.resolve(manifestPath));
  const entries = [];

  records.forEach((row, idx) => {
    const rawPath = normalizeString(row[pathIndex] ?? '');
    const rawGroupName = normalizeString(row[groupIndex] ?? '');
    const rawGroupType = normalizeString(typeIndex !== null ? (row[typeIndex] ?? '') : '');
    const rawGroupId = normalizeString(groupIdIndex !== null ? (row[groupIdIndex] ?? '') : '');
    const rawSource = normalizeString(sourceIndex !== null ? (row[sourceIndex] ?? '') : '');

    if (!rawPath || (!rawGroupName && !rawGroupId)) {
      return;
    }

    const resolvedPath = path.isAbsolute(rawPath)
      ? rawPath
      : path.resolve(manifestDir, rawPath);

    const groupType = isValidGroupType(rawGroupType) ? toLowerKey(rawGroupType) : 'society';

    entries.push({
      line: idx + 2,
      filePath: resolvedPath,
      groupType,
      groupName: rawGroupName,
      groupId: rawGroupId,
      sourceCsv: rawSource || path.basename(resolvedPath),
    });
  });

  return entries;
}

function canonicalizeUrl(value) {
  const raw = normalizeString(value);
  if (!raw) return '';

  try {
    const hasProtocol = /^https?:\/\//i.test(raw);
    const url = new URL(hasProtocol ? raw : `https://${raw}`);
    url.hash = '';
    let rendered = url.toString();
    rendered = rendered.endsWith('/') ? rendered.slice(0, -1) : rendered;
    return rendered.slice(0, 1024);
  } catch {
    return truncate(raw, 1024);
  }
}

function inferName({ name, username, url }) {
  const safeName = normalizeString(name);
  if (safeName) return truncate(safeName, 200);

  const safeUsername = normalizeString(username);
  if (safeUsername) {
    const pretty = safeUsername.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
    return truncate(pretty || safeUsername, 200);
  }

  const safeUrl = normalizeString(url);
  if (safeUrl) {
    const seg = safeUrl.split('/').filter(Boolean).pop() || 'unknown';
    return truncate(seg.replace(/[._]+/g, ' '), 200);
  }

  return 'unknown';
}

function setCaches(caches, person) {
  if (!person) return;
  const normalizedUsername = normalizeUsername(person.normalized_username || person.username || '');
  const profileUrl = canonicalizeUrl(person.profile_url || '');
  const normalizedName = normalizeName(person.normalized_name || person.full_name || '');

  if (normalizedUsername) caches.byUsername.set(normalizedUsername, person);
  if (profileUrl) caches.byProfileUrl.set(profileUrl, person);
  if (normalizedName) caches.byName.set(normalizedName, person);
}

async function listAllRows(tables, tableId, queries = []) {
  const pageSize = 100;
  let offset = 0;
  const all = [];

  while (true) {
    const page = await tables.listRows({
      databaseId: DB_ID,
      tableId,
      queries: [...queries, Query.limit(pageSize), Query.offset(offset)],
    });

    const rows = page.rows || [];
    all.push(...rows);

    if (rows.length < pageSize) break;
    offset += rows.length;
  }

  return all;
}

async function preloadPeopleCaches(tables, caches) {
  const people = await listAllRows(tables, PEOPLE_TABLE);
  people.forEach((person) => setCaches(caches, person));
  return people.length;
}

async function preloadMembershipCache({ tables, groupType, groupRowId, membershipCache, membershipRowIdByKey }) {
  const joinTableId = groupType === 'society' ? PEOPLE_SOCIETIES_TABLE : PEOPLE_SPORTS_TABLE;
  const foreignKey = groupType === 'society' ? 'society_id' : 'sport_id';

  const rows = await listAllRows(tables, joinTableId, [Query.equal(foreignKey, groupRowId)]);
  rows.forEach((row) => {
    if (!row.person_id) return;
    const key = `${row.person_id}::${groupRowId}::${groupType}`;
    membershipCache.add(key);
    if (row.$id) {
      membershipRowIdByKey.set(key, row.$id);
    }
  });

  return rows.length;
}

async function findExistingPerson(tables, caches, candidate) {
  if (candidate.normalized_username && caches.byUsername.has(candidate.normalized_username)) {
    return caches.byUsername.get(candidate.normalized_username);
  }
  if (candidate.profile_url && caches.byProfileUrl.has(candidate.profile_url)) {
    return caches.byProfileUrl.get(candidate.profile_url);
  }
  if (candidate.normalized_name && !candidate.normalized_username && caches.byName.has(candidate.normalized_name)) {
    return caches.byName.get(candidate.normalized_name);
  }

  if (!tables) {
    return null;
  }

  return null;
}

function buildPersonPatch(existing, candidate, sourceLabel) {
  const patch = {};

  if (!normalizeString(existing.full_name) && candidate.full_name) {
    patch.full_name = candidate.full_name;
  }

  if (!normalizeString(existing.normalized_name) && candidate.normalized_name) {
    patch.normalized_name = candidate.normalized_name;
  }

  if (!normalizeString(existing.username) && candidate.username) {
    patch.username = candidate.username;
  }

  if (!normalizeString(existing.normalized_username) && candidate.normalized_username) {
    patch.normalized_username = candidate.normalized_username;
  }

  if (!normalizeString(existing.profile_url) && candidate.profile_url) {
    patch.profile_url = candidate.profile_url;
  }

  if (!normalizeString(existing.source) && sourceLabel) {
    patch.source = sourceLabel;
  }

  return patch;
}

function buildCandidateFromRow(row, idx, headerMap) {
  const get = (header) => {
    const index = headerMap.get(toLowerKey(header));
    return index === undefined ? '' : normalizeString(row[index] ?? '');
  };

  const url = canonicalizeUrl(get('URL'));
  const usernameRaw = get('Username');
  const username = truncate(usernameRaw.replace(/^@+/, ''), 128);
  const normalizedUsername = normalizeUsername(usernameRaw);
  const name = inferName({
    name: get('Name'),
    username: usernameRaw,
    url,
  });
  const normalizedName = normalizeName(name);

  const empty = !url && !username && !name;
  if (empty) return null;

  return {
    row_index: idx + 2,
    url,
    username,
    normalized_username: normalizedUsername,
    full_name: truncate(name, 200),
    normalized_name: truncate(normalizedName, 200),
  };
}

async function resolveGroupRow({ tables, groupType, groupName, groupId, createGroupIfMissing, dryRun }) {
  const groupTableId = groupType === 'society' ? SOCIETIES_TABLE : SPORTS_TABLE;

  if (!tables) {
    if (groupId) {
      return { $id: groupId, name: groupName || groupId };
    }

    const safeName = normalizeString(groupName);
    return {
      $id: `dryrun_${groupType}_${safeName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      name: safeName,
    };
  }

  if (groupId) {
    const row = await tables.getRow({
      databaseId: DB_ID,
      tableId: groupTableId,
      rowId: groupId,
    });
    return row;
  }

  const safeName = normalizeString(groupName);
  if (!safeName) {
    throw new Error('group_name is required when group_id is not provided');
  }

  try {
    const exact = await tables.listRows({
      databaseId: DB_ID,
      tableId: groupTableId,
      queries: [Query.equal('name', safeName), Query.limit(1)],
    });
    if (exact.rows?.[0]) return exact.rows[0];
  } catch {
    // continue to fallback strategy
  }

  try {
    const batch = await tables.listRows({
      databaseId: DB_ID,
      tableId: groupTableId,
      queries: [Query.limit(200)],
    });
    const lower = safeName.toLowerCase();
    const found = (batch.rows || []).find((row) => toLowerKey(row.name) === lower);
    if (found) return found;
  } catch {
    // continue to create strategy
  }

  if (!createGroupIfMissing) {
    throw new Error(`${groupType} '${safeName}' not found in table '${groupTableId}' and --no-create-group was set`);
  }

  if (dryRun) {
    return {
      $id: `dryrun_${groupType}_${safeName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      name: safeName,
    };
  }

  const created = await tables.createRow({
    databaseId: DB_ID,
    tableId: groupTableId,
    rowId: ID.unique(),
    data: { name: safeName },
  });

  return created;
}

function buildMembershipData(groupType, personId, groupRowId, sourceCsvLabel) {
  const now = new Date().toISOString();
  if (groupType === 'society') {
    return {
      person_id: personId,
      society_id: groupRowId,
      source_csv: sourceCsvLabel,
      first_seen_at: now,
      last_seen_at: now,
    };
  }

  return {
    person_id: personId,
    sport_id: groupRowId,
    source_csv: sourceCsvLabel,
    first_seen_at: now,
    last_seen_at: now,
  };
}

async function upsertMembership({ tables, groupType, groupRowId, personId, sourceCsvLabel, dryRun, membershipCache, membershipRowIdByKey }) {
  const joinTableId = groupType === 'society' ? PEOPLE_SOCIETIES_TABLE : PEOPLE_SPORTS_TABLE;
  const foreignKey = groupType === 'society' ? 'society_id' : 'sport_id';
  const cacheKey = `${personId}::${groupRowId}::${groupType}`;

  if (membershipCache.has(cacheKey)) {
    if (dryRun) {
      return { created: false, updated: true, skipped: false };
    }

    const existingRowId = membershipRowIdByKey.get(cacheKey);
    if (existingRowId && tables) {
      await tables.updateRow({
        databaseId: DB_ID,
        tableId: joinTableId,
        rowId: existingRowId,
        data: {
          last_seen_at: new Date().toISOString(),
          source_csv: sourceCsvLabel,
        },
      });
    }

    return { created: false, updated: true, skipped: false };
  }

  if (!tables) {
    membershipCache.add(cacheKey);
    return { created: true, updated: false, skipped: false };
  }

  membershipCache.add(cacheKey);
  if (dryRun) {
    return { created: true, updated: false, skipped: false };
  }

  await tables.createRow({
    databaseId: DB_ID,
    tableId: joinTableId,
    rowId: ID.unique(),
    data: buildMembershipData(groupType, personId, groupRowId, sourceCsvLabel),
  });

  return { created: true, updated: false, skipped: false };
}

function createTablesClient() {
  const endpoint = process.env.APPWRITE_FUNCTION_ENDPOINT || process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID || '69de7f335c0489352ff1';
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!apiKey) {
    throw new Error('APPWRITE_API_KEY is required in environment when not in local dry-run mode');
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  return new TablesDB(client);
}

function createRuntime(useDbLookups) {
  return {
    useDbLookups,
    tables: useDbLookups ? createTablesClient() : null,
    peoplePreloaded: false,
    personCaches: {
      byUsername: new Map(),
      byProfileUrl: new Map(),
      byName: new Map(),
    },
    membershipStateByGroup: new Map(),
    dryRunCounter: 0,
  };
}

function printSingleSummary({ mode, filePath, groupType, groupLabel, groupId, stats }) {
  console.log('\n=== Import Summary ===');
  console.log(`Mode: ${mode}`);
  console.log(`CSV: ${filePath}`);
  console.log(`Group: ${groupType} -> ${groupLabel} (${groupId})`);
  console.log(`Processed rows: ${stats.total_rows}`);
  console.log(`Skipped empty: ${stats.skipped_empty}`);
  console.log(`Skipped duplicate rows in CSV: ${stats.skipped_duplicate_csv}`);
  console.log(`People created: ${stats.people_created}`);
  console.log(`People updated: ${stats.people_updated}`);
  console.log(`Membership rows created: ${stats.membership_created}`);
  console.log(`Membership rows updated: ${stats.membership_updated}`);
  console.log(`Errors: ${stats.errors}`);
}

async function runSingleImport({
  filePath,
  groupType,
  groupName,
  groupId,
  sourceCsvLabel,
  rowLimit,
  dryRun,
  checkDb,
  createGroupIfMissing,
  runtime,
  printSummary = true,
}) {
  if (!groupType || !isValidGroupType(groupType)) {
    throw new Error('--group-type must be either society or sport');
  }
  if (!groupName && !groupId) {
    throw new Error('--group-name is required unless --group-id is provided');
  }

  const mode = dryRun ? (checkDb ? 'dry-run (with DB checks)' : 'dry-run (local fast)') : 'write';
  const effectiveSource = normalizeString(sourceCsvLabel) || path.basename(filePath || '');

  const csvContent = await fs.readFile(filePath, 'utf8');
  const { headers, records } = parseCsv(csvContent);
  if (headers.length === 0) {
    throw new Error(`CSV appears empty: ${filePath}`);
  }

  const headerMap = buildHeaderMap(headers);
  if (!isMembersCsv(headerMap)) {
    throw new Error(`Members CSV is missing URL/Username/Name columns: ${filePath}`);
  }

  const tables = runtime.tables;
  const groupRow = await resolveGroupRow({
    tables,
    groupType,
    groupName,
    groupId,
    createGroupIfMissing,
    dryRun,
  });

  if (runtime.useDbLookups && tables && !runtime.peoplePreloaded) {
    console.log('Preloading existing people index...');
    const peopleLoaded = await preloadPeopleCaches(tables, runtime.personCaches);
    runtime.peoplePreloaded = true;
    console.log(`Loaded ${peopleLoaded} people rows.`);
  }

  const groupStateKey = `${groupType}::${groupRow.$id}`;
  if (!runtime.membershipStateByGroup.has(groupStateKey)) {
    runtime.membershipStateByGroup.set(groupStateKey, {
      preloaded: false,
      membershipCache: new Set(),
      membershipRowIdByKey: new Map(),
    });
  }
  const membershipState = runtime.membershipStateByGroup.get(groupStateKey);

  if (runtime.useDbLookups && tables && !membershipState.preloaded) {
    console.log(`Preloading existing memberships for ${groupType}=${groupRow.name || groupName || groupId}...`);
    const membershipsLoaded = await preloadMembershipCache({
      tables,
      groupType,
      groupRowId: groupRow.$id,
      membershipCache: membershipState.membershipCache,
      membershipRowIdByKey: membershipState.membershipRowIdByKey,
    });
    membershipState.preloaded = true;
    console.log(`Loaded ${membershipsLoaded} membership rows for this group.`);
  }

  const limitedRecords = rowLimit ? records.slice(0, rowLimit) : records;
  const stats = {
    total_rows: limitedRecords.length,
    skipped_empty: 0,
    skipped_duplicate_csv: 0,
    people_created: 0,
    people_updated: 0,
    membership_created: 0,
    membership_updated: 0,
    errors: 0,
  };

  const seenCsvKeys = new Set();

  for (let i = 0; i < limitedRecords.length; i += 1) {
    const row = limitedRecords[i];

    try {
      const candidate = buildCandidateFromRow(row, i, headerMap);
      if (!candidate) {
        stats.skipped_empty += 1;
        continue;
      }

      const csvDedupKey = `${candidate.normalized_username}::${candidate.url}::${candidate.normalized_name}`;
      if (seenCsvKeys.has(csvDedupKey)) {
        stats.skipped_duplicate_csv += 1;
        continue;
      }
      seenCsvKeys.add(csvDedupKey);

      let person = await findExistingPerson(tables, runtime.personCaches, {
        normalized_username: candidate.normalized_username,
        profile_url: candidate.url,
        normalized_name: candidate.normalized_name,
      });

      if (!person) {
        const payload = {
          full_name: candidate.full_name,
          normalized_name: candidate.normalized_name || normalizeName(candidate.full_name),
          username: candidate.username || null,
          normalized_username: candidate.normalized_username || null,
          profile_url: candidate.url || null,
          linkedin_url: null,
          source: effectiveSource || null,
        };

        if (dryRun) {
          runtime.dryRunCounter += 1;
          person = {
            $id: `dryrun_person_${runtime.dryRunCounter}`,
            ...payload,
          };
        } else {
          person = await tables.createRow({
            databaseId: DB_ID,
            tableId: PEOPLE_TABLE,
            rowId: ID.unique(),
            data: payload,
          });
        }

        setCaches(runtime.personCaches, person);
        stats.people_created += 1;
      } else {
        const patch = buildPersonPatch(person, {
          full_name: candidate.full_name,
          normalized_name: candidate.normalized_name,
          username: candidate.username,
          normalized_username: candidate.normalized_username,
          profile_url: candidate.url,
        }, effectiveSource);

        if (Object.keys(patch).length > 0) {
          if (!dryRun) {
            person = await tables.updateRow({
              databaseId: DB_ID,
              tableId: PEOPLE_TABLE,
              rowId: person.$id,
              data: patch,
            });
          } else {
            person = { ...person, ...patch };
          }
          stats.people_updated += 1;
        }

        setCaches(runtime.personCaches, person);
      }

      const membership = await upsertMembership({
        tables,
        groupType,
        groupRowId: groupRow.$id,
        personId: person.$id,
        sourceCsvLabel: effectiveSource,
        dryRun,
        membershipCache: membershipState.membershipCache,
        membershipRowIdByKey: membershipState.membershipRowIdByKey,
      });

      if (membership.created) stats.membership_created += 1;
      if (membership.updated) stats.membership_updated += 1;
    } catch (err) {
      stats.errors += 1;
      console.error(`[row ${i + 2}] ${err.message}`);
    }
  }

  if (printSummary) {
    printSingleSummary({
      mode,
      filePath,
      groupType,
      groupLabel: groupRow.name || groupName || groupId,
      groupId: groupRow.$id,
      stats,
    });
  }

  return {
    mode,
    filePath,
    groupType,
    groupLabel: groupRow.name || groupName || groupId,
    groupId: groupRow.$id,
    stats,
  };
}

async function runManifestImport({ manifestPath, manifestEntries, dryRun, checkDb, createGroupIfMissing, rowLimit }) {
  const useDbLookups = !dryRun || checkDb;
  const runtime = createRuntime(useDbLookups);

  const aggregate = {
    files: manifestEntries.length,
    total_rows: 0,
    skipped_empty: 0,
    skipped_duplicate_csv: 0,
    people_created: 0,
    people_updated: 0,
    membership_created: 0,
    membership_updated: 0,
    errors: 0,
    file_errors: 0,
  };

  for (let i = 0; i < manifestEntries.length; i += 1) {
    const entry = manifestEntries[i];
    console.log(`\n--- Manifest Entry ${i + 1}/${manifestEntries.length} (line ${entry.line}) ---`);

    try {
      const result = await runSingleImport({
        filePath: entry.filePath,
        groupType: entry.groupType,
        groupName: entry.groupName,
        groupId: entry.groupId,
        sourceCsvLabel: entry.sourceCsv,
        rowLimit,
        dryRun,
        checkDb,
        createGroupIfMissing,
        runtime,
        printSummary: true,
      });

      const s = result.stats;
      aggregate.total_rows += s.total_rows;
      aggregate.skipped_empty += s.skipped_empty;
      aggregate.skipped_duplicate_csv += s.skipped_duplicate_csv;
      aggregate.people_created += s.people_created;
      aggregate.people_updated += s.people_updated;
      aggregate.membership_created += s.membership_created;
      aggregate.membership_updated += s.membership_updated;
      aggregate.errors += s.errors;
    } catch (err) {
      aggregate.file_errors += 1;
      console.error(`Manifest entry failed at line ${entry.line}: ${err.message}`);
    }
  }

  console.log('\n=== Batch Import Summary ===');
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Files processed: ${aggregate.files}`);
  console.log(`File-level failures: ${aggregate.file_errors}`);
  console.log(`Total rows processed: ${aggregate.total_rows}`);
  console.log(`Skipped empty: ${aggregate.skipped_empty}`);
  console.log(`Skipped duplicate rows in CSVs: ${aggregate.skipped_duplicate_csv}`);
  console.log(`People created: ${aggregate.people_created}`);
  console.log(`People updated: ${aggregate.people_updated}`);
  console.log(`Membership rows created: ${aggregate.membership_created}`);
  console.log(`Membership rows updated: ${aggregate.membership_updated}`);
  console.log(`Row-level errors: ${aggregate.errors}`);

  if (aggregate.errors > 0 || aggregate.file_errors > 0) {
    process.exitCode = 1;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  const filePath = normalizeString(args.file);
  const groupTypeArg = toLowerKey(args['group-type']);
  const groupNameArg = normalizeString(args['group-name']);
  const groupIdArg = normalizeString(args['group-id']);
  const sourceCsvArg = normalizeString(args['source-csv']);
  const rowLimit = args.limit ? Number.parseInt(args.limit, 10) : null;

  if (!filePath) throw new Error('--file is required');
  if (rowLimit !== null && (!Number.isFinite(rowLimit) || rowLimit <= 0)) {
    throw new Error('--limit must be a positive integer');
  }

  const csvContent = await fs.readFile(filePath, 'utf8');
  const { headers, records } = parseCsv(csvContent);
  if (headers.length === 0) {
    throw new Error('CSV appears empty');
  }

  const headerMap = buildHeaderMap(headers);
  const explicitSingleMode = Boolean(groupTypeArg || groupNameArg || groupIdArg);

  if (isMembersCsv(headerMap) || explicitSingleMode) {
    if (!groupTypeArg || !isValidGroupType(groupTypeArg)) {
      throw new Error('--group-type must be either society or sport for single members CSV mode');
    }
    if (!groupNameArg && !groupIdArg) {
      throw new Error('--group-name is required unless --group-id is provided in single members CSV mode');
    }

    const useDbLookups = !args.dryRun || args.checkDb;
    const runtime = createRuntime(useDbLookups);
    const sourceCsvLabel = sourceCsvArg || path.basename(filePath);

    const result = await runSingleImport({
      filePath,
      groupType: groupTypeArg,
      groupName: groupNameArg,
      groupId: groupIdArg,
      sourceCsvLabel,
      rowLimit,
      dryRun: args.dryRun,
      checkDb: args.checkDb,
      createGroupIfMissing: args.createGroupIfMissing,
      runtime,
      printSummary: true,
    });

    if (result.stats.errors > 0) {
      process.exitCode = 1;
    }
    return;
  }

  const manifestEntries = parseManifestEntries({ manifestPath: filePath, headers, records });
  if (manifestEntries.length === 0) {
    throw new Error('Manifest CSV contained no usable entries. Expected path + group_name columns.');
  }

  await runManifestImport({
    manifestPath: filePath,
    manifestEntries,
    dryRun: args.dryRun,
    checkDb: args.checkDb,
    createGroupIfMissing: args.createGroupIfMissing,
    rowLimit,
  });
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
