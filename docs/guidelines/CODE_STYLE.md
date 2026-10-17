# Code Style

How code in this repository reads. Every change follows it, so a file written today looks like the files around it. The detailed rules live in the guides linked from each section; this page is the one to read first and the checklist to run last.

When this page and the code disagree, the code in the newest reviewed files wins: fix this page in the same change.

## The Short Version

1. **Match the nearest example.** Before writing a file, open its closest sibling (the same layer, the same kind of component) and copy its shape: imports, exports, naming, comment density, error handling.
2. **One job per file and per layer.** A route table maps, a controller translates HTTP, a service decides, a repository queries, a component renders, a `lib/` helper computes.
3. **Comments say why, in one lowercase line.** Never what the code does.
4. **Failures are typed and written for people.** Throw a typed error with a message that says what happened and what to do; never "Something went wrong".
5. **Strict TypeScript with erasable syntax.** No `any`, no enums, `import type` for types, `.ts` on relative imports.
6. **Design tokens and shared components only** in the UI. No hex or palette colours, no one-off cards.
7. **Tests describe behaviour in a sentence** and live in `tests/`, mirroring the source path.
8. **No em dashes, en dashes, emoji or exclamation marks** in code, copy, docs or commits.

## Formatting

Prettier settings in `.prettierrc.json` and `.editorconfig` describe the layout; match the file you edit rather than reformatting it.

| | Backend, scripts | Frontend, site |
|---|---|---|
| Indentation | 4 spaces | 2 spaces |
| Quotes | single | single (JSX attributes use double) |
| Semicolons, trailing commas | yes | yes |
| Line length | up to about 120 columns; long JSX props go one per line | same |

## Files and Imports

- One exported unit per file: a component, a hook, a service factory, a repository factory, a route table. Small helpers used only in that file stay unexported beside it.
- Names follow `docs/guidelines/NAMING.md` and the table in `docs/guidelines/TYPESCRIPT.md` (`accountService.ts`, `PasswordSection.tsx`, `useChannelVideos.ts`, `use-mobile.ts`).
- Import order: packages first, then project modules. Backend files put every `import type` line after the value imports, as below; frontend files may keep a type import next to the value import from the same module.

```ts
import { NotConfiguredError, RateLimitedError, UpstreamError } from '../lib/errors.ts';
import { composeAuthEmails } from './email/authEmails.ts';
import { sendEmail } from './email/resendApi.ts';
import type { AuthEmail } from './email/authEmails.ts';
import type { EmailQuotaRepository } from '../repositories/emailQuotaRepository.ts';
```

- Backend and test imports are relative and end in `.ts`. Frontend imports use `@/` for `src/` (no extension) and `./` for siblings; files that Node tests import use relative `.ts` paths only.
- Pure logic that can be tested goes in a plain `.ts` file with no JSX (`frontend/src/lib/passwords.ts`, `backend/services/email/authEmails.ts`), so Node can run its test directly.
- `scripts/` has no dependencies. A rule a script shares with the Worker lives in an import-free `backend/lib/` helper that the script imports by relative path (`scripts/publish-scheduled.ts` imports `../backend/lib/scheduledPublishing.ts`); that helper imports nothing at runtime. See `docs/guidelines/TYPESCRIPT.md`.

## Comments

Write a comment only when the reason is not visible in the code: a constraint from outside (a provider's limit, a browser quirk), an invariant, or behaviour that would surprise a reader. One line, lowercase start, no full stop needed, placed above the line it explains.

```ts
// Supabase gives the whole hook call 5 seconds, so a slow send is abandoned before Supabase gives up on the Worker
const SEND_TIMEOUT_MS = 4000;

// a refused send increments nothing, so one address asking again and again cannot use up the day's allowance
```

Do not write comments that restate the code (`// send the email`), name the task or issue, describe callers, or document parameters (types do that). No JSDoc and no multi-line blocks. A module-level constant with a number in it nearly always needs its one-line reason.

## Naming Inside Functions

- Event handlers in components: `handleSubmit`, `handleResend`, `handleSave`. Mode-specific steps they call: `submitLogin`, `submitReset`.
- Booleans read as questions or states: `loading`, `saving`, `isLogin`, `emailLimitReached`, `configured`.
- Lookups keyed by a union are typed records, not `switch` chains, when each case is a value: `const FAILURE_PREFIX: Record<LoginMode, string> = { ... }`.
- Functions that return a reason or `null` say so: `newPasswordProblem(password, confirmation): string | null`.

## Backend Patterns

The layers are in `docs/architecture/backend/REQUEST_PIPELINE.md`; the recipes are in `docs/features/NEW_API_ENDPOINT.md` and `docs/guidelines/HONO.md`. The shapes to copy:

| Layer | Shape | Example |
|---|---|---|
| Route table | `const router = new Hono<AppEnv>(); router.post(path, ...middleware, ...controller)` | `routes/authHookRoutes.ts` |
| Controller | `controller.createHandlers(validator, async c => { one service call; return c.json(... satisfies Type) })` | `controllers/settingsController.ts` |
| Validator | `parseX(fields: Fields): XRequest` with the helpers in `validators/fields.ts` | `validators/authHookValidators.ts` |
| Service | `interface XService`, `interface XDeps`, `export function createXService(deps): XService` returning an object literal | `services/authEmailService.ts` |
| Repository | `interface XRepository`, `createXRepository(client)`, one method per query, `...ForUser` for user-scoped methods | `repositories/emailQuotaRepository.ts` |
| Platform module | plain functions taking config and an optional trailing `signal`, throwing `UpstreamError` and `UpstreamTimeoutError` | `services/email/resendApi.ts` |

- Services never import `hono`. They receive repositories, `AppConfig` and the `RequestContext`, and log through `context.log` with a short lowercase message and fields: `context.log.warn('auth email skipped', { action, reason: 'limit reached' })`.
- Every platform `fetch` gets `context.signal` (plus its own timeout when the caller has a budget).
- Redis code catches every failure and falls back; nothing else swallows errors, with two exceptions that log instead: a job that works through many items (the scheduled publisher, the reply processor, the token refresh) catches one item's failure and moves on, and a secondary step after the main write (subscribing an account when a rule is turned on) is logged with `context.log.warn` so the main result still stands.
- A platform call whose every failure leads somewhere different may answer a result union instead of throwing (`sendPrivateReply` returns `{ kind: 'accepted' | 'error' | 'ambiguous' | 'not_sent' }`); the decision table lives in a pure `lib/` helper (`finishPlan` in `lib/automationDelivery.ts`) with its tests.
- Work after a response goes through `inBackground(c, label, work)` in `controllers/http.ts`, which gives it its own deadline, never `c.executionCtx.waitUntil()` with the request's services.
- The schema changes only through a migration in `supabase/migrations/` (`npm run db:new <verb>_<object>`) with its reverse in `supabase/rollbacks/` under the same name, one database entity per file: a table (with its columns, keys and checks), its browser access, one trigger, one index or one function (a new table is at least four files; the test in `tests/database/migrations.test.ts` refuses a file that creates more); each migration and rollback opens with one plain sentence that says what it does (`-- adds an index that lists a user's drafts newest first`), and `supabase/schemas/` is regenerated with `npm run db:schema` after a push, never edited; a repository updates `data` through a merge function with `db.rpc()`, never by reading and writing it back. See `docs/features/NEW_DATABASE_TABLE.md`.
- New row ids come from `newRowId()` in `lib/ids.ts`; tests pin them with `mockRowIds()` from `tests/fixtures/rowIds.ts`.
- No new runtime dependency in the Worker without approval: call HTTP APIs with `fetch` (Resend is called this way, not through its SDK).

## Errors and Messages

Messages are UI copy. Follow `docs/WRITING_STANDARDS.md` (UI Copy) and `docs/guidelines/ERROR_HANDLING.md`.

- Backend: throw the typed error whose code matches the failure (`ValidationError`, `NotFoundError`, `RateLimitedError`, `NotConfiguredError`, `UpstreamError`), with a message a person can act on: `'This address has received the most codes allowed today. Use the latest code you received, or try again tomorrow.'` A missing secret names the secret: `'Email sending is not set up: the RESEND_API_KEY and EMAIL_FROM Worker secrets are required'`.
- Frontend failures: a toast that starts with what failed and adds the reason: `` `Couldn't save the password. ${reason}` ``. Map provider error codes to plain sentences in a `lib/` helper (`lib/authErrors.ts`) and keep the provider's own message when it already says what to do.
- Frontend success: confirm what happened in past tense, sentence case, no exclamation mark: `'Password saved'`, `'New code sent'`.
- Never reveal more than the user should know: the password reset message reads `If an account uses <email>, a code is on its way.` because the server does not say whether the account exists.

## Frontend Patterns

Rules in `docs/guidelines/REACT.md`, `docs/guidelines/TAILWIND.md`, `docs/guidelines/SHADCN.md` and `docs/architecture/frontend/DESIGN_SYSTEM.md`. The shapes to copy:

```tsx
export interface LoginEmailFormProps {
  copy: LoginCopy;
  email: string;
  onEmailChange: (value: string) => void;
  loading: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export default function LoginEmailForm({ copy, email, onEmailChange, loading, onSubmit }: LoginEmailFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FieldRow label="Email" htmlFor="email">
        <Input id="email" type="email" className="h-(--control-h-lg)" value={email} onChange={e => onEmailChange(e.target.value)} required />
      </FieldRow>
      <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading}>
        {loading && <Spinner className="size-4" />}
        {loading ? copy.busy : copy.submit}
      </Button>
    </form>
  );
}
```

- Presentational components get values and callbacks as props; the page or section owns state and calls `useAuth()`, `useAppContext()` or `api`.
- Forms: `FieldRow` for label and hint, shadcn `Input` and `Button`, `Spinner` in the button while busy, the action named for what it does (`Save password`, `Send code`).
- Sections of a settings-style page use `SettingsSection` and `SurfaceBox`; pages use `PageHeader`; toasts go through `showToast` inside the app shell (the login page uses `toast` from `sonner` directly).
- Icons are Lucide with `data-icon="inline-start"` or `inline-end` in buttons.
- When markup repeats in two places, extract it (`PasswordInput.tsx` for the password field with its show button) rather than copying it.
- Copy that changes by mode lives in a typed table (`loginCopy.ts`, `LOGIN_COPY: Record<LoginMode, LoginCopy>`).
- The public site (`site/`) follows the same React rules without shadcn: it has its own tokens in `site/src/index.css` and uses the Solar icons from `@/components/icons`, never Lucide. See `docs/architecture/site/SITE.md`.

## Tests

Rules in `docs/workflows/TESTING.md`.

- `node:test` with `assert from 'node:assert/strict'`; no other framework.
- Test names are sentences about behaviour, not function names: `'past the daily cap nothing is sent and the error tells the person to use Google'`.
- One behaviour per test, with the smallest fake that exercises it, cast once to the interface it stands in for. Shared fakes and fixtures live in `backend/tests/fixtures/`.
- Every new pure helper, validator, service and route gets a test in the mirrored `tests/` path.

## Docs and Commits

- Docs follow `docs/WRITING_STANDARDS.md`: short declarative sentences, tables for structured facts, code blocks for commands, no marketing words.
- User and self-hosting docs are MDX pages in `site/content/docs/`; engineering docs stay in `docs/`. Adding or moving a docs page is in `docs/architecture/site/SITE.md`.
- Commits follow `docs/workflows/GIT.md`: `type(scope): imperative summary`, a body that says why, and `Refs #N` or `Closes #N`. No AI attribution lines.
- Every change is tracked by an issue (`docs/workflows/ISSUES.md`) and lands on `main` through a pull request that passed CI.

## Before Every Commit

- [ ] The new file looks like its nearest sibling: imports, exports, naming, comments
- [ ] Comments only explain why; no restated code, no task references
- [ ] Errors are typed (backend) or toasts with a reason (frontend), and every message says what to do
- [ ] No `any`, enums, `@ts-ignore`, hex colours, emoji, em dashes or exclamation marks
- [ ] Tests added in the mirrored `tests/` path, with behaviour sentences as names
- [ ] `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass
- [ ] Docs in the Documentation Maintenance Policy updated in the same change
