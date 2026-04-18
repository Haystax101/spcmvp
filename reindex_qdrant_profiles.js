import { Client, TablesDB, Functions, Query } from 'node-appwrite';
import 'dotenv/config';

const endpoint = process.env.APPWRITE_FUNCTION_ENDPOINT || process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID || '69de7f335c0489352ff1';
const apiKey = process.env.APPWRITE_API_KEY;

const DB_ID = process.env.APPWRITE_DB_ID || 'supercharged';
const PROFILES_TABLE = process.env.APPWRITE_PROFILES_TABLE || 'profiles';
const PROFILE_SYNC_FUNCTION_ID = process.env.PROFILE_SYNC_FUNCTION_ID || 'profileSync';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const onlyNotIndexed = args.has('--only-not-indexed');
const includeIncomplete = args.has('--include-incomplete');

if (!apiKey) {
  console.error('APPWRITE_API_KEY is required.');
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const tables = new TablesDB(client);
const functions = new Functions(client);

async function getAllRows() {
  const pageSize = 100;
  let offset = 0;
  const rows = [];

  while (true) {
    const queries = [Query.limit(pageSize), Query.offset(offset)];
    if (!includeIncomplete) {
      queries.push(Query.equal('is_onboarding_complete', true));
    }
    if (onlyNotIndexed) {
      queries.push(Query.equal('is_indexed', false));
    }

    const page = await tables.listRows({
      databaseId: DB_ID,
      tableId: PROFILES_TABLE,
      queries,
    });

    const batch = page.rows || [];
    rows.push(...batch);

    if (batch.length < pageSize) break;
    offset += batch.length;
  }

  return rows;
}

async function run() {
  console.log('Fetching profiles for reindex...');
  const rows = await getAllRows();
  console.log(`Profiles selected: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nothing to reindex.');
    return;
  }

  if (dryRun) {
    console.log('Dry run mode enabled. No function executions triggered.');
    return;
  }

  let success = 0;
  let failed = 0;

  for (const [idx, row] of rows.entries()) {
    try {
      const execution = await functions.createExecution(
        PROFILE_SYNC_FUNCTION_ID,
        JSON.stringify(row),
        false
      );

      const output = JSON.parse(execution.responseBody || '{}');
      if (output.success === false) {
        throw new Error(output.error || 'Unknown profileSync error');
      }

      success += 1;
      console.log(`[${idx + 1}/${rows.length}] Reindexed user ${row.user_id}`);
    } catch (err) {
      failed += 1;
      console.error(`[${idx + 1}/${rows.length}] Failed for user ${row.user_id}: ${err.message}`);
    }
  }

  console.log('\n=== Reindex Summary ===');
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
}

run().catch((err) => {
  console.error('Reindex run failed:', err);
  process.exit(1);
});
