import { Client, TablesDB, ID } from 'node-appwrite';
import 'dotenv/config';

const client = new Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1')
    .setProject('69de7f335c0489352ff1')
    .setKey(process.env.APPWRITE_API_KEY);

const tables = new TablesDB(client);

async function runTest() {
    console.log("🚀 Starting Mock Profile Sync Test...");

    try {
        // 1. Create a mock profile
        const docId = ID.unique();
        console.log(`Creating profile: ${docId}`);

        const profile = await tables.createRow({
            databaseId: 'supercharged',
            tableId: 'profiles',
            rowId: docId,
            data: {
                user_id: 'test_user_999',
                full_name: 'Testy McTestFace',
                college: 'Magdalen',
                primary_intent: 'Professional Networking',
                free_text_responses: 'I am a test profile interested in AI and search engines.',
                is_indexed: false
            }
        });

        console.log("✅ Profile created! Wait 10s for function to trigger...");
        await new Promise(r => setTimeout(r, 10000));

        // 2. You can check your Qdrant Dashboard here or via CLI 
        console.log("👉 Now check Qdrant for Doc ID: " + docId);



    } catch (error) {
        console.error("❌ Test failed:", error.message);
    }
}

runTest();
