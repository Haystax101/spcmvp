import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DB_ID || 'supercharged';
const messagesTable = process.env.APPWRITE_MESSAGES_TABLE || 'messages';

if (!projectId || !apiKey) {
    console.error('Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY');
    process.exit(1);
}

const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

const databases = new Databases(client);

async function createIndexes() {
    console.log(`Creating indexes on database: ${databaseId}, table: ${messagesTable}`);

    try {
        console.log('Creating index_conversation_sent...');
        await databases.createIndex(
            databaseId,
            messagesTable,
            'index_conversation_sent',
            'key',
            ['conversation', 'sent_at'],
            ['ASC', 'ASC']
        );
        console.log('✅ index_conversation_sent created (or already exists).');
    } catch (e) {
        if (e.code === 409) console.log('✅ index_conversation_sent already exists.');
        else console.error(`❌ Failed to create index_conversation_sent: ${e.message}`);
    }

    try {
        console.log('Creating index_unread_calc...');
        await databases.createIndex(
            databaseId,
            messagesTable,
            'index_unread_calc',
            'key',
            ['conversation', 'sender', 'delivery_status', 'sent_at'],
            ['ASC', 'ASC', 'ASC', 'ASC']
        );
        console.log('✅ index_unread_calc created (or already exists).');
    } catch (e) {
        if (e.code === 409) console.log('✅ index_unread_calc already exists.');
        else console.error(`❌ Failed to create index_unread_calc: ${e.message}`);
    }
}

createIndexes();
