import { Client, Functions } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const functionId = process.env.APPWRITE_MESSAGE_GATEWAY_FUNCTION_ID || 'messageGateway';

const convId = process.argv[2];
const messageText = process.argv[3] || "Test message";

if (!convId) {
    console.error('Usage: node send_test_message.js <CONVERSATION_ID> "Message text"');
    process.exit(1);
}

if (!projectId || !apiKey) {
    console.error('Missing credentials in .env');
    process.exit(1);
}

const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

const functions = new Functions(client);

async function sendTest() {
    console.log(`🚀 Sending test message to conversation: ${convId}`);
    
    try {
        const execution = await functions.createExecution(
            functionId,
            JSON.stringify({
                action: 'send_message',
                conversation_id: convId,
                body: messageText
            }),
            false, // async
            '/',   // path
            'POST' // method
        );

        const responseBody = JSON.parse(execution.responseBody);
        if (responseBody.error) {
            console.error('❌ Function Error:', responseBody.error);
        } else {
            console.log('✅ Success!', responseBody);
        }
    } catch (e) {
        console.error('❌ Execution Failed:', e.message);
    }
}

sendTest();
