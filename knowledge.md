# Supercharged App Knowledge

This document is a practical map of the Supercharged codebase: what each major part does, how the frontend is wired, which backend functions exist, what Appwrite stores, and where Stripe, Sentry, PostHog, and Qdrant fit in.

## 1. What The App Is

Supercharged is an Oxford-focused networking and relationship-building app. The product centers on a few core jobs:

- Sign up and onboarding for verified Oxford users.
- Build and maintain a rich profile with intent, interests, CV-derived context, and photos.
- Discover and rank people using semantic matching and relationship signals.
- Run an inbox/chat experience for requests, active conversations, and relationship context.
- Track a small gamified currency called Voltz.
- Support paid Voltz top-ups and subscriptions through Stripe.

The app is split into a Vite/React frontend and a set of Appwrite functions that act as backend services, sync jobs, and integration glue.

## 2. Repository Structure

Top-level layout:

- `frontend/` - React app.
- `functions/` - Appwrite functions.
- `appwrite.json` - Infrastructure-as-code for Appwrite functions, buckets, and tables.
- `external_search.js` - Search orchestrator / fallback search pipeline.
- `discover.js` - CLI-style discovery script that uses Gemini Google Search grounding.
- `poc_search.js` - Proof-of-concept search exploration script.
- `test_sync.js` - Local smoke test for profile sync behavior.
- `reindex_qdrant_profiles.js` - Utility to re-run profile sync over rows in Appwrite.
- `repair_schema.js` and `repair_schema.py` - Schema repair / migration helpers used during iteration.
- `evals/` - Evaluation harness and golden dataset.
- `notes/`, `searchPlan.md`, `FEATURES.md`, `RECOMMENDED_SCHEMA.md` - project notes and planning material.
- `supercharged-v3 (4).html`, `supercharged-v4 (5).html` - legacy prototype artifacts.

## 3. Frontend Architecture

The active React app lives in `frontend/` and is bootstrapped by `src/main.jsx`.

### 3.1 App bootstrapping

- [frontend/src/main.jsx](frontend/src/main.jsx) initializes Sentry and PostHog, then renders `App`.
- Sentry tracing and replay are enabled here; the current setup also filters noisy expected Appwrite auth failures.
- PostHog is initialized only when a key is provided.

### 3.2 App shell and routing

- [frontend/src/App.jsx](frontend/src/App.jsx) is the top-level orchestrator.
- It handles session detection, auth/logout, and which screen should be shown.
- It can route the user into:
  - the auth screen,
  - onboarding,
  - the inbox/chat experience,
  - the profile screen.
- It uses Appwrite auth plus profile lookup to decide whether a user is fully onboarded.

### 3.3 Auth and onboarding

- `AuthScreen` lives inside [frontend/src/App.jsx](frontend/src/App.jsx).
- `NewOnboarding.jsx` is the multi-step onboarding flow.
- The onboarding flow captures identity, intent, interests, profile details, and other structured fields.
- Session cleanup is defensive so credential auth does not collide with an already-active session.

### 3.4 Inbox and chat experience

- [frontend/src/SuperchargedInbox.jsx](frontend/src/SuperchargedInbox.jsx) powers the inbox, new requests, active chats, preview mode, relationship context drawer, AI draft helpers, and Voltz toasts.
- It is a single component with lots of local state and presentational subcomponents.
- It uses cache-first hydration for profile and inbox state, then refreshes in the background.
- It supports:
  - conversation list,
  - pending connection cards,
  - unread and attention notifications,
  - chat preview mode for new requests,
  - relationship context drawer,
  - AI draft / reply flows,
  - Voltz reward toasts.

### 3.5 Profile screen

- [frontend/src/supercharged_v18.jsx](frontend/src/supercharged_v18.jsx) is the main profile screen used by the app.
- It renders:
  - hero image carousel,
  - bio,
  - intent card,
  - interest sections,
  - activity stats,
  - editable panels,
  - photo upload/edit flows.
- It now caches the current profile payload locally and reads profile stats through a backend function rather than directly from private tables.

### 3.6 Shared frontend utilities

- [frontend/src/lib/appwrite.js](frontend/src/lib/appwrite.js) exports the Appwrite SDK clients and table/function IDs.
- [frontend/src/lib/cache.js](frontend/src/lib/cache.js) provides a small localStorage cache wrapper for profile and inbox state.
- [frontend/src/components/VoltzSystem.jsx](frontend/src/components/VoltzSystem.jsx) contains the wallet / purchase modal UI for Voltz.

### 3.7 Frontend design system

The app uses a custom visual language rather than a generic dashboard pattern:

- Playfair-style editorial typography for high-emotion moments.
- DM Sans for UI chrome.
- Warm off-white surfaces with charcoal text.
- Bold black outlines and rounded pills.
- Motion is used for transitions and panels rather than everywhere.

## 4. Backend Functions

All backend code lives under `functions/` and runs as Appwrite functions.

### 4.1 profileSync

Path: [functions/profileSync/src/main.js](functions/profileSync/src/main.js)

Purpose:

- Triggered on profile create/update/delete.
- Converts profile content into embeddings for Qdrant.
- Builds and stores multiple vectors, including intent and semantic views.
- Uses a deterministic UUID derived from the Appwrite document ID.
- Updates payloads used by search and discovery.

External services used:

- Google Gen AI for embeddings.
- Qdrant for vector storage and retrieval.
- Sentry for error reporting.
- PostHog for product analytics.

Important behavior:

- It skips onboarding-incomplete profiles.
- It includes CV text in the semantic embedding when available.
- It prevents an endless update loop by skipping re-syncs when only indexing flags change.

### 4.2 cvParser

Path: [functions/cvParser/src/main.js](functions/cvParser/src/main.js)

Purpose:

- Triggered when a file is uploaded to the CV bucket.
- Downloads the file from Appwrite Storage.
- Extracts text from PDF, Word, or text files.
- Writes the parsed text back into the user profile row.
- Marks the CV as indexed so `profileSync` can re-embed richer data.

This function is the bridge between uploaded CVs and the vectorized profile search layer.

### 4.3 discoveryEngine

Path: [functions/discoveryEngine/src/main.js](functions/discoveryEngine/src/main.js)

Purpose:

- Runs the main semantic discovery pipeline.
- Translates raw user queries into semantic/intent/search variants.
- Queries Qdrant with weighted hybrid strategies.
- Supports filtered and unfiltered search variants.

Notable behavior:

- It uses Gemini for query translation and normalization.
- It is the main search brain for the app’s internal discovery experience.
- It supports structured filters like college, intent, year, subject, career, relationship intent, and several array fields.

### 4.4 biosContext

Path: [functions/biosContext/src/main.js](functions/biosContext/src/main.js)

Purpose:

- Returns a compact profile context snapshot for a given user ID.
- Used when a lighter-weight profile summary is needed without the full row shape.
- Falls back to the profiles table directly.

This is a small helper function, but it is important because several discovery/search flows want a compact user context.

### 4.5 connectionGateway

Path: [functions/connectionGateway/src/main.js](functions/connectionGateway/src/main.js)

Purpose:

- Central backend for relationship and inbox operations.
- Handles request creation, acceptance, decline, undo, block, list views, connection detail views, and stats/bootstrap data.

Main actions currently supported:

- `initiate_request` / `create_connection` / `create_connection_request`
- `accept_connection`
- `decline_connection`
- `undo_decline`
- `block_connection`
- `list_pending_to_me`
- `list_pending_from_me`
- `list_active`
- `list_connections`
- `get_connection`
- `get_profile_stats`
- `bootstrap_inbox`

Important behavior:

- It creates relationship events and Voltz ledger rows when events happen.
- It stores compatibility snapshots when a connection is accepted.
- It computes relationship strength, stage progress, unread counts, and preview data for the chat experience.
- It now batches profile lookups for inbox lists and uses bounded concurrency to reduce N+1 penalties.

### 4.6 messageGateway

Path: [functions/messageGateway/src/main.js](functions/messageGateway/src/main.js)

Purpose:

- Message lifecycle backend for list/send/read operations.
- Returns message threads for a conversation.
- Marks conversations as read.
- Handles sender lookup mapping.

It also includes a batched profile lookup helper so sender profile data does not have to be fetched one row at a time.

### 4.7 stripeGateway

Path: [functions/stripeGateway/src/main.js](functions/stripeGateway/src/main.js)

Purpose:

- Creates Stripe Checkout sessions for Voltz purchases and subscriptions.
- Handles Stripe webhook completion.
- Credits Voltz to the user profile and writes a ledger row.

Key flow:

- Lookup profile by Appwrite user ID.
- Create or reuse a Stripe customer.
- Create checkout session with a top-up or subscription price.
- On webhook completion, update `current_voltz` and insert a `voltz_ledger` row.

This is the payment bridge for the in-app currency system.

## 5. Appwrite Integration

### 5.1 Project and storage

Current Appwrite project settings in [appwrite.json](appwrite.json):

- Project ID: `69de7f335c0489352ff1`
- Endpoint: `https://fra.cloud.appwrite.io/v1`

Buckets:

- `profilePhotos` - user-uploaded profile images.
- `cvs` - CV uploads used by `cvParser`.

### 5.2 Tables and data model

The main database is `supercharged`.

Primary tables:

- `profiles` - user profile data.
- `matches` - compatibility scoring / match history.
- `conversations` - chat threads.
- `conversation_members` - membership and last-read state.
- `messages` - message bodies and delivery state.
- `connections` - relationship/request state.
- `relationship_events` - connection timeline and Voltz-earning events.
- `voltz_ledger` - Voltz balance ledger for users.

Other key notes:

- `profiles` is user-readable and user-writable via permissions.
- `connections`, `relationship_events`, and `voltz_ledger` are kept private; frontend access should go through Appwrite functions.
- `relationship_events` and `voltz_ledger` are now used as the canonical activity/currency history.

### 5.3 Functions configuration

Functions are declared in [appwrite.json](appwrite.json) with live deployment enabled.

Configured function IDs:

- `profileSync`
- `discoveryEngine`
- `cvParser`
- `biosContext`
- `connectionGateway`
- `messageGateway`
- `stripeGateway`

Each function has a path, entrypoint, runtime, and execution/event trigger config.

## 6. Stripe And Voltz

Voltz is the app’s internal currency and is implemented with Appwrite plus Stripe.

### 6.1 Currency storage

Profiles can now hold:

- `current_voltz`
- `visibility_boost_level`
- `visibility_boost_expires_at`
- `stripe_customer_id`
- `stripe_subscription_id`

The ledger table stores per-event entries and Stripe correlation data.

### 6.2 Stripe purchase flow

The frontend purchase modal is in [frontend/src/components/VoltzSystem.jsx](frontend/src/components/VoltzSystem.jsx).

Flow:

1. User picks a top-up or subscription.
2. Frontend calls `stripeGateway` using the Appwrite Functions SDK.
3. Backend creates the Stripe session.
4. Stripe webhook confirms completion.
5. Backend credits Voltz and writes a ledger entry.

This is the canonical payment path for currency and subscription logic.

## 7. Discovery And Search

The app has several search-related surfaces:

- `discoveryEngine` is the primary internal semantic search function.
- `external_search.js` orchestrates multi-stage search/fallback behavior.
- `discover.js` is a manual search script that uses Gemini and Google Search grounding.
- `poc_search.js` is a smaller exploration script.

Typical search layering:

1. In-app semantic search against Qdrant.
2. Network graph / relationship-based filtering.
3. External search fallback when local results are insufficient.

The search code is structured around query translation, filter normalization, and result scoring.

## 8. Operational Utilities And Scripts

These files are used for maintenance, experimentation, or recovery:

- `reindex_qdrant_profiles.js` - replays profile sync over existing rows.
- `test_sync.js` - smoke-tests profile sync timing and Qdrant output.
- `repair_schema.js` / `repair_schema.py` - mutates the Appwrite schema JSON to add or fix columns.
- `discover.js` - command-line discovery helper.
- `poc_search.js` - search experimentation.
- `external_search.js` - multi-stage search orchestration.

The `evals/` folder provides evaluation tooling and a golden dataset for search quality checks.

## 9. Current Frontend State And Behavior Notes

- The app now uses cache-first hydration for profile and inbox views.
- Profile stats are fetched through the backend function rather than direct client reads from private tables.
- Inbox first paint is optimized to render cached data immediately and refresh in the background.
- Sentry is configured to avoid drowning the browser with repeated expected Appwrite auth errors.
- The UI still keeps private tables private; the frontend should not be granted broad read access to relationship/currency tables.

## 10. High-Level Data Flow

### Profile lifecycle

1. User signs up or logs in.
2. Onboarding captures identity and intent.
3. Profile row is saved in Appwrite.
4. `profileSync` creates Qdrant vectors.
5. `cvParser` can enrich the profile later from uploads.

### Inbox lifecycle

1. App starts and session is resolved.
2. Inbox loads cached state if available.
3. `connectionGateway` returns active conversations and pending requests.
4. Chat opens a conversation and loads messages.
5. Relationship events and Voltz ledger rows are written as actions happen.

### Payment lifecycle

1. User opens the Voltz purchase modal.
2. Frontend requests checkout session from `stripeGateway`.
3. Stripe handles payment.
4. Webhook credits Voltz and stores the ledger record.

## 11. Implementation Philosophy

The codebase generally prefers:

- Appwrite as the system of record.
- Appwrite functions as backend gateways rather than direct client access for sensitive tables.
- Qdrant for vector search and profile similarity.
- Stripe for money, Appwrite for internal state, and Voltz as a simple ledgered currency.
- Mobile-first, relationship-driven UX instead of generic CRUD screens.

## 12. Useful Starting Points

If you are trying to change something specific, these are the main anchors:

- Session/auth flow: [frontend/src/App.jsx](frontend/src/App.jsx)
- Onboarding: [frontend/src/NewOnboarding.jsx](frontend/src/NewOnboarding.jsx)
- Inbox/chat: [frontend/src/SuperchargedInbox.jsx](frontend/src/SuperchargedInbox.jsx)
- Profile screen: [frontend/src/supercharged_v18.jsx](frontend/src/supercharged_v18.jsx)
- Appwrite client IDs and helpers: [frontend/src/lib/appwrite.js](frontend/src/lib/appwrite.js)
- Relationship backend: [functions/connectionGateway/src/main.js](functions/connectionGateway/src/main.js)
- Message backend: [functions/messageGateway/src/main.js](functions/messageGateway/src/main.js)
- Search backend: [functions/discoveryEngine/src/main.js](functions/discoveryEngine/src/main.js)
- Profile sync: [functions/profileSync/src/main.js](functions/profileSync/src/main.js)
- CV parsing: [functions/cvParser/src/main.js](functions/cvParser/src/main.js)
- Bio summary helper: [functions/biosContext/src/main.js](functions/biosContext/src/main.js)
- Stripe integration: [functions/stripeGateway/src/main.js](functions/stripeGateway/src/main.js)
