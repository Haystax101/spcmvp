import { Client, TablesDB, ID } from 'node-appwrite';
import { QdrantClient } from '@qdrant/js-client-rest';
import readline from 'readline';
import crypto from 'crypto';
import 'dotenv/config';

// 1. Initialize Clients
const appwrite = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://fra.cloud.appwrite.io/v1')
    .setProject('69de7f335c0489352ff1') // Project ID
    .setKey(process.env.APPWRITE_API_KEY);

const tables = new TablesDB(appwrite);
const qdrant = new QdrantClient({
    url: process.env.QDRANT_ENDPOINT,
    apiKey: process.env.QDRANT_API_KEY,
});

const DB_ID = 'supercharged';
const TABLE_ID = 'profiles';

// Utility: Hash Appwrite ID to Qdrant UUID
function getQdrantId(appwriteId) {
    const hash = crypto.createHash('md5').update(appwriteId).digest('hex');
    return [
        hash.substring(0, 8),
        hash.substring(8, 12),
        `4${hash.substring(13, 16)}`,
        `8${hash.substring(17, 20)}`,
        hash.substring(20, 32)
    ].join('-');
}

// 2. Dummy Data Injector
async function injectDummies() {
    console.log("\n[1/5] Injecting 5 diverse mock profiles into Oxford Ecosystem...");

    const dummies = [
        {
            full_name: "Alan Turing II",
            college: "Keble",
            course: "Computer Science",
            stage: "Undergrad",
            social_energy: 3,
            primary_intent: "Professional Networking",
            free_text_responses: "I'm obsessed with AI agents and looking for a business co-founder to build a productivity tool. I spend most of my time coding in Rust."
        },
        {
            full_name: "Sylvia Plath II",
            college: "Magdalen",
            course: "English Language and Literature",
            stage: "DPhil",
            social_energy: 4,
            primary_intent: "Make Friends",
            free_text_responses: "Very creative, love theatre and poetry recitals. Eager to meet people outside of my lab/bubble to go to independent cafes and bookstores."
        },
        {
            full_name: "Gordon Gekko",
            college: "Said Business School",
            course: "MBA",
            stage: "MBA",
            social_energy: 5,
            primary_intent: "Professional Networking",
            free_text_responses: "Finance fanatic looking to break into Fintech. Need someone highly technical to build an MVP while I handle the pitch decks and VCs."
        },
        {
            full_name: "Marie Curie II",
            college: "Trinity",
            course: "Medical Sciences",
            stage: "DPhil",
            social_energy: 2,
            primary_intent: "Make Friends",
            free_text_responses: "Quiet but fiercely curious. I love long walks in Port Meadow, deep philosophical conversations over tea, and avoiding loud crowded pubs."
        },
        {
            full_name: "Chad Varsity",
            college: "Oriel",
            course: "Economics and Management",
            stage: "Undergrad",
            social_energy: 5,
            primary_intent: "Social",
            free_text_responses: "Captain of the college 1st VIII. Always at the pub, love clubbing, looking for people to hit Bridge with on Thursday nights and play sports."
        }
    ];

    for (const d of dummies) {
        try {
            await tables.createRow({
                databaseId: DB_ID,
                tableId: TABLE_ID,
                rowId: ID.unique(),
                data: {
                    user_id: `dummy_${Math.floor(Math.random() * 10000)}`,
                    ...d,
                    is_indexed: false
                }
            });
        } catch (e) {
            console.error(`Failed to inject dummy ${d.full_name}: ${e.message}`);
        }
    }
    console.log("✅ Dummies injected. The Appwrite backend is currently generating their vectors!");
}

// 3. User Questionnaire
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

async function runOnboarding() {
    console.log("\n[2/5] Supercharged Discovery Engine - Terminal MVP");
    console.log("--------------------------------------------------");

    const full_name = await ask("What is your full name? ");
    const college = await ask("What college are you at? ");
    const course = await ask("What is your course? ");
    const stage = await ask("What is your stage? (e.g. Undergrad, Masters, DPhil): ");
    
    let social_energy = await ask("Social Energy [1 (Quiet) - 5 (Extrovert)]: ");
    social_energy = parseInt(social_energy);
    if (isNaN(social_energy) || social_energy < 1 || social_energy > 5) social_energy = 3;

    console.log("\nIntent Options: [Professional Networking, Make Friends, Romance]");
    const primary_intent = await ask("What is your primary goal right now? ");

    console.log("\nThe 'Tell Me About Yourself' Section (Combines D1-D4):");
    const free_text_responses = await ask("Describe your interests, what you're building, or what you want in a connection:\n> ");

    rl.close();

    console.log("\n[3/5] Saving to Appwrite Database...");
    const myDocId = ID.unique();
    const myProfile = await tables.createRow({
        databaseId: DB_ID,
        tableId: TABLE_ID,
        rowId: myDocId,
        data: {
            user_id: `live_user_${Math.floor(Math.random() * 10000)}`,
            full_name,
            college,
            course,
            stage,
            social_energy,
            primary_intent,
            free_text_responses,
            is_indexed: false
        }
    });

    console.log("✅ Identity saved.");
    return { docId: myDocId, qdrantId: getQdrantId(myDocId) };
}

// 4. Polling Webhook Completion
async function awaitIndexing(docId) {
    console.log("\n[4/5] Waiting for Google Gemini to vectorize your personality...");
    process.stdout.write("Polling Appwrite ");
    
    let isIndexed = false;
    let attempts = 0;
    
    while (!isIndexed && attempts < 15) { // 30 sec timeout
        attempts++;
        process.stdout.write(".");
        const doc = await tables.getRow({ databaseId: DB_ID, tableId: TABLE_ID, rowId: docId });
        if (doc.is_indexed) {
            isIndexed = true;
            console.log("\n✅ Vectors generated and upserted to Qdrant successfully!");
        } else {
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    
    if (!isIndexed) {
        console.log("\n⚠️ Timeout waiting for Appwrite Function. The vector might still be processing.");
    }
}

// 5. The Multi-Vector Qdrant Match
async function executeMatch(qdrantId) {
    console.log("\n[5/5] Querying the Multidimensional Discovery Engine...");
    
    try {
        // We use Qdrant's Recommend API which takes our newly created user vector as the "positive" target!
        // We run two searches: One for Structural Intent, One for Semantic Personality.
        
        console.log("-> Searching Intent axis...");
        const intentMatches = await qdrant.recommend('profiles', {
            positive: [qdrantId],
            using: 'intent',
            limit: 5,
            with_payload: true
        });

        console.log("-> Searching Semantic axis...");
        const semanticMatches = await qdrant.recommend('profiles', {
            positive: [qdrantId],
            using: 'semantic',
            limit: 5,
            with_payload: true
        });

        // 6. Tally Scores (Basic Late-Fusion Math in JS)
        const matchMap = new Map();

        // Weigh semantic matches
        semanticMatches.forEach(m => {
            if (m.id === qdrantId) return; // don't match yourself
            matchMap.set(m.id, {
                payload: m.payload,
                semantic_score: m.score,
                intent_score: 0,
                total_score: m.score // semantic is base
            });
        });

        // Add intent weights
        intentMatches.forEach(m => {
            if (m.id === qdrantId) return; 
            if (matchMap.has(m.id)) {
                const combined = matchMap.get(m.id);
                combined.intent_score = m.score;
                // Weighted fusion: Semantic (60%), Intent (40%)
                combined.total_score = (combined.semantic_score * 0.6) + (m.score * 0.4);
            } else {
                matchMap.set(m.id, {
                    payload: m.payload,
                    semantic_score: 0,
                    intent_score: m.score,
                    total_score: m.score * 0.4
                });
            }
        });

        // Sort Map to array
        const sortedMatches = Array.from(matchMap.values())
            .sort((a, b) => b.total_score - a.total_score)
            .slice(0, 3); // Top 3

        console.log("\n=================================");
        console.log("🎯 TOP 3 COMPATIBLE CONNECTIONS 🎯");
        console.log("=================================");

        sortedMatches.forEach((m, i) => {
            // Because Qdrant only stores the Payload we gave it in main.js, 
            // In a real app we'd query Appwrite again using m.payload.user_id to get full details.
            // But main.js embeds college, primary_intent, social_energy, etc.
            
            console.log(`\nMatch #${i + 1}:`);
            console.log(`   Affiliation  : ${m.payload.college} / ${m.payload.course} (${m.payload.stage})`);
            console.log(`   Goal         : ${m.payload.primary_intent}`);
            console.log(`   Social Energy: ${m.payload.social_energy}/5`);
            console.log(`   -----------------------------`);
            console.log(`   Fusion Score : ${(m.total_score * 100).toFixed(1)}% compatibility`);
            console.log(`      (Semantic: ${(m.semantic_score * 100).toFixed(1)}% | Intent: ${(m.intent_score * 100).toFixed(1)}%)`);
        });

        console.log("\n✨ Simulation complete! The Supercharged Engine is operational.");

    } catch (e) {
        console.error("Match Engine failed:", e.response ? e.response : e);
    }
}

// Orchestrator
async function start() {
    await injectDummies();
    const user = await runOnboarding();
    await awaitIndexing(user.docId);
    await executeMatch(user.qdrantId);
}

start();
