#!/usr/bin/env node
import 'dotenv/config';
import { Client, TablesDB, Permission, Role, Query } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const tables = new TablesDB(client);

const DB_ID = process.env.APPWRITE_DB_ID || 'supercharged';
const PROFILES_TABLE = process.env.APPWRITE_PROFILES_TABLE || 'profiles';
const VOLTZ_LEDGER_TABLE = process.env.APPWRITE_VOLTZ_LEDGER_TABLE || 'voltz_ledger';

async function backfillPermissions() {
  console.log('Starting voltz_ledger permission backfill...');

  try {
    // Fetch all voltz ledger rows
    let allRows = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      console.log(`Fetching rows offset ${offset}...`);
      const response = await tables.listRows({
        databaseId: DB_ID,
        tableId: VOLTZ_LEDGER_TABLE,
        queries: [Query.limit(limit), Query.offset(offset)],
      });

      allRows = allRows.concat(response.rows || []);
      hasMore = (response.rows?.length || 0) === limit;
      offset += limit;
    }

    console.log(`Found ${allRows.length} voltz ledger rows to backfill`);

    // For each row, fetch the associated profile and update permissions
    let updated = 0;
    let skipped = 0;

    for (const row of allRows) {
      try {
        // Get the profile associated with this ledger row
        const profileId = row.profile_row_id || row.profile;
        if (!profileId) {
          console.log(`Skipping row ${row.$id}: no profile_row_id`);
          skipped++;
          continue;
        }

        // Fetch profile to get user_id
        const profileRes = await tables.listRows({
          databaseId: DB_ID,
          tableId: PROFILES_TABLE,
          queries: [Query.equal('$id', profileId), Query.limit(1)],
        });

        const profile = profileRes.rows?.[0];
        if (!profile?.user_id) {
          console.log(`Skipping row ${row.$id}: profile has no user_id`);
          skipped++;
          continue;
        }

        // Update the row with permissions
        await tables.updateRow({
          databaseId: DB_ID,
          tableId: VOLTZ_LEDGER_TABLE,
          rowId: row.$id,
          data: {},
          permissions: [Permission.read(Role.user(profile.user_id))],
        });

        updated++;
        if (updated % 10 === 0) {
          console.log(`Updated ${updated}/${allRows.length}`);
        }
      } catch (err) {
        console.error(`Failed to update row ${row.$id}:`, err.message);
        skipped++;
      }
    }

    console.log(`\n✓ Backfill complete: ${updated} updated, ${skipped} skipped`);
  } catch (err) {
    console.error('Backfill failed:', err);
    process.exit(1);
  }
}

backfillPermissions();
