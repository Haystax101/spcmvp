# This is a comprehensive overview of what Supercharged is, and what the MVP will be.

Supercharged is an autonomous discovery and connection platform.

It is launching exclusively in Oxford University to help students find others through natural language search, with 0 time or effort. 

## The Problem

Students in Oxford are incredibly diverse, with a wide range of interests, backgrounds, and experiences. However, it is very difficult to find others who share these interests, backgrounds, and experiences. 

Supercharged solves that.

## The Product

This details our narrow vision for what the initial iteration of the product will look like for launch in Oxford on approximately 1 May.

- **Onboarding**: Extract user goals, interests, and existing Oxford connections.
- **Search UI**: Natural language search bar with compatibility ranking.
- **Comparison Engine**: LLM-generated reasoning comparing the user's profile to matches.
- **Outreach**: Integrated messaging or social/email links with AI-generated drafts.
- **Background Discovery**: Autonomous "scouting" of new people (internal and external) based on user goals.

This concludes the MVP version of the product. The in-app messaging system should be incredibly basic.

## The key technological innovations

Based off the premise that most people's data is widely publicly available, but scattered across the web. We will build up a continually evolving social graph of Oxford students and make finding and connecting with people at the uni frictionless and limitless.

Matching of users will be semantic, intelligent and based on a deep understanding of the user's profile and preferences rather than surface level matching.

## Technical Details

- **Frontend**: React (Web App)
- **Backend (BaaS)**: **Appwrite** (Auth, DB, Functions, Storage)
- **Vector DB**: **Pinecone** (Integrated into Appwrite via serverless functions)
- **LLM / Search Logic**: 
    - **Primary (Phase 1)**: Google AI Studio (Gemini 1.5 Flash) with **Google Search Grounding**. 
        - Tracked to stay within 5,000 requests/month free tier.
    - **Fallback (Phase 2)**: **Tavily** (Search) + **Jina Reader** (Markdown Scraping) + Gemini Flash analysis.
- **Analytics**: PostHog
- **Error Tracking**: Sentry

The app will be accessible via `superchargedai.app`, restricted to `@ox.ac.uk` domains via Appwrite Auth.

## Potential avenues to explore during or post-MVP

- Face search (leveraging multimodality to scan people's faces for features of attraction e.g. eye colour, skin colour, hair colour, etc.)
- Deeper simulation of interactions for highly curated outreach
- More clear visual representation of the social network e.g. through topography so people can actually understand what's going on
- Priority inbox to track outreach + maintain existing relationships

## Main objective of this folder

This folder is primarily focused on the Backend, as the frontend will be developed separately and potentially integrated in later. 

## Task List

- Set up Appwrite project & CLI
- Set up Pinecone index (1536 dims)
- Set up PostHog & Sentry
- **Implement Usage Tracker**: A dedicated Appwrite collection to count monthly grounding calls per user/system.
- Implement **Phase 1 Discovery**: `discovery-scout` using Google Search Grounding.
- Implement **Phase 2 Fallback**: Logic to switch to Tavily + Jina when grounding limit is hit.
- Implement **Lead Analyzer**: Firecrawl/Jina scraping + GPT-4o-mini extraction.
- Implement **Profile Sync**: Event-driven indexing into Pinecone.
- Build basic Auth flow (Magic URL for Oxford students).
- Set up basic DB collections (Profiles, Leads, Conversations, Messages).
- Rigorous integration testing for the search pipeline.


