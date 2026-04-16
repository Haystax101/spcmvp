import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

// 1. Initialize the Judge Model
// Using Gemini 1.5 Flash as the fast, cheap evaluator (or substitute for Claude 3 Haiku for cross-model judging)
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

const JUDGE_SYSTEM_PROMPT = `
You are an expert AI evaluator judging the quality of a match narrative generated for a university networking app. 
You will be provided with Profile A, Profile B, and the Model's generated Narrative and Compatibility Score.

You must score the narrative on a scale of 1-5 for three specific dimensions:
1. GROUNDING (1=Hallucinates heavily, 5=Strictly relies on the provided Appwrite profiles)
2. TONE (1=Inappropriate/creepy, 5=Professional, friendly, and tailored to Oxford students)
3. LOGIC (1=Score makes zero sense given the profiles, 5=Score perfectly reflects semantic overlap)

Output your response STRICTLY as a JSON object matching this schema:
{
  "reasoning": "Brief chain of thought explaining your scores...",
  "scores": { "grounding": 5, "tone": 4, "logic": 5 }
}
`;

async function runEvals() {
    console.log("🚀 Starting LLM-as-a-Judge Eval Run...\n");
    
    // In production, you would fetch from Appwrite's `match_logs` table here:
    // const logs = await databases.listDocuments(DB_ID, 'match_logs', [Query.limit(50)]);
    
    // For this example, we use our golden dataset
    const rawData = fs.readFileSync('./evals/golden_dataset.json', 'utf8');
    const dataset = JSON.parse(rawData);

    let passed = 0;

    for (const record of dataset) {
        console.log(`Evaluating Record: ${record.id} (Expected: ${record.expected_quality})`);
        
        const prompt = `
        Profile A: ${JSON.stringify(record.user_a)}
        Profile B: ${JSON.stringify(record.user_b)}
        -----------------
        LLM Match Narrative: "${record.model_output.narrative}"
        LLM Compatibility Score: ${record.model_output.compatibility_score}
        `;

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: prompt,
                config: { 
                    systemInstruction: JUDGE_SYSTEM_PROMPT,
                    responseMimeType: "application/json"
                }
            });

            const grade = JSON.parse(response.text());
            const averageScore = (grade.scores.grounding + grade.scores.tone + grade.scores.logic) / 3;
            
            console.log(`Reasoning: ${grade.reasoning}`);
            console.log(`Scores: Grounding[${grade.scores.grounding}] Tone[${grade.scores.tone}] Logic[${grade.scores.logic}] -> Avg: ${averageScore.toFixed(2)}`);
            
            // Basic assert: "Good" matches should score > 3.5 Avg
            if (record.expected_quality === 'good' && averageScore >= 3.5) {
                console.log("✅ PASS\n"); passed++;
            } else if (record.expected_quality === 'bad' && averageScore < 3.5) {
                console.log("✅ PASS (Judge successfully caught bad match)\n"); passed++;
            } else {
                console.log("❌ FAIL (Judge disagreed with human expectation)\n");
            }
        } catch (e) {
            console.error(`Error evaluating ${record.id}:`, e.message);
        }
    }

    console.log(`🎉 Eval Run Complete! Score: ${passed}/${dataset.length} passed.`);
}

runEvals();
