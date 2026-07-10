# Twiligent - AI Operating Manual

## Project Identity

Twiligent is a self-hosted social media analytics and publishing dashboard for creators and teams managing multiple YouTube channels and Instagram accounts. It is a private deployment product - the owner runs their own instance with their own API credentials. There is no SaaS model, no multi-tenancy abstraction, and no billing system.

- Primary users: Small creator teams, agencies, individual power users
- Primary value: Unified analytics and scheduled Instagram publishing across multiple accounts
- Current platforms: YouTube (analytics only), Instagram (analytics and publishing)
- GitHub repository: https://github.com/spacesdrive/twiligent

---

## Reading Order Before Any Change

Before implementing any feature or fix, read these documents in this exact order:

1. This file - project identity, rules, and documentation map
2. `docs/WRITING_STANDARDS.md` - typography, icons, writing style, UI copy rules
3. `docs/architecture/OVERVIEW.md` - system topology and request flow
4. `docs/guidelines/JAVASCRIPT.md` - code standards (always apply)
5. Relevant architecture doc - backend, frontend, database, or cloudflare
6. Relevant feature guide - if one exists in `docs/features/`
7. Relevant engineering guideline - if the task touches a specific layer

For MCP usage, read `docs/mcp/OVERVIEW.md` before using any MCP server.

---

## Documentation Map

```
docs/
  WRITING_STANDARDS.md     Typography, icons, writing style, UI copy, commit messages
  architecture/
    OVERVIEW.md            System topology, connections, request lifecycle
    backend/
      HONO.md              App structure, middleware, routing pattern
      ROUTES.md            All routes, method, auth requirement, purpose
      SERVICES.md          instagram.js, youtube.js service layer
      MIDDLEWARE.md        requireAuth, CORS, context injection
      CACHING.md           Redis strategy, cache keys, invalidation
      CRON.md              Scheduled handlers, cron triggers
    frontend/
      REACT_ARCHITECTURE.md    Provider tree, lazy loading, App.jsx
      ROUTING.md               All pages, paths, layout nesting
      CONTEXTS.md              AuthContext, AppContext, usage rules
      API_LAYER.md             api.js, request(), auth header injection
      FEATURES.md              Feature module conventions, directory map
    database/
      SCHEMA.md            All tables, columns, types, constraints
      SECURITY.md          RLS policy, service vs anon key, isolation
    cloudflare/
      WORKERS.md           Worker export, env binding, cron handler
      PAGES.md             Frontend deployment, build step, env vars
      CI_CD.md             GitHub Actions workflows, path filters
    data-flows/
      AUTHENTICATION.md    Login, JWT lifecycle, session management
      PUBLISHING.md        Cloudinary to IG container to publish pipeline
      ANALYTICS.md         YouTube and Instagram analytics fetch and compute
      SCHEDULING.md        Scheduled post lifecycle, dual-scheduler design
  guidelines/
    JAVASCRIPT.md          Code style, modules, naming, comments policy
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
    FEATURE_DEVELOPMENT.md 25-step feature implementation sequence
    TESTING.md             Test types, commands, pass criteria
    GIT.md                 Commit format, branch rules, changelog
    DEPLOYMENT.md          Backend deploy, frontend deploy, verification
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

DECISIONS.md       Architectural decision log
CHANGELOG.md       Version history and feature changes
ROADMAP.md         Planned features and priorities
```

---

## Writing and Design Standards

Read `docs/WRITING_STANDARDS.md` for the full specification. The non-negotiable rules:

- Never use emojis, em dashes (--), or emoticons anywhere in the project
- Never use emoji as icons in UI - use Lucide React SVG icons
- Write clear, professional English with no marketing buzzwords or filler text
- UI copy names things from the user's perspective, not the system's internals
- Error messages explain what went wrong and what to do - no "Something went wrong"
- One comment per non-obvious logic block, maximum - never restate what the code does
- Every page must feel like it belongs to the same application: consistent padding, cards, skeletons, toasts, icons

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

**Always read before writing.** Read every file you will modify. Read all files in the same directory that might be affected. Read sibling files to understand conventions before adding new ones.

**Match the existing pattern.** This project has established conventions for routes, context hooks, db.js queries, cache.js patterns, and api.js methods. Find the nearest existing example and follow it exactly before introducing anything new.

**No TypeScript.** The entire project - backend and frontend - is JavaScript/JSX. Do not suggest or introduce TypeScript unless explicitly asked.

**No dependencies without explicit approval.** The backend uses zero npm dependencies at runtime beyond `hono`, `@supabase/supabase-js`, and `@upstash/redis`. Adding packages to the Cloudflare Worker increases bundle size and startup time. The `scripts/publish-scheduled.js` file uses zero npm dependencies by design.

**Security invariants - never violate these:**
- `SUPABASE_SERVICE_KEY` is only ever used server-side (backend Worker)
- `SUPABASE_ANON_KEY` on the backend is only for JWT verification
- Instagram `accessToken` is always stripped by `safeAccount()` before any response
- All user-scoped queries always append `.eq('user_id', userId)` where `userId` comes from a verified JWT, never from user input
- `backend/.dev.vars` must never be committed

**Use the established db.js pattern.** All database operations go through `lib/db.js`. Never write inline Supabase queries in route handlers. Add new operations to `db.js` and import them.

**Use the established api.js pattern.** All frontend-to-backend calls go through `frontend/src/services/api.js`. Never call `fetch()` directly in components. Add new endpoints to the `api` object in `api.js`.

**Redis failures are always silent.** Wrap all Redis operations in try/catch. Cache misses must fall back to live API calls. The app must work with Redis completely absent.

**Documentation is part of implementation.** When any of the following change - routes, DB schema, environment variables, deployment config, cron jobs, data flows, component conventions - update the relevant docs immediately using the table below.

---

## Git and Commit Standards

- Repository: https://github.com/spacesdrive/twiligent
- Author name: spacesdrive
- Author email: valzorx7@gmail.com
- Read `docs/workflows/GIT.md` for the full commit format

Commit after every meaningful change. Do not batch unrelated changes into one commit. Use Conventional Commits format:

```
type(scope): short imperative description

Optional body explaining why, not what.
```

Tag releases after changes or patches:
- Bug fixes: patch version (v1.0.1, v1.0.2)
- New features: minor version (v1.1.0)
- Breaking changes: major version (v2.0.0)

Do not add "Co-Authored-By: Claude" lines to commit messages. Commits should show only the project author.

---

## Documentation Maintenance Policy

When anything changes, update every relevant docs file from the table below. The rule is: if a file documents something that changed, update it.

| What changed | Files to update |
|---|---|
| New route added | `docs/architecture/backend/ROUTES.md`, `docs/architecture/OVERVIEW.md`, `docs/workflows/TESTING.md` (add to manual verification checklist) |
| Route deleted or changed | `docs/architecture/backend/ROUTES.md`, `docs/architecture/OVERVIEW.md` |
| New DB table | `docs/architecture/database/SCHEMA.md`, `docs/architecture/database/SECURITY.md`, `DECISIONS.md`, `CHANGELOG.md` |
| New DB column | `docs/architecture/database/SCHEMA.md` |
| New env var / Worker secret | `docs/architecture/cloudflare/WORKERS.md`, `docs/architecture/cloudflare/CI_CD.md`, `docs/workflows/DEPLOYMENT.md`, `DECISIONS.md` |
| Env var removed | `docs/architecture/cloudflare/WORKERS.md`, `docs/architecture/cloudflare/CI_CD.md`, `docs/workflows/DEPLOYMENT.md` |
| New npm package (backend) | `docs/architecture/backend/HONO.md`, `DECISIONS.md` |
| New npm package (frontend) | `docs/architecture/frontend/REACT_ARCHITECTURE.md`, `DECISIONS.md` |
| New frontend feature module | `docs/architecture/frontend/FEATURES.md`, `docs/architecture/frontend/ROUTING.md`, `docs/architecture/OVERVIEW.md` |
| New data flow | `docs/architecture/data-flows/` (add or update relevant file), `docs/architecture/OVERVIEW.md` |
| New cron trigger | `docs/architecture/cloudflare/WORKERS.md`, `docs/architecture/backend/CRON.md`, `docs/architecture/cloudflare/CI_CD.md` |
| New GitHub Actions workflow | `docs/architecture/cloudflare/CI_CD.md`, `docs/workflows/DEPLOYMENT.md` |
| New backend service file | `docs/architecture/backend/SERVICES.md` |
| New cache key | `docs/architecture/backend/CACHING.md` |
| New middleware | `docs/architecture/backend/MIDDLEWARE.md`, `docs/architecture/backend/HONO.md` |
| Auth flow changed | `docs/architecture/data-flows/AUTHENTICATION.md` |
| Publishing flow changed | `docs/architecture/data-flows/PUBLISHING.md` |
| Scheduling flow changed | `docs/architecture/data-flows/SCHEDULING.md` |
| Analytics computation changed | `docs/architecture/data-flows/ANALYTICS.md` |
| New React context or hook | `docs/architecture/frontend/CONTEXTS.md` |
| api.js changed | `docs/architecture/frontend/API_LAYER.md` |
| App.jsx routing changed | `docs/architecture/frontend/ROUTING.md` |
| Frontend deployment config changed | `docs/architecture/cloudflare/PAGES.md` |
| Architecture decision made | `DECISIONS.md` (append only, never delete) |
| Any feature shipped | `CHANGELOG.md` (append to Unreleased section) |
| Release tagged | `CHANGELOG.md` (convert Unreleased to version number with date) |
| Any planned feature added or changed | `ROADMAP.md` |
| Writing or design rule changed | `docs/WRITING_STANDARDS.md`, this file (Writing and Design Standards section) |
| MCP usage rule changed | `docs/mcp/OVERVIEW.md`, this file (MCP Usage Rules section) |
| Engineering standard changed | `docs/philosophy/ARCHITECTURE.md`, this file (Engineering Standards section) |
| Security model changed | `docs/philosophy/SECURITY.md`, `docs/architecture/database/SECURITY.md` |
| Caching strategy changed | `docs/philosophy/PERFORMANCE.md`, `docs/architecture/backend/CACHING.md` |
| New integration (platform) | `docs/architecture/backend/SERVICES.md`, `docs/architecture/backend/ROUTES.md`, `docs/architecture/backend/CACHING.md`, `docs/architecture/frontend/FEATURES.md`, `docs/architecture/frontend/ROUTING.md`, `DECISIONS.md`, `CHANGELOG.md` |
| Feature guide added or changed | `docs/features/` (relevant file) |
| Workflow changed | `docs/workflows/` (relevant file) |
| Guideline changed | `docs/guidelines/` (relevant file) |
| Philosophy changed | `docs/philosophy/` (relevant file) |
| Project setup, features, or deployment instructions change | `README.md` |
