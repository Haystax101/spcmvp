# Recommended Schema for Supercharged Discovery

To support the "smart search" experience, including society databases and observability, I recommend the following additions to your Appwrite setup.

## 1. Societies & Members
This allows us to match people by interests/groups even if they aren't fully registered on the app yet.

### Table: `societies`
Stores metadata about the groups we are tracking.
- `name` (string, required): The name of the society (e.g., "Oxford Union", "Keble Boat Club").
- `description` (text, optional): Brief description of the group.
- `category` (string, optional): e.g., "Sport", "Political", "Academic".

### Table: `society_members` (The "Leads" database)
This is where you store the names and Instagram handles you're collecting.
- `full_name` (string, required): The person's name.
- `instagram_handle` (string, optional): Their IG username.
- `society_id` (string, required): Relationship to the `societies` table.
- `college` (string, optional): If known.
- `is_on_app` (boolean, default false): Set to true if we successfully link them to a real `profile`.
- `metadata` (text, optional): JSON field for extra info found during scraping.

---

## 2. Search Observability
Crucial for tracking "failed" searches and user intent.

### Table: `search_logs`
- `query` (text, required): The literal string the user typed.
- `user_id` (string, optional): Who performed the search.
- `in_app_count` (integer): How many registered users matched.
- `society_count` (integer): How many society members matched.
- `external_found` (boolean): Whether we triggered the Gemini Search Agent.
- `execution_time_ms` (integer): Speed of the response.
- `status` (string): e.g., "success", "no_results", "agent_timeout".
- `agent_strategy` (text, optional): The search queries Gemini actually used (from grounding metadata).

---

## 3. Integration Strategy
1. **Qdrant Indexing**: When a new batch of `society_members` is added, generate a simple embedding of their `[Name] + [Society Name] + [Metadata]` and upsert it to a *new* Qdrant collection called `leads` or `societies`.
2. **The Orchestrator**: In `external_search.js`, the `searchSocieties` function will query this new collection.
3. **The Agent**: If both `profiles` and `society_members` return nothing, Gemini-3.1-Flash-Lite acts as the "failover" to find them on LinkedIn/Google.
