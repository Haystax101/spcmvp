import { Client, Functions, TablesDB, Query } from 'node-appwrite';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

// 1. Initialize Clients
const appwrite = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://fra.cloud.appwrite.io/v1')
    .setProject('69de7f335c0489352ff1') 
    .setKey(process.env.APPWRITE_API_KEY);

const appwriteFunctions = new Functions(appwrite);
const tables = new TablesDB(appwrite);

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
});

const DB_ID = process.env.APPWRITE_DB_ID || 'supercharged';
const PROFILES_TABLE = process.env.APPWRITE_PROFILES_TABLE || 'profiles';
const DISCOVERY_FUNCTION_ID = process.env.DISCOVERY_FUNCTION_ID || 'discoveryEngine';
const BIOS_CONTEXT_FUNCTION_ID = process.env.BIOS_CONTEXT_FUNCTION_ID || 'biosContext';

const PEOPLE_TABLE = process.env.APPWRITE_PEOPLE_TABLE || 'people';
const PEOPLE_SOCIETIES_TABLE = process.env.APPWRITE_PEOPLE_SOCIETIES_TABLE || 'people_societies';
const PEOPLE_SPORTS_TABLE = process.env.APPWRITE_PEOPLE_SPORTS_TABLE || 'people_sports';
const SOCIETIES_TABLE = process.env.APPWRITE_SOCIETIES_TABLE || 'societies';
const SPORTS_TABLE = process.env.APPWRITE_SPORTS_TABLE || 'sports';

const LOCAL_MIN_RESULTS = Number.parseInt(process.env.SEARCH_LOCAL_MIN_RESULTS || '3', 10);
const MAX_NETWORK_RESULTS = Number.parseInt(process.env.SEARCH_NETWORK_RESULT_LIMIT || '5', 10);
const JOIN_SCAN_LIMIT = Number.parseInt(process.env.SEARCH_JOIN_SCAN_LIMIT || '60', 10);

function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeText(value) {
    return normalizeString(value).toLowerCase();
}

function parseJsonLoose(text, fallback) {
    if (!text || typeof text !== 'string') return fallback;
    try {
        return JSON.parse(text);
    } catch {
        try {
            const objectMatch = text.match(/\{[\s\S]*\}/);
            if (objectMatch) return JSON.parse(objectMatch[0]);
        } catch {
            // ignore parse fallback failure
        }
    }
    return fallback;
}

function parseJsonArrayLoose(text) {
    if (!text || typeof text !== 'string') return [];
    try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        try {
            const arrayMatch = text.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
                const parsed = JSON.parse(arrayMatch[0]);
                return Array.isArray(parsed) ? parsed : [];
            }
        } catch {
            // ignore parse fallback failure
        }
    }
    return [];
}

function extractKeywords(query) {
    return normalizeText(query)
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 4)
        .slice(0, 12);
}

function heuristicSimilarityScore(text, queryKeywords) {
    const haystack = normalizeText(text);
    if (!haystack || queryKeywords.length === 0) return 0;

    const hits = queryKeywords.filter((token) => haystack.includes(token));
    if (hits.length === 0) return 0;

    return Math.min(1, hits.length / Math.max(1, queryKeywords.length));
}

function sanitizeScore(value, fallback = 0) {
    const parsed = Number.parseFloat(String(value));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, Math.min(100, parsed));
}

function summarizeUserContext(userContext) {
    if (!userContext) return 'No user profile context provided.';

    const parts = [
        userContext.full_name ? `Name: ${userContext.full_name}` : '',
        userContext.primary_intent ? `Primary intent: ${userContext.primary_intent}` : '',
        Array.isArray(userContext.goals) && userContext.goals.length ? `Goals: ${userContext.goals.join(', ')}` : '',
        Array.isArray(userContext.desired_connections) && userContext.desired_connections.length ? `Desired connections: ${userContext.desired_connections.join(', ')}` : '',
        Array.isArray(userContext.startup_connections) && userContext.startup_connections.length ? `Startup connections: ${userContext.startup_connections.join(', ')}` : '',
        userContext.career_field ? `Career field: ${userContext.career_field}` : '',
        userContext.career_subfield ? `Career subfield: ${userContext.career_subfield}` : '',
        userContext.study_subject ? `Study subject: ${userContext.study_subject}` : '',
        userContext.college ? `College: ${userContext.college}` : '',
    ].filter(Boolean);

    return parts.join(' | ') || 'No user profile context provided.';
}

function uniqueBy(list, keyFn) {
    const out = [];
    const seen = new Set();
    for (const item of list) {
        const key = keyFn(item);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
    }
    return out;
}

async function getRowsByIds(tableId, ids) {
    const uniqueIds = Array.from(new Set((ids || []).filter(Boolean))).slice(0, 100);
    if (uniqueIds.length === 0) return new Map();

    const rows = await Promise.all(uniqueIds.map(async (rowId) => {
        try {
            return await tables.getRow({
                databaseId: DB_ID,
                tableId,
                rowId,
            });
        } catch {
            return null;
        }
    }));

    const map = new Map();
    rows.filter(Boolean).forEach((row) => map.set(row.$id, row));
    return map;
}

async function fetchUserBioContextFromFunction(userId) {
    const execution = await appwriteFunctions.createExecution(
        BIOS_CONTEXT_FUNCTION_ID,
        JSON.stringify({ action: 'get_bio_context', user_id: userId }),
        false
    );

    const parsed = parseJsonLoose(execution.responseBody || '{}', {});
    return parsed.profile || null;
}

async function fetchUserBioContextFromProfiles(userId) {
    const rows = await tables.listRows({
        databaseId: DB_ID,
        tableId: PROFILES_TABLE,
        queries: [Query.equal('user_id', userId), Query.limit(1)],
    });

    const row = rows.rows?.[0];
    if (!row) return null;

    return {
        user_id: row.user_id,
        full_name: row.full_name,
        college: row.college,
        primary_intent: row.primary_intent,
        goals: row.goals || [],
        desired_connections: row.desired_connections || [],
        startup_connections: row.startup_connections || [],
        career_field: row.career_field,
        career_subfield: row.career_subfield,
        study_subject: row.study_subject,
        year_of_study: row.year_of_study,
        networking_style: row.networking_style,
        intellectual_identity: row.intellectual_identity,
        building_description: row.building_description,
    };
}

async function getUserBioContext(userId) {
    if (!userId) return null;

    try {
        return await fetchUserBioContextFromFunction(userId);
    } catch (error) {
        console.warn(`[RAG] biosContext function unavailable, falling back to profiles table: ${error.message}`);
    }

    try {
        return await fetchUserBioContextFromProfiles(userId);
    } catch (error) {
        console.warn(`[RAG] profile fallback failed: ${error.message}`);
        return null;
    }
}

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

async function scoreAndEnrichCandidate(candidate, query, userContext) {
    const existingDescription = normalizeString(candidate.description);
    if (existingDescription) {
        const textForScore = [candidate.full_name, candidate.group_name, existingDescription, candidate.username].join(' ');
        const score = heuristicSimilarityScore(textForScore, extractKeywords(query));
        return {
            ...candidate,
            description: existingDescription,
            reason: `Strong overlap with ${candidate.group_type} context and stored profile description.`,
            compatibility_score: Math.round((0.55 + (score * 0.45)) * 100),
            linkedin_url: normalizeString(candidate.linkedin_url),
            enriched_now: false,
        };
    }

    const userContextSummary = summarizeUserContext(userContext);
    const prompt = `You are enriching a candidate profile for Oxford people discovery.
Return valid JSON only:
{
  "description": "max 100 words",
  "compatibility_score": 0,
  "reason": "one short sentence",
  "linkedin_url": ""
}

Query: "${query}"
Searcher profile context: "${userContextSummary}"

Candidate seed:
- Name: ${candidate.full_name || 'Unknown'}
- Known username: ${candidate.username || 'Unknown'}
- Existing URL: ${candidate.profile_url || 'Unknown'}
- Group type: ${candidate.group_type}
- Group name: ${candidate.group_name || 'Unknown'}

Use Google Search grounding to find reliable public signals. Prioritize Oxford-specific pages and LinkedIn.
Keep compatibility primarily based on the query, then user profile compatibility.
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.1,
                responseMimeType: 'application/json',
            }
        });

        const parsed = parseJsonLoose(response.text, {});
        const description = normalizeString(parsed.description).slice(0, 700);
        const linkedinUrl = normalizeString(parsed.linkedin_url);

        return {
            ...candidate,
            description,
            reason: normalizeString(parsed.reason) || `Potential match through ${candidate.group_type} graph expansion.`,
            compatibility_score: sanitizeScore(parsed.compatibility_score, 55),
            linkedin_url: linkedinUrl,
            enriched_now: true,
        };
    } catch (error) {
        console.warn(`[Enrichment] Failed for ${candidate.full_name}: ${error.message}`);
        return {
            ...candidate,
            description: '',
            reason: `Candidate discovered via ${candidate.group_type} graph but enrichment failed.`,
            compatibility_score: 45,
            linkedin_url: normalizeString(candidate.linkedin_url),
            enriched_now: false,
        };
    }
}

async function fetchGroupCandidates({ joinTableId, groupTableId, groupIdKey, groupType, query }) {
    const queryKeywords = extractKeywords(query);

    let joinRows;
    try {
        joinRows = await tables.listRows({
            databaseId: DB_ID,
            tableId: joinTableId,
            queries: [Query.limit(JOIN_SCAN_LIMIT)],
        });
    } catch (error) {
        console.warn(`[${groupType}] join table unavailable (${joinTableId}): ${error.message}`);
        return [];
    }

    const rows = joinRows.rows || [];
    if (rows.length === 0) return [];

    const personMap = await getRowsByIds(PEOPLE_TABLE, rows.map((row) => row.person_id));
    const groupMap = await getRowsByIds(groupTableId, rows.map((row) => row[groupIdKey]));

    const candidates = rows.map((row) => {
        const person = personMap.get(row.person_id);
        const group = groupMap.get(row[groupIdKey]);
        if (!person || !group) return null;

        const groupName = normalizeString(group.name);
        const personDescription = normalizeString(person.description);
        const baseText = [person.full_name, person.username, personDescription, groupName, query].join(' ');
        const similarity = heuristicSimilarityScore(baseText, queryKeywords);
        const enrichmentBoost = personDescription ? 0.25 : 0;

        return {
            person_id: person.$id,
            full_name: normalizeString(person.full_name),
            username: normalizeString(person.username),
            profile_url: normalizeString(person.profile_url),
            linkedin_url: normalizeString(person.linkedin_url),
            description: personDescription,
            group_type: groupType,
            group_name: groupName,
            base_score: Math.min(1, similarity + enrichmentBoost),
        };
    }).filter(Boolean);

    return uniqueBy(candidates, (candidate) => candidate.person_id)
        .sort((a, b) => b.base_score - a.base_score);
}

function selectNetworkCandidates(candidates, limit) {
    const sorted = [...candidates].sort((a, b) => b.base_score - a.base_score);
    const withDescription = sorted.filter((candidate) => normalizeString(candidate.description));
    const withoutDescription = sorted.filter((candidate) => !normalizeString(candidate.description));

    const selected = [];
    if (withoutDescription.length > 0) {
        selected.push(withoutDescription[0]);
    }

    for (const candidate of withDescription) {
        if (selected.length >= limit) break;
        if (!selected.some((item) => item.person_id === candidate.person_id)) {
            selected.push(candidate);
        }
    }

    for (const candidate of sorted) {
        if (selected.length >= limit) break;
        if (!selected.some((item) => item.person_id === candidate.person_id)) {
            selected.push(candidate);
        }
    }

    return selected.slice(0, limit);
}

async function persistEnrichment(candidate) {
    if (!candidate.enriched_now) return;
    if (!candidate.description && !candidate.linkedin_url) return;

    try {
        await tables.updateRow({
            databaseId: DB_ID,
            tableId: PEOPLE_TABLE,
            rowId: candidate.person_id,
            data: {
                description: candidate.description || null,
                linkedin_url: candidate.linkedin_url || null,
                is_enriched: true,
                last_enriched_at: new Date().toISOString(),
            }
        });
    } catch (error) {
        console.warn(`[Writeback] Failed to update ${candidate.person_id}: ${error.message}`);
    }
}

async function searchNetworkTables(query, userContext) {
    console.log(`[Network] Searching people_societies and people_sports for: "${query}"...`);

    const [societyCandidates, sportCandidates] = await Promise.all([
        fetchGroupCandidates({
            joinTableId: PEOPLE_SOCIETIES_TABLE,
            groupTableId: SOCIETIES_TABLE,
            groupIdKey: 'society_id',
            groupType: 'society',
            query,
        }),
        fetchGroupCandidates({
            joinTableId: PEOPLE_SPORTS_TABLE,
            groupTableId: SPORTS_TABLE,
            groupIdKey: 'sport_id',
            groupType: 'sport',
            query,
        }),
    ]);

    const selected = selectNetworkCandidates([...societyCandidates, ...sportCandidates], MAX_NETWORK_RESULTS);
    if (selected.length === 0) return [];

    const enriched = await Promise.all(selected.map((candidate) => scoreAndEnrichCandidate(candidate, query, userContext)));
    await Promise.all(enriched.map((candidate) => persistEnrichment(candidate)));

    return enriched
        .sort((a, b) => b.compatibility_score - a.compatibility_score)
        .map((candidate) => ({
            full_name: candidate.full_name || 'Unknown',
            affiliation: `${candidate.group_type}: ${candidate.group_name || 'Unknown'}`,
            reason: candidate.reason,
            url: candidate.linkedin_url || candidate.profile_url || '',
            is_on_app: false,
            source: `${candidate.group_type}_db`,
            match_score: Math.round(candidate.compatibility_score),
            description: candidate.description || '',
        }));
}

/**
 * Perform external search using Gemini 3.1 Flash Lite with Google Search grounding
 */
async function searchExternal(query, userContext = null) {
    console.log(`[External] Orchestrating smart agent search for: "${query}"...`);

    const userContextSummary = summarizeUserContext(userContext);
    const prompt = `You are a specialized Oxford University discovery agent.
Task: find people matching the query using Google Search grounding.

Query: "${query}"
Searcher context: "${userContextSummary}"

Process:
1) Think of a short strategy before searching (for example, society page first, then LinkedIn lookup).
2) Search for real people linked to Oxford.
3) If evidence is weak, return fewer results instead of guessing.

Return valid JSON only with this schema:
{
  "strategy": "one short line",
  "results": [
    {
      "full_name": "...",
      "affiliation": "College/Department/Society",
      "reason": "Why this person matches",
      "url": "Best profile URL",
      "match_score": 0,
      "is_on_app": false,
      "source": "google_search"
    }
  ]
}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.1,
                responseMimeType: 'application/json',
            }
        });

        const payload = parseJsonLoose(response.text, {});
        const parsedResults = Array.isArray(payload.results)
            ? payload.results
            : parseJsonArrayLoose(response.text);
        
        return {
            source: 'external',
            strategy: normalizeString(payload.strategy),
            results: parsedResults.map((result) => ({
                full_name: normalizeString(result.full_name),
                affiliation: normalizeString(result.affiliation),
                reason: normalizeString(result.reason),
                url: normalizeString(result.url),
                match_score: sanitizeScore(result.match_score, 50),
                is_on_app: false,
                source: 'google_search',
            })),
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
export async function smartSearch(query, options = {}) {
    const startTime = Date.now();
    const userId = normalizeString(options.userId || options.user_id || '');
    const userContext = userId ? await getUserBioContext(userId) : null;
    
    // 1. Parallel in-app and network-table search
    const [inAppResults, networkResults] = await Promise.all([
        searchInApp(query),
        searchNetworkTables(query, userContext)
    ]);
    
    const fastPathTime = Date.now() - startTime;
    let externalResults = { results: [] };
    
    // 2. Trigger external fallback if local results are sparse
    if (inAppResults.length + networkResults.length < LOCAL_MIN_RESULTS) {
        console.log(`[Orchestrator] Local results insufficient. Escalating to external search...`);
        externalResults = await searchExternal(query, userContext);
    }

    const totalTime = Date.now() - startTime;
    
    // Combine and normalize results
    const combinedResults = [
        ...inAppResults.map((r) => ({ ...r, is_on_app: true, source: r.source || 'in-app' })),
        ...networkResults,
        ...externalResults.results
    ].sort((a, b) => (sanitizeScore(b.match_score ?? b.score, 0) - sanitizeScore(a.match_score ?? a.score, 0)));

    const finalResponse = {
        query,
        results: combinedResults,
        metadata: {
            fast_path_time_ms: fastPathTime,
            total_time_ms: totalTime,
            user_context_used: Boolean(userContext),
            strategy: externalResults.strategy || null,
            status: combinedResults.length > 0 ? 'success' : 'no_results_found'
        }
    };

    await logSearchEvent(
        query,
        inAppResults.length,
        networkResults.length,
        externalResults.results.length,
        finalResponse.metadata.status,
        externalResults.grounding || []
    );

    return finalResponse;
}

async function logSearchEvent(query, inAppCount, networkCount, externalCount, status, groundingQueries = []) {
    console.log('[Analytics] search_event', {
        query,
        in_app_count: inAppCount,
        network_count: networkCount,
        external_count: externalCount,
        grounding_queries: groundingQueries,
        status,
        at: new Date().toISOString(),
    });
}

// CLI test if run directly
if (process.argv[1].endsWith('external_search.js')) {
    const query = process.argv[2] || "People at Oxford interested in early-stage biotech startups";
    const userId = process.argv[3] || '';
    smartSearch(query, { userId }).then(res => {
        console.log("\n========== FINAL SEARCH RESULTS ==========");
        console.log(JSON.stringify(res, null, 2));
    });
}
