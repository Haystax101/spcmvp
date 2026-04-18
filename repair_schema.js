import { Client, TablesDB, Storage } from 'node-appwrite';
import 'dotenv/config';

const client = new Client()
  .setEndpoint('https://fra.cloud.appwrite.io/v1')
  .setProject('69de7f335c0489352ff1')
  .setKey(process.env.APPWRITE_API_KEY);

const tables = new TablesDB(client);
const storage = new Storage(client);
const dbId = 'supercharged';
const tProfiles = 'profiles';
const tMatches = 'matches';
const tLogs = 'match_logs';

// Helper: create column, swallowing "already exists" errors
async function addCol(fn, label) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
  } catch (e) {
    if (e.message?.includes('already exists') || e.code === 409) {
      console.log(`  ~ ${label} (already exists, skipped)`);
    } else {
      console.error(`  ✗ ${label}: ${e.message}`);
    }
  }
}

// Helper: create index, swallowing "already exists" errors
async function addIdx(fn, label) {
  try {
    await fn();
    console.log(`  ✓ index: ${label}`);
  } catch (e) {
    if (e.message?.includes('already exists') || e.code === 409) {
      console.log(`  ~ index: ${label} (already exists, skipped)`);
    } else {
      console.error(`  ✗ index: ${label}: ${e.message}`);
    }
  }
}

// Helper: create storage bucket, swallowing "already exists" errors
async function ensureBucket(bucketId, name) {
  try {
    await storage.createBucket(bucketId, name, ['read("users")', 'create("users")']);
    console.log(`  ✓ bucket: ${name}`);
  } catch (e) {
    if (e.message?.includes('already exists') || e.code === 409) {
      console.log(`  ~ bucket: ${name} (already exists, skipped)`);
    } else {
      console.error(`  ✗ bucket: ${name}: ${e.message}`);
    }
  }
}

async function repairSchema() {
  console.log('\n🔧 Supercharged Schema Repair — Starting...\n');

  // ── PROFILES TABLE ──────────────────────────────────────────────────────────
  console.log('== profiles table ==');

  // Identity fields
  await addCol(() => tables.createStringColumn(dbId, tProfiles, 'user_id',   36,  true),  'user_id');
  await addCol(() => tables.createStringColumn(dbId, tProfiles, 'email',     256, false), 'email');
  await addCol(() => tables.createStringColumn(dbId, tProfiles, 'first_name',128, true),  'first_name');
  await addCol(() => tables.createStringColumn(dbId, tProfiles, 'last_name', 128, false), 'last_name');
  await addCol(() => tables.createStringColumn(dbId, tProfiles, 'college',   64,  false), 'college');

  // CV fields
  await addCol(() => tables.createStringColumn(dbId, tProfiles, 'cv_file_id',    36,    false), 'cv_file_id');
  await addCol(() => tables.createStringColumn(dbId, tProfiles, 'cv_parsed_text', 50000, false), 'cv_parsed_text');
  await addCol(() => tables.createBooleanColumn(dbId, tProfiles, 'cv_indexed', false),           'cv_indexed');

  // Goals — multi-select array
  await addCol(() => tables.createStringColumn(dbId, tProfiles, 'goals', 64, false, null, true), 'goals (array)');

  // Professional fields
  await addCol(() => tables.createStringColumn(dbId, tProfiles, 'career_field',    64,  false),       'career_field');
  await addCol(() => tables.createStringColumn(dbId, tProfiles, 'desired_connections', 128, false, null, true), 'desired_connections (array)');
  await addCol(() => tables.createStringColumn(dbId, tProfiles, 'networking_style', 64,  false),      'networking_style');
  await addCol(() => tables.createStringColumn(dbId, tProfiles, 'work_style',      128, false),       'work_style');
  await addCol(() => tables.createStringColumn(dbId, tProfiles, 'project_stage',   64,  false),       'project_stage');

  // Social/personality fields
  await addCol(() => tables.createStringColumn(dbId, tProfiles, 'social_circles',       64,   false, null, true), 'social_circles (array)');
  await addCol(() => tables.createStringColumn(dbId, tProfiles, 'friendship_values',    64,   false, null, true), 'friendship_values (array)');
  await addCol(() => tables.createStringColumn(dbId, tProfiles, 'intellectual_identity',128,  false),             'intellectual_identity');
  await addCol(() => tables.createIntegerColumn(dbId, tProfiles, 'social_energy', false),                         'social_energy');
  await addCol(() => tables.createStringColumn(dbId, tProfiles, 'relationship_intent', 64,   false),              'relationship_intent');

  // Free-text semantic fields
  await addCol(() => tables.createStringColumn(dbId, tProfiles, 'wish_studied',  1024, false), 'wish_studied');
  await addCol(() => tables.createStringColumn(dbId, tProfiles, 'honest_thing',  1024, false), 'honest_thing');

  // Social graph seed
  await addCol(() => tables.createStringColumn(dbId, tProfiles, 'friend_references', 256, false, null, true), 'friend_references (array)');

  // System / sync fields
  await addCol(() => tables.createBooleanColumn(dbId, tProfiles, 'is_onboarding_complete', false), 'is_onboarding_complete');
  await addCol(() => tables.createBooleanColumn(dbId, tProfiles, 'is_indexed',    false), 'is_indexed');
  await addCol(() => tables.createDatetimeColumn(dbId, tProfiles, 'last_scanned_at', false), 'last_scanned_at');

  console.log('\n  — Waiting 3s for columns to become active...');
  await new Promise(r => setTimeout(r, 3000));

  // Indexes for profiles
  console.log('\n  Indexes:');
  await addIdx(() => tables.createIndex(dbId, tProfiles, 'idx_user_auth', 'unique', ['user_id']),   'idx_user_auth (unique)');
  await addIdx(() => tables.createIndex(dbId, tProfiles, 'idx_email',     'key',    ['email']),      'idx_email');
  await addIdx(() => tables.createIndex(dbId, tProfiles, 'idx_college',   'key',    ['college']),    'idx_college');

  // ── MATCHES TABLE ────────────────────────────────────────────────────────────
  console.log('\n== matches table ==');
  await addCol(() => tables.createStringColumn(dbId, tMatches, 'user_a_id',          36,   true),  'user_a_id');
  await addCol(() => tables.createStringColumn(dbId, tMatches, 'user_b_id',          36,   true),  'user_b_id');
  await addCol(() => tables.createFloatColumn (dbId, tMatches, 'compatibility_score', true),        'compatibility_score');
  await addCol(() => tables.createStringColumn(dbId, tMatches, 'narrative',          5000, true),  'narrative');
  await addCol(() => tables.createStringColumn(dbId, tMatches, 'top_drivers',        1024, false, null, true), 'top_drivers (array)');

  await new Promise(r => setTimeout(r, 2000));
  await addIdx(() => tables.createIndex(dbId, tMatches, 'idx_match_pair', 'unique', ['user_a_id', 'user_b_id']), 'idx_match_pair (unique)');

  // ── MATCH LOGS TABLE ─────────────────────────────────────────────────────────
  console.log('\n== match_logs table ==');
  try {
    await tables.create(dbId, tLogs, 'Match Logs (Observability)');
    console.log('  Table created. Waiting 2s...');
    await new Promise(r => setTimeout(r, 2000));
  } catch (e) {
    console.log(`  ~ match_logs: ${e.message}`);
  }
  await addCol(() => tables.createStringColumn(dbId, tLogs, 'user_a_id',     36,    true), 'user_a_id');
  await addCol(() => tables.createStringColumn(dbId, tLogs, 'user_b_id',     36,    true), 'user_b_id');
  await addCol(() => tables.createStringColumn(dbId, tLogs, 'input_context', 10000, true), 'input_context');
  await addCol(() => tables.createStringColumn(dbId, tLogs, 'model_output',  10000, true), 'model_output');
  await addCol(() => tables.createBooleanColumn(dbId, tLogs, 'human_feedback', false),     'human_feedback');

  // ── STORAGE BUCKET for CVs ───────────────────────────────────────────────────
  console.log('\n== storage buckets ==');
  await ensureBucket('cvs', 'CVs');

  console.log('\n✅ Schema repair complete!\n');
}

repairSchema().catch(e => {
  console.error('💥 Critical error:', e);
  process.exit(1);
});
