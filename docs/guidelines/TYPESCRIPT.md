# TypeScript Standards

The whole project is TypeScript in `strict` mode: the Worker (`backend/`), the React app (`frontend/`), the shared API types (`shared/types/`), the scheduled publisher (`scripts/`) and every test. These rules apply everywhere.

Nothing compiles TypeScript to JavaScript ahead of time. Wrangler and Vite strip the types while bundling, and Node strips them when it runs the tests and the publisher script. Type checking is a separate step, `npm run typecheck`, which CI runs before every deploy.

## Compiler Settings

Shared settings live in `tsconfig.base.json` at the root; each project extends it.

| File | Checks | Notable settings |
|---|---|---|
| `tsconfig.base.json` | (base only) | `strict`, `noEmit`, `moduleResolution: bundler`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `allowImportingTsExtensions`, `isolatedModules` |
| `backend/tsconfig.json` | Worker source | `types: ["@cloudflare/workers-types"]`, no DOM, no Node |
| `backend/tests/tsconfig.json` | Backend tests and the source they import | adds `node` types |
| `frontend/tsconfig.json` | `frontend/src` | DOM lib, `jsx: react-jsx`, `vite/client` types, `@/*` and `@shared/*` paths |
| `frontend/tsconfig.node.json` | `vite.config.ts`, `frontend/tests` | `node` types, DOM lib |
| `scripts/tsconfig.json` | `scripts/` | `node` types |

`npm run typecheck` at the root runs all of them. The project uses TypeScript 6.0: TypeScript 7 (the native compiler) is not yet supported by `typescript-eslint`.

## Syntax That Can Be Stripped

Because Node runs `.ts` files by removing the types, only syntax that can be erased is allowed (`erasableSyntaxOnly` enforces it):

- No `enum`. Use a union of string literals, or an object with `as const`.
- No `namespace` with runtime code, no parameter properties (`constructor(private x)`), no `import x = require()`.
- Type-only imports use `import type { X }` or `import { type X }`. `verbatimModuleSyntax` makes this an error otherwise, and without it Node would try to import a value that does not exist.
- Relative imports name the file with its extension: `import { getAccounts } from '../lib/db.ts'`. The frontend's `@/` imports stay extensionless because Vite resolves them; files imported by Node tests (see `docs/workflows/TESTING.md`) use relative `.ts` imports only.

## Where Types Live

| Kind of type | Location |
|---|---|
| Shapes the API sends or receives: accounts, posts, analytics, request bodies, responses | `shared/types/*.ts` (`domain.ts`, `youtube.ts`, `instagram.ts`, `reddit.ts`) |
| Worker bindings and Hono context | `backend/types/env.ts` (`Env`), `backend/types/app.ts` (`AppEnv`, `AppContext`, `AppVariables`) |
| Raw payloads from YouTube, Instagram and Reddit | The service module that parses them (`YouTubeApiVideo` in `services/youtubeApi.ts`) |
| Props, hook results, local state | The component or hook file, exported when another file needs it |

`shared/types` holds types only. It never imports runtime code, so either app can import it with `import type` and nothing from it reaches a bundle. The backend imports it by relative path (`../../shared/types/domain.ts`), the frontend by alias (`@shared/types/domain.ts`), except files that Node tests import, which use the relative path.

When a route's response changes, change its type in `shared/types` first. The type checker then lists every frontend file that reads the old shape.

## Typing Rules

- `any` is a lint error. Use a precise type. At a true boundary (JSON from `fetch`, `c.req.json()`, a test fake), use `unknown` or cast once to a named interface right where the value enters: `const body = await c.req.json() as AddAccountBody`.
- Describe external API payloads with an interface covering the fields the code reads, not the whole upstream schema.
- Exported functions declare their return type. Local helpers may rely on inference.
- `interface` for object shapes, `type` for unions, aliases and mapped types.
- Prefer narrowing (`if (!account) return ...`) over non-null assertions. Use `!` only where an earlier check guarantees the value, and never to hide a missing check.
- Caught errors are `unknown`: read the message with `(err as Error).message`.
- Response objects built in a route are checked with `satisfies`: `return c.json({ success: true, posts } satisfies ScheduledPostListResponse)`.
- No `// @ts-ignore` or `// @ts-expect-error`. Fix the type, or cast narrowly with a one-line comment that says why.

### Backend patterns

```ts
import { Hono } from 'hono';
import type { AppEnv, AppContext } from '../types/app.ts';

const app = new Hono<AppEnv>();

app.get('/accounts', async (c) => {
    const accounts = await getAccounts(c.get('supabase'), c.get('userId'));
    return c.json(accounts.map(safeAccount) satisfies AccountListResponse);
});

// handlers extracted from the router take the typed context
export async function callbackHandler(c: AppContext) { /* ... */ }
```

### Frontend patterns

```tsx
interface ChannelHeaderProps {
  account: AppAccount;
  onRefresh: () => void;
}

export default function ChannelHeader({ account, onRefresh }: ChannelHeaderProps) {
  const [analytics, setAnalytics] = useState<VideoAnalytics | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // ...
}
```

- Every component that receives props has a `<Component>Props` interface; children are `React.ReactNode`, icons are `LucideIcon`.
- Hooks that return several values export their result type: `export type BulkQueue = ReturnType<typeof useBulkQueue>`.
- shadcn components in `components/ui` follow the official base-nova TypeScript sources; `components.json` sets `tsx: true`, so `npx shadcn add` writes TypeScript.
- `api.ts` methods return the shared response types. Pages use those types instead of restating them.

## Module System

ES modules everywhere (`"type": "module"` in both workspaces). Use `import`/`export`, never `require()`.

## File Conventions

| Kind | Name | Example |
|---|---|---|
| Backend modules | `camelCase.ts` | `server.ts`, `db.ts`, `instagramApi.ts` |
| Frontend helpers and services | `camelCase.ts` | `api.ts`, `formatters.ts`, `overviewStats.ts` |
| React components and pages | `PascalCase.tsx` | `Overview.tsx`, `AppContext.tsx` |
| Feature hooks | `useCamelCase.ts` in the feature folder | `useOverviewData.ts` |
| Shared hooks | `use-kebab-case.ts` in `src/hooks` | `use-account-analytics.ts` |
| shadcn generated files | `kebab-case.tsx`, do not rename | `dropdown-menu.tsx` |
| Type-only modules | `camelCase.ts` | `shared/types/domain.ts`, `backend/types/env.ts` |
| Tests | `<source name>.test.ts` in the workspace `tests/` folder | `backend/tests/services/youtube.test.ts` |

A `.tsx` extension is only for files that contain JSX.

## Comments Policy

Write no comments by default. Add a comment only when the WHY is non-obvious and cannot be expressed in naming or in a type: a hidden constraint, a surprising invariant, a workaround for a specific bug.

**Do not write:**
- Comments explaining what the code does (naming and types do that)
- Comments referencing the task or PR ("added for issue #123")
- Multi-line comment blocks
- JSDoc (types replace it)

**Do write (sparingly):**
```ts
// userId=null means service-level - used by cron handlers that scan all users
export async function getAccounts(supabase: SupabaseClient, userId: string | null = null): Promise<Account[]> { ... }
```

## Naming

- Functions and variables: `camelCase` - `getAccounts`, `computeVideoAnalytics`, `scheduledAt`
- Types, interfaces and React components: `PascalCase` - `ScheduledPost`, `ChannelAnalytics`
- Constants: `SCREAMING_SNAKE_CASE` only for true module-level constants
- Prop interfaces: `<Component>Props`; request and response types: `<Thing>Request`, `<Thing>Response`

Prefer names that describe intent, not implementation:
- `getVideosCache` not `redisGetVideos`
- `requireAuth` not `jwtMiddleware`
- `safeAccount` not `stripToken`

## Error Handling

In **route handlers**, always catch and return JSON errors:
```ts
try {
    const data = await someOperation();
    return c.json(data);
} catch (err) {
    console.error('GET /my-route:', (err as Error).message);
    return c.json({ error: (err as Error).message }, 500);
}
```

In **service functions**, throw descriptive errors and let the caller decide how to handle them:
```ts
if (data.error) throw new Error(data.error.message);
```

In **cache functions**, always catch and silently ignore; cache failures must never bubble up:
```ts
try { return await redis.get<T>(key); } catch { return null; }
```

In **frontend components**, catch API errors and show toasts:
```ts
try {
    await api.deleteAccount(id);
    showToast('Account removed');
} catch (err) {
    showToast((err as Error).message, 'error');
}
```

## Async/Await

Use `async/await` everywhere. Do not use `.then()/.catch()` chains except in brief one-liners where the chain is clearer.

## Variables, Equality, Strings, Objects

- `const` by default, `let` only when reassigned, never `var`.
- `===` and `!==` only.
- Template literals for interpolation.
- Prefer destructuring, optional chaining (`account?.data?.username`) and nullish coalescing (`params.limit ?? 500`).

## No Unused Code

Do not leave unused variables, imports, types or commented-out code. Remove them.

## Lint and Format

The tooling config lives once at the repository root and covers both apps:

| File | What it sets |
|---|---|
| `eslint.config.mjs` | ESLint flat config. Every `.ts`/`.tsx` file: ESLint recommended plus `typescript-eslint` recommended (`no-explicit-any` is an error). Frontend: React hooks and React Refresh rules with browser globals. Backend: service worker globals (the Worker has no Node APIs). Tests, `scripts/` and `vite.config.ts`: Node globals. |
| `tsconfig.base.json` | Shared compiler settings; see Compiler Settings above |
| `.prettierrc.json` | Single quotes, semicolons, trailing commas, `arrowParens: "avoid"`, 120 columns, 2-space indentation, 4 spaces in `backend/` |
| `.prettierignore` | Skips `node_modules`, build output, `package-lock.json`, the shadcn files in `frontend/src/components/ui`, the backend golden snapshots and Markdown |
| `.editorconfig` | Editor defaults: UTF-8, 2-space indentation, 4 in `backend/`, final newline, trimmed trailing whitespace except in Markdown |

- Run `npm run typecheck` and `npm run lint` from the root before every commit. Unused variables are errors; in the backend, prefix an intentionally unused variable or argument with `_`.
- Match the indentation and quote style of the file you edit. `npm run format` applies Prettier to the whole repository and belongs in its own commit when it is run.
- Do not add per-app ESLint, Prettier or base TypeScript settings. Change the root config instead, and update this section and `docs/workflows/TESTING.md`.
