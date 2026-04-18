import { Client, Functions } from 'node-appwrite';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

// 1. Initialize Clients
const appwrite = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://fra.cloud.appwrite.io/v1')
    .setProject('69de7f335c0489352ff1') 
    .setKey(process.env.APPWRITE_API_KEY);

const appwriteFunctions = new Functions(appwrite);

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
});

const DISCOVERY_FUNCTION_ID = process.env.DISCOVERY_FUNCTION_ID || 'discoveryEngine';

/**
 * Perform semantic search within existing Appwrite/Qdrant profiles
 * @param {string} query User search query
 * @returns {Promise<Array>} List of matching profiles
 */
async function searchInApp(query) {
    console.log(`[In-App] Searching for: "${query}"...`);
    try {
        const execution = await appwriteFunctions.createExecution(
            DISCOVERY_FUNCTION_ID,
            JSON.stringify({ action: 'search', query, variant: 'hybrid_filtered' }),
            false
        );
        const response = JSON.parse(execution.responseBody || '{}');
        const matches = Array.isArray(response.matches) ? response.matches : [];

        return matches.map((match) => ({
            source: 'in-app',
            ...match,
            match_score: match.score ?? 0,
        }));
    } catch (error) {
        console.error('[In-App] Error:', error.message);
        return [];
    }
}

/**
 * Placeholder for searching within specific society databases (e.g. Rowing, Oxford Union, etc.)
 * Initially returns empty but is hooked into the orchestrator.
 */
async function searchSocieties(query) {
    console.log(`[Societies] Checking society-specific databases for: "${query}"...`);
    // TODO: Once the society_members tables are ready in Appwrite:
    // 1. Perform a query against the society_members table
    // 2. Optionally use a dedicated Qdrant collection for society interests
    return []; 
}

/**
 * Perform external search using Gemini 3.1 Flash Lite with Google Search grounding
 */
async function searchExternal(query) {
    console.log(`[External] Orchestrating smart agent search for: "${query}"...`);
    
    const prompt = `You are a specialized Oxford University discovery agent. 
The user is looking for specific people at Oxford (students, faculty, or alumni).
Query: "${query}"

Your strategy:
1. Search for real individuals at Oxford University via Google Search.
2. Prioritize finding LinkedIn profiles, Oxford Faculty pages, or Instagram handles (if public/relevant to their Oxford role).
3. Be honest: if the data is impossible to find online, provide the closest possible matches and explain why.

IMPORTANT: Return your response as a valid JSON array of objects.
Each object must have:
{
  "full_name": "...",
  "affiliation": "College/Department",
  "reason": "Why they match",
  "url": "Link to profile",
  "is_on_app": false,
  "source": "google_search"
}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.1,
            }
        });

        const text = response.text;
        
        // Basic extraction if the model wraps JSON in markdown blocks
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const parsedResults = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        
        return {
            source: 'external',
            results: parsedResults,
            grounding: response.candidates?.[0]?.groundingMetadata?.webSearchQueries || []
        };
    } catch (error) {
        console.error('[External] Error:', error.message);
        return { source: 'external', results: [], error: error.message };
    }
}

/**
 * Main Orchestrator
 */
export async function smartSearch(query) {
    const startTime = Date.now();
    
    // 1. Parallel In-App and Society Search (Fast path, aim for < 5s)
    const [inAppResults, societyResults] = await Promise.all([
        searchInApp(query),
        searchSocieties(query)
    ]);
    
    const fastPathTime = Date.now() - startTime;
    let externalResults = { results: [] };
    
    // 2. Trigger External Search if results are sparse
    // We aim for < 60s for this part.
    if (inAppResults.length + societyResults.length < 3) {
        console.log(`[Orchestrator] Local results insufficient. Escalating to external search...`);
        externalResults = await searchExternal(query);
    }

    const totalTime = Date.now() - startTime;
    
    // Combine results
    const combinedResults = [
        ...inAppResults.map(r => ({ ...r, is_on_app: true })),
        ...societyResults.map(r => ({ ...r, is_on_app: false, source: 'society_db' })),
        ...externalResults.results
    ];

    const finalResponse = {
        query,
        results: combinedResults,
        metadata: {
            fast_path_time_ms: fastPathTime,
            total_time_ms: totalTime,
            status: combinedResults.length > 0 ? 'success' : 'no_results_found'
        }
    };

    await logSearchEvent(query, inAppResults.length, externalResults.results.length, finalResponse.metadata.status);

    return finalResponse;
}

async function logSearchEvent(query, inAppCount, externalCount, status) {
    console.log('[Analytics] search_event', {
        query,
        in_app_count: inAppCount,
        external_count: externalCount,
        status,
        at: new Date().toISOString(),
    });
}

// CLI test if run directly
if (process.argv[1].endsWith('external_search.js')) {
    const query = process.argv[2] || "People at Oxford interested in early-stage biotech startups";
    smartSearch(query).then(res => {
        console.log("\n========== FINAL SEARCH RESULTS ==========");
        console.log(JSON.stringify(res, null, 2));
    });
}
