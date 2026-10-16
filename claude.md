# Twiligent - AI Operating Manual

## Project Identity

Twiligent is a self-hosted social media analytics and publishing dashboard for creators and teams managing multiple YouTube channels, Instagram accounts and Reddit profiles. It is a private deployment product - the owner runs their own instance with their own API credentials. There is no SaaS model, no multi-tenancy abstraction, and no billing system.

- Primary users: Small creator teams, agencies, individual power users
- Primary value: Unified analytics, scheduled Instagram publishing, and automatic private replies to Instagram comments across multiple accounts
- Current platforms: YouTube (analytics only), Instagram (analytics, publishing and comment-to-DM automation), Reddit (analytics only)
- Public site: https://twiligent.ujjwal.fyi is the project's own marketing site and documentation (the `site/` workspace); the app runs at https://app.twiligent.ujjwal.fyi. Self-hosters run only the app and the Worker; the site is not needed to run Twiligent
- GitHub repository: https://github.com/spacesdrive/twiligent
- Goals and priorities: `ROADMAP.md`

---

## Issue Tracking (Required for Every Task)

Every task is tracked by a GitHub issue, no matter how small: features, fixes, refactors, docs, dependency updates, deployments and repository chores. Read `docs/workflows/ISSUES.md` for the full workflow. The non-negotiable rules:

1. Before writing any code or docs, search the open issues (`gh issue list --state open --search "<keywords>"`). Reuse a matching issue, otherwise open one with `gh issue create`. A task with several parts gets a parent issue with one sub-issue per part.
2. Every commit references its issue: `Refs #N` in the body while the work continues, `Closes #N` in the commit or pull request that finishes it.
3. Tick the issue's task list as parts finish, and record decisions, blockers and scope changes as issue comments.
4. Close the issue as soon as the work is complete: committed and pushed, docs updated, and the checks in `docs/workflows/TESTING.md` passing. If a `Closes #N` commit did not close it on `main`, run `gh issue close N --comment "<what changed and how it was verified>"`.
5. Never close an issue for unfinished work. When a session ends mid-task, leave the issue open with a comment listing what is done and what remains.
6. When the user asks for several things at once, open one issue per request before starting the first, so nothing is lost.
7. Never put secrets, tokens, `.dev.vars` values or personal data in an issue; the repository is public.

---

## Repository Layout

The repo is an npm workspaces monorepo. Run every install and script from the root.

```
package.json          workspaces ["backend", "frontend", "site"], shared dev tooling, root scripts
package-lock.json     the only lockfile; one node_modules at the root
tsconfig.base.json    shared TypeScript settings (strict, erasable syntax only); each project extends it
eslint.config.mjs     shared ESLint config (typescript-eslint, frontend and site rules, backend Workers rules, Node rules for tests and site build files)
.prettierrc.json      shared Prettier config matching the existing style (not applied in bulk)
.editorconfig         editor defaults (4 spaces in backend, 2 elsewhere)
shared/types/         API contract types shared by backend and frontend (types only, no runtime code)
backend/              Hono Worker in layers: middleware/, routes/, controllers/, services/, repositories/,
                      validators/, database/, jobs/, lib/; app.ts builds the pipeline, container.ts wires services;
                      tests in backend/tests/ mirroring the source folders
frontend/             React SPA (the app); tests in frontend/tests/ mirroring frontend/src/
site/                 public marketing site and docs (Vite, React, MDX); docs pages in site/content/docs/,
                      build plugins in site/build/, tests in site/tests/
scripts/              publish-scheduled.ts, run by GitHub Actions with no dependencies; check-platform-packages.ts,
                      run after npm ci in every workflow
supabase/             the database schema: migrations/ (versioned SQL, one table, access, trigger, index or function per file, applied
                      with the Supabase CLI), rollbacks/ (the reverse of each migration, same file name),
                      config.toml (CLI config, Postgres 17)
```

- `npm install` at the root installs every workspace. Never run `npm install` inside `backend/`, `frontend/` or `site/`, and never commit a lockfile there.
- `npm run dev` starts the Worker (port 8787) and Vite (port 5173) together; `npm run dev:site` starts the public site on its own. `npm run typecheck`, `npm test`, `npm run lint` and `npm run build` cover the whole repo, the site included (`build` builds the app, then the site).
- `npm run db:new <name>` creates a migration, `npm run db:status` lists which are applied, `npm run db:check` shows what a push would apply and `npm run db:push` applies it (the Supabase CLI is a root dev dependency; link it once with `npx supabase link --project-ref <ref>`). CI never runs migrations.
- Add a dependency to the workspace that uses it: `npm install <pkg> --workspace backend`, `--workspace frontend` or `--workspace site`. Only shared dev tooling belongs in the root `package.json`.
- Tests never live next to source files. A test for `backend/services/accountService.ts` is `backend/tests/services/accountService.test.ts`; a test for `frontend/src/lib/accounts.ts` is `frontend/tests/lib/accounts.test.ts`; site tests live in `site/tests/`.

---

## Reading Order Before Any Change

Before implementing any feature or fix, read these documents in this exact order:

1. This file - project identity, rules, and documentation map
2. `docs/workflows/ISSUES.md` - open or find the GitHub issue for the task before anything else
3. `docs/WRITING_STANDARDS.md` - typography, icons, writing style, UI copy rules
4. `docs/architecture/OVERVIEW.md` - system topology and request flow
5. `docs/guidelines/TYPESCRIPT.md` - code standards and typing rules (always apply)
6. `docs/guidelines/CODE_STYLE.md` - how code reads here: layer shapes, comments, naming, messages, tests (always apply; its checklist runs before every commit)
7. Relevant architecture doc - backend, frontend, site, database, or cloudflare
8. Relevant feature guide - if one exists in `docs/features/`
9. Relevant engineering guideline - if the task touches a specific layer
10. `ROADMAP.md` - if the task is a planned item, link its issue there

For MCP usage, read `docs/mcp/OVERVIEW.md` before using any MCP server.

---

## Documentation Map

```
docs/
  WRITING_STANDARDS.md     Typography, icons, writing style, UI copy, commit messages
  design-reference.md      Measured interface reference, brand kit inventory, token sources
  brand-notes.md           What the public site takes from the brand kit: palette, type, logo, icons, voice
  architecture/
    OVERVIEW.md            System topology, connections, request lifecycle
    backend/
      REQUEST_PIPELINE.md  Middleware, route table, controller, service, repository; request context; error contract
      HONO.md              App structure, middleware, routing pattern
      ROUTES.md            All routes, method, auth requirement, purpose
      SERVICES.md          instagram.ts, youtube.ts service layer
      MIDDLEWARE.md        requireAuth, CORS, context injection
      CACHING.md           Redis strategy, cache keys, invalidation
      RATE_LIMITING.md     Rate limit rules, algorithms, Redis Lua scripts, fallbacks
      CRON.md              Scheduled handlers, cron triggers
    frontend/
      REACT_ARCHITECTURE.md    Provider tree, lazy loading, App.tsx
      DESIGN_SYSTEM.md         Tokens, shared components, page patterns
      ROUTING.md               All pages, paths, layout nesting
      CONTEXTS.md              AuthContext, AppContext, usage rules
      API_LAYER.md             api.ts, request(), auth header injection
      FEATURES.md              Feature module conventions, directory map
    site/
      SITE.md              Public site and docs: stack, folders, docs pipeline, theming, icons, deploy
    database/
      SCHEMA.md            All tables, columns, types, constraints
      SECURITY.md          Browser access (RLS, grants), service vs anon key, isolation
    cloudflare/
      WORKERS.md           Worker export, env binding, cron handler
      PAGES.md             App and site deployment, build step, env vars
      CI_CD.md             GitHub Actions workflows, path filters
    data-flows/
      AUTHENTICATION.md    Login, JWT lifecycle, session management
      PUBLISHING.md        Cloudinary to IG container to publish pipeline
      ANALYTICS.md         YouTube and Instagram analytics fetch and compute
      SCHEDULING.md        Scheduled post lifecycle, dual-scheduler design
      AUTOMATION.md        Comment webhook, keyword rules, reply queue, limits and failure handling
  guidelines/
    CODE_STYLE.md          How code reads: the shapes to copy per layer, comments, naming, messages, tests, pre-commit checklist
    TYPESCRIPT.md          Compiler settings, typing rules, where types live, code style, comments policy
    REACT.md               Component rules, hooks, JSX conventions
    HONO.md                Route handlers, middleware, context usage
    CLOUDFLARE_WORKERS.md  Worker-safe patterns, env access, no Node APIs
    SUPABASE.md            Client usage, query patterns, service vs anon
    SHADCN.md              Component usage, composition rules, imports
    TAILWIND.md            Utility usage, token references, responsive
    NAMING.md              File names, function names, variable names
    ERROR_HANDLING.md      Error boundaries, API errors, logging
    STATE_MANAGEMENT.md    Context vs local state, when to lift
    API_CONVENTIONS.md     Response shapes, error shapes, status codes
  mcp/
    OVERVIEW.md            When to use each MCP, decision tree
    CONTEXT7.md            Library docs, API reference lookups
    FILESYSTEM.md          File search, symbol location, refactoring
    SEQUENTIAL_THINKING.md Complex planning, architecture decisions
    PARALLEL_SEARCH.md     UX research, best practices, browser compat
  workflows/
    ISSUES.md              GitHub issue lifecycle: open before work, reference in commits, close on completion
    FEATURE_DEVELOPMENT.md Feature sequence from opening the issue to closing it
    TESTING.md             Test types, commands, pass criteria
    GIT.md                 Commit format, branch rules, changelog
    DEPLOYMENT.md          Backend deploy, frontend deploy, verification
    SCHEDULING_SETUP.md    Five-step GitHub Actions scheduling setup for self-hosters
  features/
    NEW_ANALYTICS_PAGE.md  Add analytics view for a new platform
    NEW_API_ENDPOINT.md    Add a route to the Hono backend
    NEW_REACT_PAGE.md      Add a page to the React SPA
    NEW_SCHEDULED_TASK.md  Add a new cron handler to the Worker
    NEW_DATABASE_TABLE.md  Add a Supabase table with migrations
    NEW_INTEGRATION.md     Add a third-party platform (API + OAuth)
  philosophy/
    ARCHITECTURE.md        Architectural principles and constraints
    SECURITY.md            Security model, key handling, isolation
    PERFORMANCE.md         Caching strategy, edge optimization

site/content/docs/ Public user and self-hosting docs (MDX) served at twiligent.ujjwal.fyi/docs
DECISIONS.md       Architectural decision log
THIRD_PARTY_NOTICES.md  Credit for work by others that the project includes (the Solar icons)
CHANGELOG.md       Version history and feature changes
ROADMAP.md         Planned features and priorities
```

---

## Writing and Design Standards

Read `docs/WRITING_STANDARDS.md` for the full specification. The non-negotiable rules:

- Never use emojis, em dashes (--), or emoticons anywhere in the project
- Never use emoji as icons in UI - use Lucide React SVG icons in the app, and the Solar icons generated into `site/src/components/icons.tsx` on the public site
- Write clear, professional English with no marketing buzzwords or filler text
- UI copy names things from the user's perspective, not the system's internals
- Error messages explain what went wrong and what to do - no "Something went wrong"
- One comment per non-obvious logic block, maximum - never restate what the code does
- Every page must feel like it belongs to the same application: consistent padding, cards, skeletons, toasts, icons
- All styling goes through the design tokens in `frontend/src/index.css` and the shared components listed in `docs/architecture/frontend/DESIGN_SYSTEM.md`; no hex or Tailwind palette colours in components
- Brand assets (logos, fonts, tokens, guidelines) live in `frontend/public/` (the public site keeps copies in `site/public/brand/` and `site/public/fonts/`, and `docs/brand-notes.md` records what it takes from the kit); sentence case in UI copy, no exclamation marks

---

## Engineering Standards

Act like a senior engineer shipping a production application.

Every implementation must be:

- Scalable - does not assume small data sets or single users
- Maintainable - follows established patterns so the next engineer can extend it
- Documented - routes, schema changes, env vars, and data flows are reflected in docs
- Optimized - no unnecessary re-renders, no N+1 queries, no uncached hot paths
- Production-ready - proper error handling at every boundary, no console.log left in

Never implement the quickest solution when a significantly better architecture exists. Always optimize for long-term maintainability over short-term speed.

---

## Code Style

Read `docs/guidelines/CODE_STYLE.md` before writing code and run its checklist before every commit. The non-negotiable rules:

- Match the nearest existing file of the same kind before inventing a shape: open a sibling and copy its imports, exports, naming and comment density
- One job per file and per layer: route tables map, controllers translate HTTP, services decide, repositories query, components render, `lib/` helpers compute; services are `createXService(deps)` factories with an `XService` and an `XDeps` interface
- Comments explain why in one lowercase line above the code; never restate the code, reference a task, or write JSDoc or multi-line blocks; a constant with a number in it gets its reason
- Backend failures are typed errors from `lib/errors.ts` with a message a person can act on; frontend failures are toasts that start with what failed (`Couldn't save the password.`) and add the reason; success toasts confirm in past tense (`Password saved`)
- Formatting follows the file: 4 spaces in `backend/`, 2 elsewhere, single quotes, semicolons, trailing commas
- Pure logic goes in a plain `.ts` helper (`lib/`) so Node can test it; markup used twice becomes a component; copy that changes by mode lives in a typed table
- `scripts/` stays free of npm packages but may import a `backend/lib/` helper that imports nothing at runtime, so both schedulers share one set of rules (`scheduledPublishing.ts`)
- The schema changes only through a migration in `supabase/migrations/` plus its rollback in `supabase/rollbacks/`; repositories update `data` through the merge functions, never by reading it and writing it back
- Every migration and its rollback is as small as possible, one database entity per file: a table (with its columns, keys and checks), its browser access, one trigger, one index or one function. A new table is at least four migrations (the table, its access, its `updated_at` trigger, each index). Split any large query into one file per entity before it is applied; never edit a migration production already recorded. `backend/tests/database/migrations.test.ts` enforces it
- New row ids come from `newRowId()` in `backend/lib/ids.ts` (`crypto.randomUUID()`)
- Tests use `node:test` with sentence names that describe behaviour, live in `tests/` mirroring the source path, and use the smallest typed fake
- When the code and `CODE_STYLE.md` disagree, update the guide in the same change

---

## MCP Usage Rules

### Context7 - Library and API documentation

Use Context7 before implementing anything that involves an external library or API:

- React, Vite, Tailwind, React Router - even for well-known APIs
- Cloudflare Workers, Hono, Supabase, Upstash Redis
- Lucide React, shadcn/ui components
- Browser APIs, modern JavaScript features
- Any third-party package

Do not rely on training knowledge for library APIs. Training data goes stale. Prefer the latest stable API from Context7.

Workflow: `resolve-library-id` first, then `query-docs` with the full question.

### Parallel Search - Research and best practices

Use Parallel Search whenever:

- Researching libraries or comparing implementations
- Checking best practices for a UI pattern, algorithm, or architecture
- Researching browser API behavior or compatibility
- Finding performance optimizations
- Checking accessibility requirements
- Comparing npm packages before recommending one

Search multiple reliable sources before deciding. Never rely on a single article. Summarize findings and implement the best-supported solution.

### Sequential Thinking - Complex planning

Use Sequential Thinking before implementing any large feature:

- Break the problem into ordered steps
- Identify dependencies between steps
- Identify reusable abstractions
- Identify edge cases before they become bugs
- Identify future scalability concerns

Think before coding. Sequential Thinking reduces rewrites.

### Filesystem MCP - File operations within the project

Use Filesystem MCP when searching, reading, or modifying the project:

- Prefer editing existing files over recreating them
- Maintain clean folder structure - no duplicate utilities or components
- Refactor when appropriate rather than adding parallel implementations

### shadcn MCP - Component lookup

Use shadcn MCP for any UI component need:

- Dialogs, forms, cards, buttons, tables, navigation, sheets, dropdowns, popovers
- Check the registry for an official component before building a custom one
- Prefer official shadcn composition patterns over custom implementations

---

## Pre-Feature Research Protocol

Before adding any new feature:

1. Research best practices for the feature type using Parallel Search
2. Research any relevant browser APIs using Parallel Search
3. Research existing UX patterns for this type of feature using Parallel Search
4. Fetch current library documentation using Context7 for any library involved
5. Run Sequential Thinking to plan the implementation before writing code

This is not optional for features that touch new UI patterns, new APIs, or new integrations.

---

## AI Operating Rules

**Open the issue first.** No task starts without a GitHub issue, and no task is reported as done while its issue is still open. See Issue Tracking above and `docs/workflows/ISSUES.md`.

**Always read before writing.** Read every file you will modify. Read all files in the same directory that might be affected. Read sibling files to understand conventions before adding new ones.

**Match the existing pattern.** This project has established conventions for route tables, controllers, services, repositories, validators, context hooks and api.ts methods. Find the nearest existing example and follow it exactly before introducing anything new.

**TypeScript only, in strict mode.** The whole project - Worker, React app, shared types, scripts and tests - is TypeScript (`.ts`, and `.tsx` for files with JSX). Never add a `.js` or `.jsx` source file, never use `any`, `@ts-ignore` or `@ts-expect-error`, and only use syntax Node can strip (no enums, namespaces or parameter properties; `import type` for types; relative imports keep their `.ts` extension). Types the API sends or receives live in `shared/types/`; change them there first. `npm run typecheck` must pass before every commit. See `docs/guidelines/TYPESCRIPT.md`.

**No dependencies without explicit approval.** The backend uses zero npm dependencies at runtime beyond `hono`, `@supabase/supabase-js`, and `@upstash/redis`. Adding packages to the Cloudflare Worker increases bundle size and startup time. The `scripts/publish-scheduled.ts` file uses zero npm dependencies by design.

**Security invariants - never violate these:**
- `SUPABASE_SERVICE_KEY` is only ever used server-side (backend Worker)
- `SUPABASE_ANON_KEY` on the backend is only for JWT verification
- Instagram `accessToken` is always stripped by `safeAccount()` before any response
- All user-scoped queries always append `.eq('user_id', userId)` where `userId` comes from a verified JWT, never from user input; only repository methods named `...ForUser` serve requests, and the unscoped ones are for cron jobs
- `backend/.dev.vars` must never be committed
- Public webhooks (`/api/auth/email-hook`, `/api/webhooks/instagram`) act only after their signature is verified, and a private reply whose outcome is unknown is never sent again without a person's decision

**Keep each layer to its job.** Read `docs/architecture/backend/REQUEST_PIPELINE.md`. Middleware handles cross-cutting work in the order set in `backend/app.ts`. A route table only maps a path to middleware and a controller. A controller reads validated input (`backend/validators/`) and the user id, calls one service method and builds the response; it never queries the database or catches errors to format them. A service holds the rules, receives repositories and a `RequestContext`, never imports `hono`, and throws the typed errors in `lib/errors.ts`. Every Supabase query and every cache read or write lives in a repository in `backend/repositories/`, one method per query.

**Use the established api.ts pattern.** All frontend-to-backend calls go through `frontend/src/services/api.ts`. Never call `fetch()` directly in components. Add new endpoints to the `api` object in `api.ts`.

**Redis failures are always silent.** `repositories/analyticsCacheRepository.ts` wraps every Redis operation in try/catch. Cache misses must fall back to live API calls. The app must work with Redis completely absent.

**Documentation is part of implementation.** When any of the following change - routes, DB schema, environment variables, deployment config, cron jobs, data flows, component conventions - update the relevant docs immediately using the table below.

---

## Git and Commit Standards

- Repository: https://github.com/spacesdrive/twiligent
- Author name: spacesdrive
- Author email: valzorx7@gmail.com
- Read `docs/workflows/GIT.md` for the full commit format
- `main` is protected by the ruleset **Protect main**: no direct pushes, force pushes or deletion; every change lands through a pull request whose CI check `Type check, lint, test, build` passed, merged with rebase (linear history). Merging deploys both apps

Commit after every meaningful change. Do not batch unrelated changes into one commit. Use Conventional Commits format:

```
type(scope): short imperative description

Optional body explaining why, not what.

Refs #12
```

Every commit body ends with the issue reference: `Refs #N` for partial work, `Closes #N` for the commit that completes the issue. Pull requests list `Closes #N` for every issue they finish.

Tag releases after changes or patches:
- Bug fixes: patch version (v1.0.1, v1.0.2)
- New features: minor version (v1.1.0)
- Breaking changes: major version (v2.0.0)

Every tag gets a GitHub Release page with short notes that explain the release in plain words and say what an instance owner must do; the format is in `docs/workflows/GIT.md` (Release notes).

Do not add "Co-Authored-By: Claude" lines to commit messages. Commits should show only the project author.

---

## Documentation Maintenance Policy

When anything changes, update every relevant docs file from the table below. The rule is: if a file documents something that changed, update it.

| What changed | Files to update |
|---|---|
| Any task started | GitHub issue opened (or an existing one reused) before the first edit; see `docs/workflows/ISSUES.md` |
| Any task finished | GitHub issue closed with a summary of what changed and how it was verified; task list ticked; parent issue closed after its last sub-issue |
| Roadmap item started or finished | `ROADMAP.md` (link the issue when work starts; remove the entry and add it to `CHANGELOG.md` when the issue closes) |
| Project goals or priorities changed | `ROADMAP.md` (Goals section), this file (Project Identity section) |
| Issue workflow, labels or templates changed | `docs/workflows/ISSUES.md`, `.github/ISSUE_TEMPLATE/`, `.github/pull_request_template.md`, this file (Issue Tracking section) |
| New route added | `docs/architecture/backend/ROUTES.md`, `docs/architecture/OVERVIEW.md`, `docs/workflows/TESTING.md` (add to manual verification checklist); a route test in `backend/tests/routes/` |
| Request pipeline, middleware order, request context or error contract changed | `docs/architecture/backend/REQUEST_PIPELINE.md`, `docs/architecture/backend/MIDDLEWARE.md`, `docs/guidelines/ERROR_HANDLING.md`, `docs/guidelines/API_CONVENTIONS.md`, `shared/types/domain.ts` (`ApiFailure`) |
| New repository or repository method | `docs/architecture/backend/REQUEST_PIPELINE.md` (if a new repository), `docs/architecture/database/SECURITY.md` (if it is not user-scoped) |
| Route deleted or changed | `docs/architecture/backend/ROUTES.md`, `docs/architecture/OVERVIEW.md` |
| New DB table | A migration and its rollback in `supabase/` (`docs/features/NEW_DATABASE_TABLE.md`), `docs/architecture/database/SCHEMA.md`, `docs/architecture/database/SECURITY.md`, `DECISIONS.md`, `CHANGELOG.md` |
| New DB column | A migration and its rollback in `supabase/`, `docs/architecture/database/SCHEMA.md` |
| Schema, constraint, index, trigger or function changed | A migration and its rollback in `supabase/`, `docs/architecture/database/SCHEMA.md`, `docs/architecture/database/SECURITY.md` (if access changes) |
| New env var / Worker secret | `docs/architecture/cloudflare/WORKERS.md`, `docs/architecture/cloudflare/CI_CD.md`, `docs/workflows/DEPLOYMENT.md`, `DECISIONS.md` |
| Env var removed | `docs/architecture/cloudflare/WORKERS.md`, `docs/architecture/cloudflare/CI_CD.md`, `docs/workflows/DEPLOYMENT.md` |
| New npm package (backend) | `docs/architecture/backend/HONO.md`, `DECISIONS.md` |
| New npm package (frontend) | `docs/architecture/frontend/REACT_ARCHITECTURE.md`, `DECISIONS.md` |
| New npm package (root dev tooling) | `docs/workflows/TESTING.md` or the guideline it serves, `DECISIONS.md`, `README.md` |
| Workspaces, root `package.json` scripts or the root lockfile changed | `README.md`, `docs/workflows/DEPLOYMENT.md`, `docs/workflows/FEATURE_DEVELOPMENT.md`, `docs/architecture/cloudflare/CI_CD.md`, this file (Repository Layout section) |
| Shared tooling config changed (`eslint.config.mjs`, `tsconfig*.json`, `.prettierrc.json`, `.editorconfig`) | `docs/guidelines/TYPESCRIPT.md`, `docs/workflows/TESTING.md`, this file (Repository Layout section) |
| API request or response shape changed | `shared/types/*.ts` first (the type checker then lists every caller), `docs/architecture/backend/ROUTES.md`, `docs/architecture/frontend/API_LAYER.md` |
| New frontend feature module | `docs/architecture/frontend/FEATURES.md`, `docs/architecture/frontend/ROUTING.md`, `docs/architecture/OVERVIEW.md` |
| New data flow | `docs/architecture/data-flows/` (add or update relevant file), `docs/architecture/OVERVIEW.md` |
| New cron trigger | `docs/architecture/cloudflare/WORKERS.md`, `docs/architecture/backend/CRON.md`, `docs/architecture/cloudflare/CI_CD.md` |
| New GitHub Actions workflow | `docs/architecture/cloudflare/CI_CD.md`, `docs/workflows/DEPLOYMENT.md` |
| Branch protection ruleset or the CI job name changed | The ruleset **Protect main** (Settings, Rules, Rulesets), `docs/workflows/GIT.md` (Branch Strategy), `docs/architecture/cloudflare/CI_CD.md`, this file (Git and Commit Standards section) |
| Existing GitHub Actions workflow changed (steps, triggers, Node version) | `docs/architecture/cloudflare/CI_CD.md`, `docs/workflows/DEPLOYMENT.md`, `docs/architecture/cloudflare/PAGES.md` or `WORKERS.md` for the deploy it runs |
| Test added, moved or test command changed | `docs/workflows/TESTING.md` (layout, commands, coverage list) |
| New backend service file | `docs/architecture/backend/SERVICES.md`, `backend/container.ts` |
| New cache key | `docs/architecture/backend/CACHING.md` |
| Rate limit rule, limit or covered route changed | `docs/architecture/backend/RATE_LIMITING.md` (rules table), `backend/tests/middleware/rateLimit.test.ts` (route matchers) |
| Rate limit algorithm or Lua script changed | Both `backend/lib/rateLimit/algorithms.ts` and `scripts.ts` together, `docs/architecture/backend/RATE_LIMITING.md`, `DECISIONS.md` |
| New middleware | `docs/architecture/backend/MIDDLEWARE.md`, `docs/architecture/backend/HONO.md` |
| Auth flow changed | `docs/architecture/data-flows/AUTHENTICATION.md` |
| Publishing flow changed | `docs/architecture/data-flows/PUBLISHING.md` |
| Scheduling flow changed | `docs/architecture/data-flows/SCHEDULING.md` |
| Analytics computation changed | `docs/architecture/data-flows/ANALYTICS.md` |
| New React context or hook | `docs/architecture/frontend/CONTEXTS.md` |
| api.ts changed | `docs/architecture/frontend/API_LAYER.md` |
| App.tsx routing changed | `docs/architecture/frontend/ROUTING.md` |
| Frontend deployment config changed | `docs/architecture/cloudflare/PAGES.md` |
| Site deployment config changed (`deploy-site.yml`, `site/public/_redirects`, the `twiligent-site` project) | `docs/architecture/cloudflare/PAGES.md`, `docs/architecture/cloudflare/CI_CD.md`, `docs/workflows/DEPLOYMENT.md`, `docs/architecture/site/SITE.md` |
| Site structure, build plugins, routes or theming changed | `docs/architecture/site/SITE.md`, `docs/brand-notes.md` (if a brand rule changes) |
| New npm package (site) | `docs/architecture/site/SITE.md`, `DECISIONS.md` |
| Docs page added, moved or renamed | The `.mdx` file in `site/content/docs/` (starting with `export const meta = { title, description }`), its entry in `site/src/docs/nav.ts`, any `docsUrl()` links in the app, and a 301 line in `site/public/_redirects` for a moved or renamed page |
| Site icon added | The `ICONS` list in `site/build/genIcons.ts`, then `npm run icons --workspace site` to regenerate `site/src/components/icons.tsx` (never edit that file by hand) |
| Third-party work with an attribution licence added (icons, fonts, images) | `THIRD_PARTY_NOTICES.md` (author, source, licence link, changes made) |
| Architecture decision made | `DECISIONS.md` (append only, never delete) |
| Any feature shipped | `CHANGELOG.md` (append to Unreleased section) |
| Release tagged | `CHANGELOG.md` (convert Unreleased to version number with date), a GitHub Release page for the tag (`docs/workflows/GIT.md`, Release notes) |
| Any planned feature added or changed | `ROADMAP.md` |
| Writing or design rule changed | `docs/WRITING_STANDARDS.md`, this file (Writing and Design Standards section) |
| Code style or a layer's shape changed (a new pattern to copy, a naming, comment or message rule) | `docs/guidelines/CODE_STYLE.md`, the guideline it details (`TYPESCRIPT.md`, `REACT.md`, `HONO.md`, `NAMING.md`), this file (Code Style section) |
| MCP usage rule changed | `docs/mcp/OVERVIEW.md`, this file (MCP Usage Rules section) |
| Engineering standard changed | `docs/philosophy/ARCHITECTURE.md`, this file (Engineering Standards section) |
| Security model changed | `docs/philosophy/SECURITY.md`, `docs/architecture/database/SECURITY.md` |
| Caching strategy changed | `docs/philosophy/PERFORMANCE.md`, `docs/architecture/backend/CACHING.md` |
| New integration (platform) | `docs/architecture/backend/SERVICES.md`, `docs/architecture/backend/ROUTES.md`, `docs/architecture/backend/CACHING.md`, `docs/architecture/frontend/FEATURES.md`, `docs/architecture/frontend/ROUTING.md`, `DECISIONS.md`, `CHANGELOG.md` |
| Feature guide added or changed | `docs/features/` (relevant file) |
| Workflow changed | `docs/workflows/` (relevant file) |
| Guideline changed | `docs/guidelines/` (relevant file) |
| Philosophy changed | `docs/philosophy/` (relevant file) |
| Project setup, features, or deployment instructions change | `README.md`, and the self-hosting pages in `site/content/docs/self-host/` |
