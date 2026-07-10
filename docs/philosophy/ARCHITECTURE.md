# Architectural Principles

## Core Principles

### 1. Fetch at the edge, not in the client

The Cloudflare Worker sits at the edge, close to the user. All data fetching - from Supabase, from external platform APIs, from Redis - happens in the Worker. The React client fetches from the Worker only. The client never talks to Supabase or platform APIs directly.

**Why:** Keeps credentials server-side. Enables caching at the edge. Single point of auth enforcement.

### 2. One source of auth truth

Authentication is Supabase JWTs. The Worker verifies the JWT on every protected request. `userId` derived from the verified JWT is the only identity that matters. No session state. No cookies. The JWT is verified by checking its signature against the Supabase JWT secret - not by calling Supabase on every request.

**Why:** Stateless auth scales to zero infrastructure. JWTs are self-verifying.

### 3. Application-layer isolation instead of RLS

Every DB query appends `.eq('user_id', userId)` where `userId` comes from the verified JWT. The Worker uses the service-role key (which bypasses RLS). RLS is not relied upon for security.

**Why:** RLS adds complexity without benefit when the application layer already enforces isolation. The service-role key is needed for admin operations (cron jobs, token refresh) that run without a user JWT. See `ADR-011`.

**Constraint:** Never relax the `.eq('user_id', userId)` pattern. If you write a query without it, you have a data exposure bug.

### 4. Fail silently on the cache

Redis is optional infrastructure. The cache layer always catches errors and returns `null` on failure. The application falls through to the source of truth (Supabase / platform API). A Redis outage is invisible to users.

**Why:** Cache is a performance optimization, not a correctness requirement. Making it optional makes the system more resilient. See `ADR-008`.

### 5. Credentials stay in the Worker

Platform API credentials (Instagram app secret, YouTube API key) are Worker secrets - not in code, not in the database, not in the frontend. The only credential that goes near the frontend is the Supabase anon key, which is public by design.

User-specific tokens (Instagram access tokens, GitHub PATs) live in `accounts.data` in the database. They are read by the Worker and never returned to the frontend. See `ADR-004`.

### 6. Schemas bend before tables multiply

New platform-specific fields go into the `data jsonb` column on `accounts` or `scheduled_posts`. Adding a new table requires a clear reason: the data has a lifecycle of its own, or it needs to be queried/filtered by a column that can't be in jsonb. See `ADR-005`.

### 7. No TypeScript anywhere

This is a deliberate constraint, not an oversight. See `ADR-010` and `docs/guidelines/JAVASCRIPT.md`.

## What This Architecture Is Not

**Not a microservices architecture.** One Worker serves all backend routes. One Hono app. One entry point.

**Not a real-time system.** There are no WebSockets, no Server-Sent Events. Analytics pages refresh on load. Scheduled post status updates on poll.

**Not a multi-tenant platform.** Every user has their own credentials, their own accounts. There is no concept of organizations, teams, or shared accounts at the data layer. (This is a known constraint - see ROADMAP.md.)

## When to Break These Rules

These principles guide the initial implementation. Breaking them requires an explicit ADR:
- Adding a second Worker: write `ADR-013` explaining why one Worker is insufficient
- Enabling RLS: write an ADR explaining why application-layer isolation failed
- Adding TypeScript: write an ADR with clear measurable benefit
- Adding a state management library: write an ADR showing that context + local state is insufficient

The cost of documenting the decision is intentionally low. The point is to make the tradeoff visible, not to prevent evolution.
