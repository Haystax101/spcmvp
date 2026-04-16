import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

// Initialize the Google Gen AI SDK with the API key from .env
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

async function searchForPeople(userGoal) {
  // PROMPT TO ITERATE ON
  const prompt = `You are an expert talent scout and discovery assistant for Oxford University.
Your objective is to find real people currently affiliated with Oxford University that match the user's specific interest or goal.
Use your Google Search tool to find public profiles (e.g., LinkedIn, Oxford Faculty pages, Twitter, or personal portfolios).

User's Goal: "${userGoal}"

Please provide a list of 3 specific individuals who match this goal. For each person, provide:
1. Full Name
2. Their role, course, or college (if available)
3. A brief 1-sentence reason why they are a good match for the user's goal.
4. The exact URL to their profile.

Format the output clearly.`;

  console.log(`Scouting for: "${userGoal}"...\n`);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        // This enables the Google Search Grounding tool
        tools: [{ googleSearch: {} }],
        temperature: 0.1, // Low temperature to prioritize factual extraction over creativity
      }
    });

    console.log("========== DISCOVERY RESULTS ==========\n");
    console.log(response.text);

    // Access grounding metadata (citations, search queries)
    const groundingData = response.candidates?.[0]?.groundingMetadata;
    if (groundingData?.webSearchQueries) {
      console.log("\n========== SEARCH QUERIES USED ==========");
      console.log(groundingData.webSearchQueries.join("\n"));
    }

  } catch (error) {
    console.error("Error during search:", error);
    if (error.stack) console.error(error.stack);
  }
}

// Run the script with an argument or use the default goal
const goal = process.argv[2] || "I want to find computer science students at Oxford who are interested in building consumer AI startups.";
searchForPeople(goal);
