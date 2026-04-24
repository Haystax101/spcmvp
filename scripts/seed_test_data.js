import { Client, TablesDB, Query, ID } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const dbId = 'supercharged';
const profilesTable = 'profiles';
const connectionsTable = 'connections';
const messagesTable = 'messages';

if (!projectId || !apiKey) {
    console.error('Error: APPWRITE_PROJECT_ID and APPWRITE_API_KEY must be set in .env');
    process.exit(1);
}

const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

const tables = new TablesDB(client);

async function seed() {
    try {
        // 1. Get your profile (the one you are logged in as)
        // We'll just grab the first profile or you can provide an ID
        const profiles = await tables.listRows({
            databaseId: dbId,
            tableId: profilesTable,
            queries: [Query.limit(5)]
        });

        if (profiles.rows.length < 2) {
            console.error('Not enough profiles found to create connections. Need at least 2.');
            return;
        }

        const myProfile = profiles.rows[0];
        const otherProfiles = profiles.rows.slice(1);

        console.log(`Targeting your profile: ${myProfile.full_name} (${myProfile.$id})`);

        for (const peer of otherProfiles) {
            console.log(`Creating pending request from ${peer.full_name}...`);

            const pairKey = [myProfile.$id, peer.$id].sort().join(':');
            
            // Create the connection row
            const connection = await tables.createRow({
                databaseId: dbId,
                tableId: connectionsTable,
                rowId: ID.unique(),
                data: {
                    pair_key: pairKey,
                    initiator: peer.$id,
                    initiator_profile_id: peer.$id,
                    responder: myProfile.$id,
                    responder_profile_id: myProfile.$id,
                    status: 'pending',
                    opening_message_preview: `Hi ${myProfile.full_name.split(' ')[0]}! I saw your profile and would love to connect.`,
                    initiated_at: new Date().toISOString(),
                    last_activity_at: new Date().toISOString()
                }
            });

            // Create the opening message
            await tables.createRow({
                databaseId: dbId,
                tableId: messagesTable,
                rowId: ID.unique(),
                data: {
                    sender: peer.$id,
                    sender_row_id: peer.$id,
                    body: `Hi ${myProfile.full_name.split(' ')[0]}! I saw your profile and would love to connect.`,
                    message_type: 'text',
                    delivery_status: 'delivered',
                    sent_at: new Date().toISOString(),
                    conversation: null,
                    conversation_row_id: null
                }
            });

            console.log(`✅ Request created: ${connection.$id}`);
        }

        console.log('\nDone! Refresh your app home page.');

    } catch (err) {
        console.error('Seeding failed:', err.message);
    }
}

seed();
