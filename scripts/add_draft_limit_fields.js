const { Client, Databases } = require('node-appwrite');

async function main() {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://fra.cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || 'supercharged')
    .setKey(process.env.APPWRITE_API_KEY || process.env.VITE_APPWRITE_API_KEY || ''); // Need a valid key with tablesdb scopes

  const databases = new Databases(client);
  const dbId = 'supercharged';
  const tableId = 'profiles';

  console.log('Adding ai_drafts_used (integer, default 0)...');
  try {
    await databases.createIntegerAttribute(dbId, tableId, 'ai_drafts_used', false, 0, 1000, 0);
    console.log('Added ai_drafts_used');
  } catch (e) {
    console.error('Failed to add ai_drafts_used:', e.message);
  }

  console.log('Adding ai_drafts_reset_at (datetime, default null)...');
  try {
    await databases.createDatetimeAttribute(dbId, tableId, 'ai_drafts_reset_at', false);
    console.log('Added ai_drafts_reset_at');
  } catch (e) {
    console.error('Failed to add ai_drafts_reset_at:', e.message);
  }
}

main().catch(console.error);
