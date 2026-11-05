# Security audit

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
| F2 | Low (likelihood medium, impact low) | **The manual publish trigger ran every user's due posts.** `GET` and `POST /api/process-scheduled` started the all-user publisher, so any signed-in user could settle other users' posts, spend their attempts, and read their failed post ids and error reasons. | Fixed: commit "limit the manual publish trigger to the caller's posts". The trigger now lists only the caller's due and stale posts; the cron and the GitHub Actions publisher still serve everyone. Regression test: `backend/tests/routes/scheduledPostRoutes.test.ts` ("runs only the caller's own due posts") |

Rejected by the verifiers: "deploy secrets are reachable from any branch". Running a deploy already needs write access to the repository, so no lower-trust person gains anything.

---

## Leads that need validation

Each depends on a fact outside the repository or on running code. None is a confirmed vulnerability; several were mitigated anyway because the fix is cheap.

| Id | Lead | Status |
|---|---|---|
| L1 | With "Confirm email" off, as the self-hosting guide advises, anyone can create a password account for someone else's address, and may keep access after the real owner signs in with a code or Google | Open, owner action. Depends on Supabase Auth's identity linking. Recorded in `docs/philosophy/SECURITY.md` (Known Risks) with the mitigation: turn on email confirmation once the email hook is set up, or turn off open sign-up |
| L2 | Comments on an Instagram account connected by two Twiligent users are routed to whichever user's rule wins, without checking that the account's token still works | Open. Only reachable when two users connected the same Instagram account with valid tokens. Planned: route only to accounts whose last token check passed, and limit sends per Instagram identity |
| L3 | The GitHub Actions publisher printed Instagram's error text unredacted, and the setup guide recommends a public fork whose run logs anyone can read | Fixed: commit "redact Instagram errors in the GitHub Actions publisher log". Errors go through the Worker's `redactSecrets`, the account id is no longer printed, and the guide and the app say what the logs contain |
| L4 | `HEAD /api/process-scheduled` skipped the quota rule because the matcher compared the raw method | Fixed: commit "count HEAD requests against the same rate limit rule as GET"; test in `rateLimit.test.ts` |
| L5 | A user-triggered publisher run under the 30 second request deadline could leave other users' posts claimed and spend their attempts | Mitigated by F2: the trigger now only touches the caller's own posts |
| L6 | The instance's shared YouTube API quota is counted per request, not per unit | Open, accepted for now: the quota rule caps quota-spending routes at 30 per 10 minutes per user. The YouTube publishing work adds a quota ledger per Pacific day (`ARCHITECTURE.md`, section 3) |
| L7 | The daily token refresh retries dead Instagram tokens with no subrequest budget and can starve the 90 day retention purge | Open. Planned: give the refresh its own subrequest budget and skip tokens marked as needing a reconnect |
| L8 | One user's many due posts can use the shared publisher's subrequests and delay others' posts | Open. Planned with the YouTube job runner: a per-user cap per run |
| L9 | One user's subrequest overrun can open the circuit breakers all users share | Open. Planned: do not count the Workers subrequest limit as a platform outage |

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
- Open leads L1, L2, L6 to L9 are listed in `docs/philosophy/SECURITY.md` (Known Risks) with what would remove them.
