# Platform v2 implementation plan

The plan for #142, written after the research in `RESEARCH.md` and before any code changed. The design is in `ARCHITECTURE.md`, the schema work in `DATABASE_MIGRATION.md`. Each phase is its own pull request, versioned by the rules in `CLAUDE.md`; the status column is kept up to date as phases finish.

---

## Decisions made by the owner (2026-11-05)

| Question | Decision |
|---|---|
| How Claude clients sign in to the MCP server | Supabase Auth's OAuth 2.1 server for claude.ai, Desktop and mobile, plus personal access tokens for Claude Code and scripts |
| When the Reddit database cleanup reaches production | Only after the owner reviews the exact SQL, the dry run and the row counts |
| The security skills | Declared as plugins in `.claude/settings.json` (referenced, not copied) and jq installed so the Semgrep skill runs |

---

## Phases

| # | Phase | Issue | Depends on | Release | Status |
|---|---|---|---|---|---|
| 0 | Research and plan (this folder) | #143 | | none (docs) | In review |
| 1 | Remove Reddit from the code | #144 | 0 | v2.0.0 (routes removed) | Planned |
| 2 | Remove Reddit from the database | #145 | 1 deployed, owner review | none (data only) | Planned |
| 3 | Security skills, the CLAUDE.md rule, baseline audit and fixes of existing findings | #148 | 0 | patch for any user-visible fix | Planned |
| 4 | MCP server core: endpoint, protocol, personal access tokens, read tools | #146 | 1, 3 | minor | Planned |
| 5 | MCP write tools: scheduling, media import, tracked videos, settings, confirmations | #146 | 4 | minor | Planned |
| 6 | MCP OAuth through Supabase: discovery, consent page, client grants | #146 | 4, owner enables the OAuth server | minor | Planned |
| 7 | YouTube connection: Google OAuth, encrypted tokens, channel info, disconnect | #147 | 3 | minor | Planned |
| 8 | YouTube upload pipeline: jobs, claim and lease, resumable chunks, quota, retries, processing, thumbnail, playlist | #147 | 7 | minor | Planned |
| 9 | YouTube composer, queue, history and media library in the dashboard | #147 | 8 | minor | Planned |
| 10 | MCP tools for YouTube and media | #146, #147 | 5, 8 | minor | Planned |
| 11 | Final security audit of everything, fixes, report | #148 | all | patch | Planned |

The owner's suggested order put security last; it moved to phase 3 because the new rule makes a security pass part of every phase, and the MCP and YouTube code should be written against the fixed baseline. MCP core comes before YouTube as suggested; its YouTube tools wait for the pipeline.

### Dependency map

```
0 research
 +-> 1 remove Reddit (code) -> 2 remove Reddit (database, owner review)
 +-> 3 security baseline
      +-> 4 MCP core -> 5 MCP write tools ----+
      |              -> 6 MCP OAuth           +-> 10 MCP YouTube tools -> 11 final audit
      +-> 7 YouTube connect -> 8 pipeline ----+
                                 +-> 9 YouTube UI
```

---

## Phase details

### 1. Remove Reddit from the code (#144)

- **Remove:** `routes/redditRoutes.ts`, `controllers/redditController.ts`, `services/redditAnalyticsService.ts`, `services/reddit/`, `shared/types/reddit.ts`, the Reddit cache methods, the Reddit account route and validator, the Reddit branches in `accountService`, `accountFactory`, `overviewService`, `trackedContentService` and `trackedContentRules`, `safeAccount`'s Reddit secret fields and `hasCookie`, the Reddit rate limit matcher, and every Reddit test and fixture.
- **Frontend:** `features/analytics/reddit/`, the Reddit routes, navigation and breadcrumbs, the Reddit account form and choices, Reddit parts of Overview tabs, tracked content (category section, manual views, image upload, account picker), the command palette entries and platform icons.
- **Site and docs:** Reddit on the home page, platform section, mockups, FAQ and docs pages; a 301 in `site/public/_redirects` for every removed docs page; every doc in the maintenance table that names Reddit; `README.md`, `ROADMAP.md` goals.
- **Kept:** `CHANGELOG.md` and `DECISIONS.md` history; a new ADR records the removal.
- **Check:** `rg -i reddit` finds only the changelog, the decision log, the redirects and this folder; every check passes; the removed routes answer 404.

### 2. Remove Reddit from the database (#145)

As in `DATABASE_MIGRATION.md` section 1: count, back up, owner review of the SQL and dry run, push, regenerate the schema tree, verify.

### 3. Security skills, rule and baseline (#148)

- `.claude/settings.json`: the `trailofbits` marketplace and an inline marketplace for the Cloudflare skill pinned to a commit; enable `security-audit`, `differential-review`, `insecure-defaults`, `sharp-edges`, `static-analysis`, `supply-chain-risk-auditor`, `variant-analysis` and `audit-context-building`. No plugin that installs hooks.
- `CLAUDE.md`: the security engineering rule (what to run for a small change, a substantial change and a pull request), plus `docs/workflows/SECURITY_REVIEW.md` with the commands.
- Install jq; Semgrep is present.
- Run the baseline: the Cloudflare audit over the Worker, frontend, site, migrations and workflows; Semgrep; the supply-chain audit; `npm audit`. Each confirmed finding gets a fix and a regression test; known ones so far: the OAuth state not bound to the signed-in person (Instagram connect), and 20 dependency advisories in dev tooling.
- Findings are written up in `SECURITY_AUDIT.md`; details of anything exploitable go into a private GitHub security advisory until fixed.

### 4 to 6. MCP server (#146)

Tools (each calls one existing service method; `read` tools need no confirmation; `write` tools need a write token or grant; tools marked confirm need the two-step token):

| Tool | Kind | Calls |
|---|---|---|
| `get_overview` | read | `overview.get` |
| `list_accounts` | read | `accounts.list` (safe fields only) |
| `get_youtube_analytics`, `get_instagram_analytics` | read | the analytics services, summarized and paginated |
| `compare_accounts` | read | analytics services, the same metrics side by side |
| `list_tracked_videos` | read | `trackedContent.list` |
| `list_scheduled_posts`, `get_scheduled_post` | read | `scheduledPosts` |
| `get_instagram_publishing_limit` | read | `publishing.limit` |
| `get_settings` | read | `settings` (no secrets) |
| `schedule_instagram_post` | write | `scheduledPosts.create` (idempotency key) |
| `update_scheduled_post` | write | `scheduledPosts.update` |
| `cancel_scheduled_post` | write, confirm | `scheduledPosts.delete` |
| `import_media_from_url` | write | Cloudinary upload by URL (Cloudinary fetches it, not the Worker), then a `media_assets` row |
| `list_media`, `update_media` | read, write | `media_assets` for the caller only |
| `delete_media` | write, confirm | the media service, ownership checked |
| `add_tracked_video`, `remove_tracked_video` | write; remove confirms | `trackedContent` |
| `refresh_account` | write | `accounts.refresh` (quota rule applies) |
| `update_settings` | write | `settings.saveGithub` |
| `list_youtube_channels` | read | `youtube_connections` (no tokens) |
| `create_youtube_upload` | write, confirm when public now | the upload service (idempotency key) |
| `get_youtube_upload`, `list_youtube_uploads` | read | the upload service |
| `update_youtube_upload`, `retry_youtube_upload` | write | the upload service |
| `cancel_youtube_upload` | write, confirm | the upload service |

Not exposed on purpose: connecting or removing accounts (they need a browser consent screen or are destructive beyond undo), changing passwords, creating tokens, and anything that returns a secret.

Settings gains a "Claude" section: the server URL to paste, a token list (create, copy once, revoke, last used), and the OAuth clients granted access (revoke).

### 7 to 9. YouTube publishing (#147)

- New Worker secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`; optional `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` for cleanup and media deletion.
- Shared rules with no runtime imports in `backend/lib/youtubeUpload.ts` (chunk math, error classification, backoff, Short detection, metadata limits), so the Worker and `scripts/publish-scheduled.ts` run the same logic.
- Dashboard: "Connect YouTube" on the Accounts page with channel info, scopes, status and disconnect; a YouTube tab in Publish with media picker, metadata editor (title counter to 100, description to 5000 bytes, tags to 500 characters, category, privacy, made for kids, synthetic media, notify subscribers, playlist, thumbnail), publish now or schedule, a Short badge from the file's shape and length, and remaining uploads today; a queue with per-job progress and state, retry, cancel and review actions; upload history with links to the videos.

---

## Testing strategy

| Layer | What | How |
|---|---|---|
| Pure rules | JSON-RPC parsing, error codes, header checks, confirmation tokens, chunk math, backoff, error classification, Short detection, metadata limits, token encryption round trip | `node:test` unit tests in `backend/tests/lib/` |
| Services | Every MCP tool's validation and permission, upload state transitions (resume, lost final response, session gone, quota, `invalid_grant`), token refresh with lease | Service tests with the smallest typed fakes |
| Routes | `/mcp` 401 with `WWW-Authenticate`, 405 on GET, `initialize` and modern requests, cross-user access refused, write refused for a read token; OAuth callback and complete routes | Route tests through `createApp()` with fake clients |
| Database | One entity per file, rollbacks, schema tree in step | `backend/tests/database/migrations.test.ts` |
| Frontend | Composer validation, queue state labels, token list | `frontend/tests/` |
| Protocol conformance | A real MCP client lists and calls tools | MCP Inspector against `wrangler dev`; Claude Code with a token |
| Live | Real upload of a video and a Short; interrupted upload resumes | Needs the owner's Google client and a test channel; recorded in `YOUTUBE_INTEGRATION.md` |
| Load | Many due jobs and parallel MCP calls | A script that creates jobs and fires concurrent calls at `wrangler dev`; checks no job is claimed twice and limits answer 429 |
| Security | Phase 3 tooling on every phase's diff; full audit in phase 11 | Semgrep, the Cloudflare skill, `differential-review`, `npm audit` |

Every phase ends with `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` passing, and the UI checklist in `docs/guidelines/UI_UX.md` for anything people see.

---

## Failure scenarios designed for

| Scenario | Handling |
|---|---|
| Two cron runs and GitHub Actions reach the same upload | `claim_youtube_upload` skips locked rows; every write checks the lease owner |
| A run dies mid-upload | The lease expires; the next run asks Google for the offset and resumes |
| The last chunk's response is lost | The status query returns the finished video and its id |
| The upload session disappears after the last chunk was sent | `needs_review`; the owner checks the channel; never a blind second upload |
| Refresh token revoked or expired | The connection becomes `needs_reconnect`; its jobs wait without spending attempts; the dashboard asks to reconnect |
| Quota used up | `waiting_quota` until midnight Pacific; the composer shows uploads left today |
| Cloudinary or Google unreachable | Backoff with jitter, then `failed` after 8 attempts, with the reason |
| An MCP client sends a stolen app session token | Refused: OAuth tokens must carry `client_id` |
| An MCP client asks for another person's post id | Not found: every service call is scoped by the verified user id |
| A prompt inside a comment or caption tells Claude to delete things | Returned as data only; deleting needs a write grant and a confirmation token bound to the exact arguments |
| A media import URL points at an internal address | Cloudinary fetches the URL, not the Worker; the Worker also refuses non-https and private addresses |

---

## What the owner does

| When | Action |
|---|---|
| Phase 2 | Review the migrations, dry run and counts; keep the backup file safe |
| Phase 6 | In Supabase: enable the OAuth 2.1 server, allow dynamic client registration, set the authorization path to `/oauth/consent` |
| Phase 7 | In Google Cloud: enable YouTube Data API v3, set up the consent screen in production, create a web OAuth client with the callback URL; set the Worker secrets |
| Phase 8 | Optional: set the Cloudinary API key and secret for automatic cleanup |
| Phase 9 | Upload a test video and a test Short to a channel; try an interrupted upload |
| Any phase | Approve merges and production deploys as usual |

---

## Acceptance criteria and how each is verified

| Criterion | Verified by |
|---|---|
| Reddit fully removed, no broken references | `rg -i reddit`, type check, build, removed routes answer 404 |
| Supabase cleaned safely | Counts before and after, backup kept, migrations test, Overview and tracked content load |
| MCP connects, authenticates and enforces authorization | Route tests, MCP Inspector, Claude Code with a token, claude.ai once the owner enables OAuth |
| Media upload and management | Service tests; a real import into the owner's Cloudinary |
| YouTube OAuth, video and Short uploads, recovery | Unit and service tests for every transition; live uploads by the owner (cannot be done without the owner's Google client) |
| Jobs persist across restarts, concurrency is safe | State lives in Postgres; claim tests; the load script |
| Security skills in the workflow, scans run, findings fixed | `.claude/settings.json`, `CLAUDE.md` rule, `SECURITY_AUDIT.md` with commands and results |
| All tests pass, docs complete | CI on every pull request; the documentation maintenance table |

Anything that could not be verified is listed as such in the final report and in the matching document, never reported as working.
