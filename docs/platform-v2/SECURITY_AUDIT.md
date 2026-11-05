Fixed (#161): the circuit breakers ignore the Workers "Too many subrequests" error, neither counting nor clearing failures. Test in `circuitBreaker.test.ts` |







The security assessment for #148: what was run, what it found, what was fixed and what stays open. Every tool named here ran; each result is the tool's actual output. The workflow that keeps this going after v2 is `docs/workflows/SECURITY_REVIEW.md`.

This first audit covers the application as it stood on `main` at commit 7f35357 (2026-11-05), before the MCP server and YouTube publishing were built. Those parts get their own review as they are built and a second full audit before the platform v2 work closes (`IMPLEMENTATION_PLAN.md`, phase 11); this page gains a section for it.

---

## What ran

| Tool | Scope | Result |
|---|---|---|
| Cloudflare `security-audit` skill, full audit mode, quick profile | Worker, app, site, migrations and SQL functions, GitHub Actions, the scheduling script | 2 confirmed findings, 9 leads that need validation, 1 rejected; 25 coverage units (14 covered, 8 candidate, 3 deferred). Ten agents: 2 reconnaissance, 4 hunters, 1 critic, 3 independent verifiers. Source only: the machine has no OS sandbox, so no project code was run and nothing deployed was probed. Output, validated by the skill's own validators: `~/security-audit-skill/twiligent/run-1` (outside the repository) |
| Semgrep 1.174.0 (`p/typescript`, `p/javascript`, `p/secrets`, `p/github-actions`, `p/react`) | Every tracked file | Before fixes: 14 results (13 actions on movable tags, 1 `dangerouslySetInnerHTML`). After fixes: 1 result, the `dangerouslySetInnerHTML`, which is a false positive (see below) |
| `npm audit` | Root lockfile | 20 advisories in all (0 critical, 6 high, 13 moderate, 1 low), almost all in development tools; with `--omit=dev`, 12 (6 high), all reached through the `shadcn` CLI. After moving it to devDependencies: 0 production advisories (see Dependencies) |

Coverage areas, each recorded in the audit's coverage ledger: authentication and sessions, access control, API and input validation, injection and deserialization, output encoding and XSS, CSRF, CORS, response headers, SQL functions and row level security, SSRF and path traversal, command injection, scheduling and publish-once logic, secrets and environment variables, rate limiting, dependencies, CI/CD, token handling, the Supabase Auth email hook, the Instagram webhook, cron jobs and the public site.

Deviations from the skill, recorded by the run: reconnaissance used 2 agents instead of 4; each verifier checked a batch of four candidates; the validators ran through a small shim because Windows Node has no `O_NOFOLLOW`; the run's own `REPORT.md` could not be written by the audit agent (its harness blocks report files), so this page is the report.

---

## Confirmed findings

| Id | Severity | Finding | Status |
|---|---|---|---|
| F1 | Medium (likelihood low, impact high) | **Instagram sign-in was not bound to the person who started it.** The public callback connected the account named by the signed state alone, so a consent link made by one Twiligent user and completed by another person connected that person's Instagram account, with publishing, messaging and insights access, to the first user's account. | Fixed: commit "finish Instagram sign-in only for the person who started it". The callback only checks the state and hands the code to the app in the URL fragment; the signed-in app posts it to `POST /api/auth/instagram/complete`, which refuses a state started by anyone else (403) before any call to Instagram. Regression tests: `backend/tests/routes/instagramAuthRoutes.test.ts` ("a consent link made by one person and completed by another connects nothing") |
| F2 | Low (likelihood medium, impact low) | **The manual publish trigger ran every user's due posts.** `GET` and `POST /api/process-scheduled` started the all-user publisher, so any signed-in user could settle other users' posts, spend their attempts, and read their failed post ids and error reasons. | Fixed: commit "limit the manual publish trigger to the caller's posts". The trigger now lists only the caller's due and stale posts; the cron and the GitHub Actions publisher still serve everyone. Regression test: `backend/tests/routes/scheduledPostRoutes.test.ts` ("runs only the caller's own due posts"). Later the trigger itself was removed, since nothing called it (#159), so the exposure is gone entirely |

Rejected by the verifiers: "deploy secrets are reachable from any branch". Running a deploy already needs write access to the repository, so no lower-trust person gains anything.

---

## Leads that need validation

Each depends on a fact outside the repository or on running code. None is a confirmed vulnerability; several were mitigated anyway because the fix is cheap.

| Id | Lead | Status |
|---|---|---|
| L1 | With "Confirm email" off, as the self-hosting guide advises, anyone can create a password account for someone else's address, and may keep access after the real owner signs in with a code or Google | Mitigated (#161). It is a Supabase setting: the self-hosting guide now says to keep Confirm email on and to close sign-up before ever turning it off. The project's own instance was checked read-only through the Supabase Management API on 2026-11-05: Confirm email on, Send Email hook set |
| L2 | Comments on an Instagram account connected by two Twiligent users are routed to whichever user's rule wins, without checking that the account's token still works | Fixed (#161): comments route only to connections whose token is present and unexpired, and the hourly account limit counts replies through every connection to the same Instagram account (migrations `replace_automation_rules_for_ig_user_function` and `replace_reserve_automation_send_function`) |
| L3 | The GitHub Actions publisher printed Instagram's error text unredacted, and the setup guide recommends a public fork whose run logs anyone can read | Fixed: commit "redact Instagram errors in the GitHub Actions publisher log". Errors go through the Worker's `redactSecrets`, the account id is no longer printed, and the guide and the app say what the logs contain |
| L4 | `HEAD /api/process-scheduled` skipped the quota rule because the matcher compared the raw method | Fixed: commit "count HEAD requests against the same rate limit rule as GET"; test in `rateLimit.test.ts` |
| L5 | A user-triggered publisher run under the 30 second request deadline could leave other users' posts claimed and spend their attempts | Mitigated by F2: the trigger now only touches the caller's own posts |
| L6 | The instance's shared YouTube API quota is counted per request, not per unit | Fixed (#161): each YouTube operation runs through `youtubeQuotaService`, which counts units (search 100, list calls 1) per member and Pacific day in Redis and refuses a member past 2,500 with a 429 that says when it resets. Tests: `youtubeQuota.test.ts`, `youtubeQuotaService.test.ts`, `youtubeQuotaRepository.test.ts` |
| L7 | The daily token refresh retries dead Instagram tokens with no subrequest budget and can starve the 90 day retention purge | Fixed (#161): expired tokens are skipped and logged as needing a reconnect, at most 10 refreshes run a day soonest first, and each daily step logs its own failure so the retention purge always runs. Tests in `tokenRefreshService.test.ts` and `jobs/scheduled.test.ts` |
| L8 | One user's many due posts can use the shared publisher's subrequests and delay others' posts | Fixed (#161): both schedulers check stale claims first, then let due posts take turns by account, oldest first, five per account a run (`fairPublishOrder`). Test in `scheduledPublishing.test.ts` |
| L9 | One user's subrequest overrun can open the circuit breakers all users share | Fixed (#161): the circuit breakers ignore the Workers "Too many subrequests" error, neither counting nor clearing failures. Test in `circuitBreaker.test.ts` |

---

## Hardening done in the same work

| Change | Why |
|---|---|
| Every GitHub Actions step pinned to a full commit SHA | A movable tag lets whoever controls an action's repository change the code that runs with the deploy secrets (Semgrep `github-actions-mutable-action-tag`, 13 results) |
| `permissions: contents: read` in every workflow | The `GITHUB_TOKEN` a step receives can now only read; no workflow writes to the repository |
| `_headers` for the app and the site on Cloudflare Pages | `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` stop clickjacking; also `nosniff`, a referrer policy and a permissions policy. The Worker already sent strict headers on API responses |

---

## Not a finding

- `dangerouslySetInnerHTML` in `site/src/components/icons.tsx`: the markup is a constant generated at build time from the Solar icon set by `site/build/genIcons.ts`; no user input reaches it.
- Follow-ups sent after a person answers a followers-only reply are not counted by the hourly reply limits: they use Instagram's Send API inside the person's own 24 hour messaging window, at most one per comment, as `docs/architecture/data-flows/AUTOMATION.md` describes.

---

## Dependencies

- All 12 production advisories (`npm audit --omit=dev`: 6 high, 5 moderate, 1 low, in `body-parser`, `undici`, `systeminformation`, `zod`, `qs`, `fast-uri`, `minimatch`, `deepmerge` and `@shadcn/registry`) come through the `shadcn` package, which `frontend/package.json` lists under `dependencies`. The app only imports its stylesheet (`@import "shadcn/tailwind.css"` in `frontend/src/index.css`), which Vite inlines at build time, so none of the CLI's server-side packages reaches the browser bundle or the Worker. The exposure is to developers who run the shadcn CLI.
- Applied in 2.0.1 with the owner's approval: `shadcn` moved to `devDependencies` at the same version (`npm install -D shadcn@4.21.5 --workspace frontend`), which states that it is build tooling. `npm audit --omit=dev` afterwards: 0 advisories. The app builds the same, since Vite inlines the stylesheet at build time.
- The development-only advisories (`typescript-eslint`'s `minimatch`, `wrangler`'s `miniflare` and `undici`) affect local tooling only; they are fixed by routine updates of those tools.

---

## Remaining risk

- Every check was source-only. Behaviour that depends on Supabase Auth, Meta or Google (L1, L2) and anything that needs running code was not reproduced.
- The deployed settings (Supabase "Confirm email" and sign-up, Cloudflare and GitHub settings) were not inspected.
- The open leads were fixed in 3.1.0 (#161): L2, L6, L7, L8 and L9 in code with regression tests, L1 by the self-hosting guide and a check of the project's own Supabase settings.

---

## Second audit (run 2, #152)

A scoped pass over everything that changed between the first audit and 3.0.0 (`7f35357..c4a79fc`): the MCP server, its access tokens, OAuth client grants and tools, the consent page and the sign-in return path, the Claude settings section, the Instagram OAuth completion, the Reddit removal and the cleanup.

| Tool | Scope | Result |
|---|---|---|
| Cloudflare `security-audit` skill, full audit mode, quick profile | The diff above, in a pinned worktree | 0 confirmed findings, 4 leads that need validation, 0 rejected; 36 coverage units (23 covered, 5 candidate, 2 deferred, 6 out of scope). Nine agents: 1 reconnaissance, 4 hunters, 1 critic, 3 independent verifiers. Source only, no code run, nothing deployed probed. Both of the skill's validators passed on `coverage-ledger.json` and `findings.json`. Output: `~/security-audit-skill/twiligent/run-2` (outside the repository); the run's own `REPORT.md` was not written there, because the sub-agent harness refuses report files, and this section is the report |
| Claude Code `security-review` | Branch `fix/audit-leads` (the fixes for the first audit's leads, 3.1.0) | No vulnerability at confidence 8 or above |
| Semgrep (`p/typescript`, `p/secrets`, `p/owasp-top-ten`) | The changed TypeScript files of each fix branch | 0 findings |
| `npm audit --omit=dev` | Root lockfile | 0 vulnerabilities |

The run also confirmed that first-audit findings F1 and F2 and leads L3, L4 and L5 are resolved in current source.

### Leads and what was done

None of the four could be confirmed from source alone, since each depends on Supabase, a library or Claude's clients. Each was fixed anyway where a source fix exists.

| Id | Lead | Status |
|---|---|---|
| N1 | The REST API accepted tokens Supabase's OAuth server issued to Claude apps, giving an app the person's full session past its read-only choice or removal, and letting it mint a write access token for itself | Fixed: `requireAuth` refuses any token with a `client_id` claim; such tokens only work on `/mcp`, where the grant is checked. Test: `backend/tests/middleware/auth.test.ts`. Not reachable on the project's own instance at the time, whose OAuth server is off |
| N2 | The browser client used Supabase's implicit flow with session detection on, so a link with `#access_token` could sign a person in as someone else, who would then receive the Instagram account they connect | Fixed: the client uses the PKCE flow (`frontend/src/lib/supabaseAuthOptions.ts`, with a test); a sign-in only returns as a code the same browser can exchange |
| N3 | The confirmation token goes back to the same model it gates, so text in a caption or video title could lead a model to confirm on its own | Mitigated: the confirmation now names the media address, the full caption, collaborators, alt text and location, and the tools refuse fields their schema does not show. The rest depends on Claude's clients showing each tool call to the person; recorded in `docs/philosophy/SECURITY.md` (Known Risks) |
| N4 | `update_scheduled_post` changed a queued public post with no confirmation, accepted unlisted fields, and allowed a time in the past | Fixed: it asks for a confirmation, refuses unlisted fields, and a changed time must be in the future. Tests in `backend/tests/mcp/scheduledPostTools.test.ts` |

### Hardening from the same run

- `/mcp` takes OAuth tokens only while `MCP_OAUTH_ENABLED` is `true`, and refuses a body over 1 MB with 413.
- A write tool is audited even when its result is too large to return.
- The GitHub Actions scheduler's Supabase errors no longer print request paths (account ids) or raw answers.
- Accepted for now: revoked access tokens stay in the table (only active ones count toward the limit of 20), and an access token does not re-check the Supabase account's status; deleting the account deletes its tokens.

Deferred by the run (quick profile, one wave): browser sign-in establishment beyond N2, and access token lifetime against account recovery or email change.
,## YouTube publishing and media review (#147, #146),,Claude Code `security-review` ran on the diff from `fix/audit-leads` to `feat/youtube-publishing` (media tools, the second audit's fixes, YouTube publishing). It found no vulnerability at confidence 8 or above. It checked cross-user access on every new repository method, the Google sign-in binding and state signature, token sealing and leakage, server-side requests from the runner and the media routes, the two new SQL functions and the new tables' browser access.,,It raised one lead below the bar, and it was fixed:,,| Id | Lead | Status |,|---|---|---|,| M1 | `POST /api/media` accepted any file on the instance's Cloudinary account and only checked that the address contained the id somewhere. A member who learned another member's file address could add it to their own library, then delete it from the shared account with `delete_media`, which uses the instance's API secret | Fixed: the address must be exactly the one Cloudinary gives the id (`backend/lib/cloudinaryAddress.ts`), and `media_assets.owns_file` records whether Twiligent created the file for this person. Only such a file is deleted from Cloudinary; a browser upload, or an import that landed on a file Cloudinary already had (`existing`), keeps its file and the tool says why. Tests: `backend/tests/lib/cloudinaryAddress.test.ts`, `backend/tests/services/mediaService.test.ts` |,