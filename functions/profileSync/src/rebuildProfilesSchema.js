import fs from 'node:fs/promises';
import path from 'node:path';
import { Client, Query, TablesDB } from 'node-appwrite';

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.APPWRITE_FUNCTION_PROJECT_ID || '69de7f335c0489352ff1';
const apiKey = process.env.APPWRITE_API_KEY;

if (!apiKey) {
  console.error('APPWRITE_API_KEY is required. Export it before running this script.');
  process.exit(1);
}

const DB_ID = 'supercharged';
const TABLE_ID = 'profiles';

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const tables = new TablesDB(client);

const TABLE_PERMISSIONS = [
  'read("users")',
  'create("users")',
  'update("users")',
  'delete("users")'
];

const VARCHAR_COLUMNS = [
  { key: 'user_id', size: 36, required: true },
  { key: 'full_name', size: 128, required: true },
  { key: 'primary_intent', size: 32, required: true },
  { key: 'email', size: 256, required: false },
  { key: 'first_name', size: 128, required: true },
  { key: 'last_name', size: 128, required: false },
  { key: 'birthday_day', size: 2, required: false },
  { key: 'birthday_month', size: 2, required: false },
  { key: 'birthday_year', size: 4, required: false },
  { key: 'username', size: 20, required: false },
  { key: 'college', size: 64, required: false },
  { key: 'course', size: 128, required: false },
  { key: 'stage', size: 32, required: false },
  { key: 'study_subject', size: 128, required: false },
  { key: 'year_of_study', size: 32, required: false },
  { key: 'cv_file_id', size: 36, required: false },
  { key: 'career_field', size: 64, required: false },
  { key: 'career_subfield', size: 128, required: false },
  { key: 'networking_style', size: 64, required: false },
  { key: 'intellectual_identity', size: 128, required: false },
  { key: 'intellectual_venue', size: 128, required: false },
  { key: 'intellectual_ambition', size: 256, required: false },
  { key: 'work_style', size: 128, required: false },
  { key: 'project_stage', size: 64, required: false },
  { key: 'relationship_intent', size: 64, required: false },
  { key: 'relationship_status', size: 64, required: false },
  { key: 'sexuality', size: 64, required: false }
];

const TEXT_COLUMNS = [
  { key: 'free_text_responses', required: false },
  { key: 'building_description', required: false },
  { key: 'wish_studied', required: false },
  { key: 'study_wish', required: false },
  { key: 'hobby', required: false },
  { key: 'music', required: false },
  { key: 'societies', required: false },
  { key: 'honest_thing', required: false }
];

const ARRAY_VARCHAR_COLUMNS = [
  { key: 'goals', size: 64 },
  { key: 'desired_connections', size: 128 },
  { key: 'startup_connections', size: 128 },
  { key: 'social_circles', size: 64 },
  { key: 'friendship_values', size: 64 },
  { key: 'dating_appearance', size: 64 },
  { key: 'dating_personality', size: 64 },
  { key: 'dating_hobbies', size: 128 },
  { key: 'friend_references', size: 256 }
];

const BOOLEAN_COLUMNS = [
  { key: 'cv_indexed', xdefault: false },
  { key: 'is_onboarding_complete', xdefault: false },
  { key: 'is_indexed', xdefault: false }
];

const MEDIUMTEXT_COLUMNS = [
  { key: 'cv_parsed_text', required: false }
];

const INDEXES = [
  { key: 'idx_user_auth', type: 'unique', columns: ['user_id'] },
  { key: 'idx_email', type: 'key', columns: ['email'] },
  { key: 'idx_college', type: 'key', columns: ['college'] },
  { key: 'idx_intent', type: 'key', columns: ['primary_intent'] }
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isNotFound(err) {
  return err?.code === 404 || /not found/i.test(err?.message || '');
}

function isAlreadyExists(err) {
  return err?.code === 409 || /already exists/i.test(err?.message || '');
}

async function safe(label, fn) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
  } catch (err) {
    if (isAlreadyExists(err)) {
      console.log(`  ~ ${label} (already exists)`);
      return;
    }
    throw err;
  }
}

async function getAllRows() {
  const rows = [];
  let offset = 0;
  const pageSize = 100;

  while (true) {
    const res = await tables.listRows({
      databaseId: DB_ID,
      tableId: TABLE_ID,
      queries: [Query.limit(pageSize), Query.offset(offset)]
    });

    const batch = res?.rows || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += batch.length;
  }

  return rows;
}

async function backupRowsIfAny() {
  try {
    const rows = await getAllRows();
    if (rows.length === 0) {
      console.log('  ~ No existing rows to back up');
      return;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outDir = path.join(process.cwd(), 'notes');
    await fs.mkdir(outDir, { recursive: true });
    const outFile = path.join(outDir, `profiles_backup_${stamp}.json`);
    await fs.writeFile(outFile, JSON.stringify(rows, null, 2), 'utf8');
    console.log(`  ✓ Backed up ${rows.length} rows to ${outFile}`);
  } catch (err) {
    if (isNotFound(err)) {
      console.log('  ~ Profiles table not found, skipping backup');
      return;
    }
    throw err;
  }
}

async function waitForTableDeletion() {
  for (let i = 0; i < 30; i++) {
    try {
      await tables.getTable({ databaseId: DB_ID, tableId: TABLE_ID });
      await sleep(1000);
    } catch (err) {
      if (isNotFound(err)) return;
      throw err;
    }
  }
  throw new Error('Timed out waiting for table deletion');
}

async function recreateProfilesTable() {
  console.log('\nRebuilding profiles table (destructive for this table only)\n');

  await backupRowsIfAny();

  try {
    await tables.getTable({ databaseId: DB_ID, tableId: TABLE_ID });
    console.log('  • Deleting existing profiles table...');
    await tables.deleteTable({ databaseId: DB_ID, tableId: TABLE_ID });
    await waitForTableDeletion();
    console.log('  ✓ Deleted existing profiles table');
  } catch (err) {
    if (!isNotFound(err)) throw err;
    console.log('  ~ Profiles table did not exist, creating fresh');
  }

  await safe('Create profiles table', () =>
    tables.createTable({
      databaseId: DB_ID,
      tableId: TABLE_ID,
      name: 'Profiles',
      permissions: TABLE_PERMISSIONS,
      rowSecurity: true,
      enabled: true
    })
  );

  console.log('\n  • Creating varchar columns...');
  for (const col of VARCHAR_COLUMNS) {
    await safe(`Column ${col.key}`, () =>
      tables.createVarcharColumn({
        databaseId: DB_ID,
        tableId: TABLE_ID,
        key: col.key,
        size: col.size,
        required: col.required,
        array: false
      })
    );
  }

  console.log('\n  • Creating text columns...');
  for (const col of TEXT_COLUMNS) {
    await safe(`Column ${col.key}`, () =>
      tables.createTextColumn({
        databaseId: DB_ID,
        tableId: TABLE_ID,
        key: col.key,
        required: col.required,
        array: false
      })
    );
  }

  console.log('\n  • Creating array varchar columns...');
  for (const col of ARRAY_VARCHAR_COLUMNS) {
    await safe(`Column ${col.key}[]`, () =>
      tables.createVarcharColumn({
        databaseId: DB_ID,
        tableId: TABLE_ID,
        key: col.key,
        size: col.size,
        required: false,
        array: true
      })
    );
  }

  console.log('\n  • Creating boolean/integer/datetime columns...');
  for (const col of BOOLEAN_COLUMNS) {
    await safe(`Column ${col.key}`, () =>
      tables.createBooleanColumn({
        databaseId: DB_ID,
        tableId: TABLE_ID,
        key: col.key,
        required: false,
        xdefault: col.xdefault,
        array: false
      })
    );
  }

  await safe('Column social_energy', () =>
    tables.createIntegerColumn({
      databaseId: DB_ID,
      tableId: TABLE_ID,
      key: 'social_energy',
      required: false,
      array: false
    })
  );

  await safe('Column last_scanned_at', () =>
    tables.createDatetimeColumn({
      databaseId: DB_ID,
      tableId: TABLE_ID,
      key: 'last_scanned_at',
      required: false,
      array: false
    })
  );

  console.log('\n  • Creating mediumtext columns...');
  for (const col of MEDIUMTEXT_COLUMNS) {
    await safe(`Column ${col.key}`, () =>
      tables.createMediumtextColumn({
        databaseId: DB_ID,
        tableId: TABLE_ID,
        key: col.key,
        required: col.required,
        array: false
      })
    );
  }

  console.log('\n  • Waiting for columns to settle before index creation...');
  await sleep(5000);

  console.log('\n  • Creating indexes...');
  for (const idx of INDEXES) {
    await safe(`Index ${idx.key}`, () =>
      tables.createIndex({
        databaseId: DB_ID,
        tableId: TABLE_ID,
        key: idx.key,
        type: idx.type,
        columns: idx.columns
      })
    );
  }

  const table = await tables.getTable({ databaseId: DB_ID, tableId: TABLE_ID });
  const stuck = (table.columns || []).filter((c) => c.status && c.status !== 'available');

  console.log('\nDone.');
  console.log(`  Columns: ${(table.columns || []).length}`);
  console.log(`  Indexes: ${(table.indexes || []).length}`);
  if (stuck.length > 0) {
    console.log(`  ⚠ Non-available columns: ${stuck.map((c) => `${c.key}:${c.status}`).join(', ')}`);
  }
}

recreateProfilesTable().catch((err) => {
  console.error('\nSchema rebuild failed:', err?.message || err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});
