# Platform v2 architecture

The architecture for the platform v2 work (#142): Reddit removed, an MCP server for Claude clients, YouTube publishing, and security auditing built into the workflow. It builds on the system described in `docs/architecture/OVERVIEW.md`; when a part ships, its permanent description moves into the matching architecture doc and this page keeps the decisions and trade-offs. The research behind each decision is in `RESEARCH.md`.

---

## Current system (before v2)

- **Worker:** Hono on Cloudflare Workers. Middleware (CORS, request id and deadline, security headers, clients, IP rate limit), then `requireAuth` (Supabase JWT checked with `auth.getUser`), per-user and per-route rate limits, route tables, controllers, services (`createXService(deps)`) and repositories. One error contract (`ApiFailure`).
- **Cron:** every minute (comment reply dispatch), every five minutes (scheduled Instagram posts on the quarter hour, queue checks in between), daily (token refresh, retention).
- **Second scheduler:** a GitHub Actions job (`scripts/publish-scheduled.ts`) publishes due Instagram posts too; both claim posts atomically so each publishes once.
- **Data:** Supabase Postgres. Every table has RLS on and browser access revoked; only the Worker's service key reads and writes, always scoped by the verified user id. Optional Upstash Redis caches analytics and counts rate limits.
- **Media:** the browser uploads to Cloudinary with an unsigned preset; the Worker only sees the resulting URL.
- **Platforms:** YouTube (analytics with an API key, no OAuth), Instagram (OAuth, analytics, publishing, comment-to-DM automation), Reddit (public JSON plus an optional session cookie).

---

## Target system

```
Claude (claude.ai, Desktop, mobile)         Claude Code, scripts
        | OAuth 2.1 (Supabase Auth)                | personal access token
        v                                           v
  POST /mcp  -- requireMcpAuth -- MCP rate limits -- JSON-RPC dispatch -- tool registry
                                                                            |
  Browser app -- /api/* -- requireAuth -- rate limits -- controllers -------+
                                                                            v
                                                     services (unchanged rules, one implementation)
                                                                            v
                                                      repositories -> Postgres, Redis
Cron (Worker) and GitHub Actions -- claim jobs -- YouTube upload steps -- Cloudinary byte ranges -> Google
```

### 1. Reddit removed

Every Reddit route, service, type, cache key, rate limit rule, page and doc goes. The tracked content feature keeps YouTube videos only, so the Reddit-only fields (`manualViews`, `imageUrl`, the per-item account used for a Reddit cookie) go with it. Removing public routes is a breaking change, so this ships as v2.0.0. The database part is in `DATABASE_MIGRATION.md`.

### 2. MCP server

- **Endpoint:** `POST /mcp` on the existing Worker, outside `/api` so the URL people paste into Claude is short. `GET` and `DELETE` answer 405. Responses are JSON only. No sessions are created.
- **Protocol:** dual-era. A request with `method: initialize` gets the 2025-11-25 handshake answer; a request carrying per-request `_meta` is served statelessly as 2026-07-28; `server/discover`, `tools/list`, `tools/call` and `ping` work in both. The JSON-RPC envelope, error builders and header checks are pure functions in `backend/lib/mcp/`, tested with Node.
- **Layers:** a route table (`routes/mcpRoutes.ts`) maps the endpoint; a controller (`controllers/mcpController.ts`) parses the envelope and dispatches; each tool lives in `backend/mcp/tools/` as a definition (name, title, description, JSON Schema for input and output, annotations, required permission) plus a handler that validates input with the same `backend/validators/` functions the REST API uses and calls one service method. Tools never query the database or call a platform directly.
- **Identity:** `requireMcpAuth` accepts two credentials and sets the same `userId` the rest of the pipeline trusts:
  - an OAuth access token from Supabase Auth's OAuth 2.1 server. The Worker checks it with `auth.getUser` (as `requireAuth` does), then requires a `client_id` claim, so an ordinary app session token cannot be replayed at `/mcp`;
  - a personal access token (`twl_` prefix plus 32 random bytes). Only its SHA-256 hash is stored, with the user id, a label, a permission (`read` or `write`), a last-used time and an optional expiry.
- **Discovery:** `GET /.well-known/oauth-protected-resource` (and the `/mcp` suffixed form) names the Supabase authorization server; an unauthenticated call to `/mcp` answers 401 with `WWW-Authenticate: Bearer resource_metadata="..."`, which starts sign-in in claude.ai.
- **Consent page:** Supabase's OAuth server sends the person to the app's `/oauth/consent` page, which shows the client's name and asks whether to allow read only or read and write. The choice is stored per user and client in `mcp_client_grants`.
- **Permissions:** every tool declares `read` or `write`. Write tools need a `write` token or grant. Irreversible or public actions (publish, delete, disconnect) need a second call carrying a confirmation token: the first call returns a preview and an HMAC-signed token bound to the user, the tool and a hash of the arguments, valid for five minutes.
- **Limits:** a per-user MCP rule in `RATE_LIMIT_RULES`, the existing quota and publish rules applied per tool, a 30 second deadline per call (Claude's own limit is 240 s), results capped and paginated.
- **Audit:** every write tool call is recorded in `audit_events` with the client (`mcp:<client_id>` or `mcp:token:<id>`), the tool, and the outcome, never the arguments' secret fields.

### 3. YouTube publishing

- **Connection:** `GET /api/auth/youtube/url` (protected) returns Google's consent URL with a signed state; Google redirects to `GET /api/auth/youtube/callback` (public), which hands the code to the app to complete as the signed-in person (see section 4). The code is exchanged, `channels.list?mine=true` reads the channel, and the connection is stored in `youtube_connections`: the account it belongs to, the channel id, granted scopes, status (`active`, `needs_reconnect`), the encrypted refresh token and the current access token with its expiry. A connected channel that is not yet an analytics account is added as one.
- **Encryption:** refresh and access tokens are encrypted with AES-GCM (a random 12-byte IV per value) under a key from the new Worker secret `TOKEN_ENCRYPTION_KEY`. They never appear in a response, a log or an MCP result.
- **Jobs:** one row per video in `youtube_uploads`, holding a snapshot of the metadata (title, description, tags, category, privacy, publish time, made for kids, synthetic media, notify subscribers, playlist, thumbnail), the Cloudinary source (URL, bytes, content type), the resumable session URI, confirmed bytes, the video id, the state, attempts, next attempt time and a lease.
- **States:** `queued`, `uploading`, `processing`, `finalizing`, `done`; side states `waiting_quota`, `needs_reconnect`, `needs_review` (outcome unknown), `failed` (needs the owner), `cancelled`.
- **Runner:** a claim function (`FOR UPDATE SKIP LOCKED`, 10 minute lease) used by the Worker's five minute cron and by the GitHub Actions scheduler. Each run takes one job, refreshes the token if needed, asks Google for the real offset, then streams 8 MiB byte ranges from Cloudinary through `FixedLengthStream` into the session until its time or subrequest budget runs out. Every write checks the lease owner.
- **Exactly once:** a session is created only when the job has none, and saved before any bytes are sent; a lost final response is recovered by the status query; a session that disappears after the last chunk was sent sends the job to `needs_review`.
- **Retries:** transient errors back off exponentially with jitter (honouring `Retry-After`) and fail after 8 attempts; `quotaExceeded` waits until midnight Pacific; `invalid_grant` marks the connection `needs_reconnect` and parks its jobs without spending an attempt.
- **After upload:** the five minute run polls `videos.list` (up to 50 ids, 1 unit) for processing, then sets the thumbnail and playlist as separate steps, so a failed thumbnail never re-uploads the video.
- **Shorts:** decided from the source file: height at least the width and at most 180 seconds. The composer shows the result; there is no separate upload path.
- **Quota:** `youtube_quota_usage` holds units per Pacific day and bucket (`uploads` 100 calls, `default` 10,000 units), reserved atomically before each call.
- **Cleanup:** with the optional `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`, the source video is deleted once YouTube has it; without them, the asset is listed for manual cleanup.

### 4. Security built in

- **Skills:** the Cloudflare security-audit skill and the relevant Trail of Bits plugins are declared in `.claude/settings.json`; `CLAUDE.md` makes a security pass part of every substantial change, scaled to its size.
- **OAuth completion bound to the signed-in person:** today the Instagram callback connects the account named by the signed state alone, so a consent link made by one person and opened by another connects the second person's Instagram to the first person's Twiligent account. In v2 the public callback only checks the state's signature and forwards `code` and `state` to the app; the app, signed in, posts them to an authenticated `complete` route, which connects the account only when the state's user id equals the caller's. A cookie was rejected because self-hosted apps and Workers often sit on different sites, where browsers drop it. The redirect URIs registered with Meta and Google stay the same.
- **Media ownership:** the Cloudinary account is shared by everyone on an instance, so every media action checks that the asset belongs to a row of the signed-in user before reading or deleting it.

---

## Decisions and trade-offs

| Decision | Chosen | Instead of | Why | Cost |
|---|---|---|---|---|
| MCP protocol code | Hand-written in Hono | `@modelcontextprotocol/server`, Cloudflare `agents` | No runtime dependency; six methods; validators already exist | We track spec changes ourselves; a conformance test and the MCP Inspector cover it |
| MCP sign-in | Supabase OAuth 2.1 server plus personal access tokens | `workers-oauth-provider` with KV; a hand-written authorization server | One identity system, no dependency, no KV; the owner chose it | Supabase's server is beta; the owner enables it and the hook in the dashboard |
| MCP transport | Stateless JSON over `POST /mcp` | SSE streams, sessions, Durable Objects | Fits a Worker; legal in both spec eras | No server-initiated messages (not needed for tools) |
| Upload timing | Upload soon after saving, YouTube publishes at `publishAt` | Upload at publish time like Instagram | Errors surface early; no minute-exact deadline for our runners | A scheduled video cannot be "unlisted at a time"; the UI says so |
| Upload engine | Postgres job row with a lease, moved by cron | Queues, Temporal, BullMQ | No new infrastructure on free tiers; survives restarts by design | Throughput is bounded by run frequency; GitHub Actions adds capacity |
| Video storage | Cloudinary (existing) | R2, direct browser to YouTube | Already configured; byte ranges work | 100 MB per video on Cloudinary's free plan |
| Token storage | AES-GCM in Postgres under a Worker secret | Plain text in `accounts.data` (current Instagram tokens) | A database leak no longer leaks tokens | One more secret to set; key rotation is documented, not automatic |
| Reddit data | Deleted after a backup and the owner's review | Hidden in the UI | The user asked for full removal; the rows hold cookies and passwords | A restore needs the backup file |

---

## Bottlenecks and limits

- **Upload throughput on Workers Free:** 10 ms CPU and 50 subrequests a run. Each chunk is two subrequests (Cloudinary range, Google PUT), so one run moves at most about 20 chunks (160 MB) before database calls; the CPU limit is unmeasured and may be the real ceiling. GitHub Actions, the paid plan, or larger cron frequency raise it.
- **YouTube quota:** 100 uploads a day per Google Cloud project, shared by every channel on the instance; 10,000 units for everything else. The ledger stops calls before Google refuses them.
- **Cloudinary free plan:** 100 MB per video and 25 credits a month; long videos need a paid plan or a later direct upload path.
- **MCP result size:** Claude Code warns above 10k tokens and stops at 25k; list tools paginate and summarize.
- **Supabase OAuth beta gaps:** no resource indicators and exact loopback ports; personal access tokens cover Claude Code meanwhile.
- **Rate limits without Redis:** counted per Worker isolate, looser than a global count (existing, documented in `RATE_LIMITING.md`).
