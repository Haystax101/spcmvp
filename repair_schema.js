import { Client, TablesDB } from 'node-appwrite';
import 'dotenv/config';

const client = new Client()
  .setEndpoint('https://fra.cloud.appwrite.io/v1')
  .setProject('69de7f335c0489352ff1') // hardcoded from appwrite.json
  .setKey(process.env.APPWRITE_API_KEY);

const tables = new TablesDB(client);
const dbId = 'supercharged';
const tProfiles = 'profiles';
const tMatches = 'matches';
const tLogs = 'match_logs';

async function repairSchema() {
  console.log("Starting schema repair and table creation...");
  
  try {
    // 1. Restore missing Columns in profiles
    console.log("Restoring course column...");
    await tables.createStringColumn(dbId, tProfiles, 'course', 128, false).catch(e => console.log("course:", e.message));

    console.log("Restoring stage column...");
    await tables.createStringColumn(dbId, tProfiles, 'stage', 32, false).catch(e => console.log("stage:", e.message));

    console.log("Restoring primary_intent column...");
    // xdefault required bug workaround - pass null/undefined if needed, or default string
    await tables.createStringColumn(dbId, tProfiles, 'primary_intent', 32, true).catch(e => console.log("primary_intent:", e.message));

    console.log("Restoring free_text_responses column...");
    await tables.createStringColumn(dbId, tProfiles, 'free_text_responses', 10000, false).catch(e => console.log("free_text_responses:", e.message));

    // Wait a brief moment for columns to become active
    console.log("Waiting 3s for columns to initialize...");
    await new Promise(r => setTimeout(r, 3000));

    // 2. Restore/Create Indexes in profiles
    console.log("Creating idx_user_auth (UNIQUE)...");
    await tables.createIndex(dbId, tProfiles, 'idx_user_auth', 'unique', ['user_id']).catch(e => console.log("idx_user_auth:", e.message));

    console.log("Creating idx_intent (KEY)...");
    await tables.createIndex(dbId, tProfiles, 'idx_intent', 'key', ['primary_intent']).catch(e => console.log("idx_intent:", e.message));

    // 3. Create Indexes in matches
    console.log("Creating idx_match_pair (UNIQUE)...");
    await tables.createIndex(dbId, tMatches, 'idx_match_pair', 'unique', ['user_a_id', 'user_b_id']).catch(e => console.log("idx_match_pair:", e.message));

    // 4. Create match_logs table if it doesn't exist
    console.log("Creating match_logs table...");
    try {
      await tables.create(dbId, tLogs, 'Match Logs (Observability)');
      console.log("Table created. Waiting 2s...");
      await new Promise(r => setTimeout(r, 2000));
    } catch(e) {
      console.log("Match_logs table:", e.message);
    }
    
    console.log("Creating match_logs columns...");
    await tables.createStringColumn(dbId, tLogs, 'user_a_id', 36, true).catch(e => console.log("user_a_id:", e.message));
    await tables.createStringColumn(dbId, tLogs, 'user_b_id', 36, true).catch(e => console.log("user_b_id:", e.message));
    await tables.createStringColumn(dbId, tLogs, 'input_context', 10000, true).catch(e => console.log("input_context:", e.message));
    await tables.createStringColumn(dbId, tLogs, 'model_output', 10000, true).catch(e => console.log("model_output:", e.message));
    await tables.createBooleanColumn(dbId, tLogs, 'human_feedback', false).catch(e => console.log("human_feedback:", e.message));

    console.log("Schema repair complete!");

  } catch (error) {
    console.error("Critical script error:", error);
  }
}

repairSchema();
