# Naming Conventions

Start with `docs/guidelines/CODE_STYLE.md`, which shows how code reads across the repository and ends with the checklist to run before every commit; this page has the detailed rules for its area.

## Files

| Location | Convention | Examples |
|---|---|---|
| Backend route tables | `<feature>Routes.ts` | `accountRoutes.ts`, `scheduledPostRoutes.ts`, `instagramAuthRoutes.ts` |
| Backend controllers | `<feature>Controller.ts` | `accountController.ts`, `scheduledPostController.ts` |
| Backend validators | `<feature>Validators.ts` | `accountValidators.ts`, `publishingValidators.ts` |
| Backend feature services | `<feature>Service.ts` | `accountService.ts`, `youtubeAnalyticsService.ts` |
| Backend platform modules | `<platform><Topic>.ts` in `services/<platform>/` | `youtube/youtubeApi.ts`, `instagram/instagramPublishing.ts`, `reddit/redditApi.ts` |
| Backend repositories | `<table>Repository.ts` | `accountRepository.ts`, `scheduledPostRepository.ts`, `analyticsCacheRepository.ts` |
| Backend database clients | `camelCase.ts` in `database/` | `supabase.ts`, `redis.ts` |
| Backend lib | `camelCase.ts` | `errors.ts`, `logger.ts`, `config.ts`, `safeAccount.ts` |
| Backend middleware | `camelCase.ts` | `auth.ts`, `cors.ts`, `rateLimit.ts`, `errorHandler.ts` |
| Type-only modules | `camelCase.ts` | `shared/types/domain.ts`, `backend/types/env.ts`, `backend/types/app.ts` |
| Frontend pages | `PascalCase.tsx` | `Login.tsx`, `Overview.tsx` |
| Frontend feature components | `PascalCase.tsx` | `ChannelAnalytics.tsx`, `AccountManager.tsx` |
| Frontend contexts | `PascalCaseContext.tsx` | `AuthContext.tsx`, `AppContext.tsx` |
| Frontend layout | `PascalCase.tsx` or `index.tsx` | `Sidebar.tsx`, `Header.tsx`, `index.tsx` |
| Frontend feature hooks | `useCamelCase.ts` in the feature folder | `useBulkQueue.ts`, `useChannelVideos.ts` |
| Frontend shared hooks | `use-kebab-case.ts` in `src/hooks` | `use-mobile.ts` |
| Frontend utilities | `camelCase.ts` | `formatters.ts`, `api.ts`, `utils.ts` |
| shadcn components | `kebab-case.tsx` | `button.tsx`, `card.tsx` (generated - do not rename) |
| Tests | `<source name>.test.ts` in the workspace `tests/` folder | `backend/tests/routes/accountRoutes.test.ts`, `backend/tests/services/youtube/youtubeChannels.test.ts` |
| Database migrations | `<14 digit version>_<verb>_<object>.sql` in `supabase/migrations/`, created by `npm run db:new <verb>_<object>` | `20261016001700_add_accounts_updated_at.sql`, `20261016002400_index_accounts_list.sql` |
| Database rollbacks | the same file name as the migration, in `supabase/rollbacks/` | `20261016001700_add_accounts_updated_at.sql` |
| Documentation | `SCREAMING_SNAKE_CASE.md` | `OVERVIEW.md`, `TYPESCRIPT.md`, `SCHEMA.md` |

Use `.tsx` only for files that contain JSX; everything else is `.ts`.

## Functions

- Backend controllers: `camelCase` verb + noun - `getChannelAnalytics`, `addYouTubeAccount`, `deleteScheduledPost`
- Backend validators: `parse` + noun - `parseScheduledPost`, `parseVideoLibraryQuery`
- Backend service factories: `create` + service name - `createAccountService`, `createScheduledPublisher`; their methods are short verbs, because the service names the noun - `accounts.list`, `accounts.refresh`, `scheduledPosts.removeAll`
- Backend platform functions: `camelCase` verb + noun - `fetchChannelData()`, `computeVideoAnalytics()`, `createMediaContainer()`
- Backend repository methods: verb + `ForUser` when scoped to the verified user - `listForUser()`, `findForUser()`, `updateForUser()`, `deleteForUser()`; the cross-user methods for cron jobs have no suffix - `listByPlatform()`, `findById()`, `updateById()`, `listDue()`, `listStale()`, `claim()`
- Frontend API methods: `camelCase` verb + noun - `getAnalytics()`, `createScheduledPost()`, `deleteAccount()`
- React event handlers: `handle` + PascalCase noun/event - `handleSubmit()`, `handleDeleteClick()`, `handleInputChange()`
- React custom hooks: `use` + PascalCase noun - `useAppContext()`, `useIsMobile()`

## Types

- Interfaces, type aliases and React components: `PascalCase` - `ScheduledPost`, `ChannelAnalytics`
- Component props: `<Component>Props` - `ChannelHeaderProps`
- Request and response bodies: `<Thing>Request`, `<Thing>Response` - `ScheduledPostRequest`, `ScheduledPostListResponse`
- Raw upstream payloads: platform name + `Api` + entity - `YouTubeApiVideo`
- Services and their dependencies: `<Name>Service` and `<Name>Deps` - `AccountService`, `AccountServiceDeps`; repositories: `<Table>Repository` - `AccountRepository`
- Errors: `<Reason>Error` extending `AppError` - `NotFoundError`, `UpstreamTimeoutError`; error codes are `SCREAMING_SNAKE_CASE` - `NOT_FOUND`

## Variables

- `camelCase` throughout - `accountId`, `scheduledAt`, `accessToken`, `uploadPlaylistId`
- Boolean variables: `is`/`has`/`can` prefix - `isLoading`, `hasError`, `canPublish`
- IDs: always `{entity}Id` suffix - `accountId`, `userId`, `containerId`, `mediaId`
- Timestamps: `{action}At` suffix - `scheduledAt`, `publishedAt`, `createdAt`
- Counts: `{entity}Count` suffix - `subscriberCount`, `viewCount`, `mediaCount`
- Collections/arrays: plural noun - `accounts`, `videos`, `posts`, `hashtags`

## Constants

- True global constants: `SCREAMING_SNAKE_CASE` - `API`, `DEFAULT_KEYS`
- Environment-derived values at module top: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (from env)
- Named groupings: prefer an object over multiple constants

## Database

- Table names: `snake_case`, plural - `accounts`, `settings`, `scheduled_posts`
- Column names: `snake_case` - `user_id`, `account_id`, `scheduled_at`, `access_token` (inside jsonb)
- jsonb field names: `camelCase` - they become fields on TypeScript objects, so they follow the code's naming: `accessToken`, `subscriberCount`, `publishedAt`
- Every table has `created_at` and `updated_at`; `updated_at` is kept by the `<table>_set_updated_at` trigger

| Object | Convention | Examples |
|---|---|---|
| Migration name | verb first, then the object; one entity per file | `create_automation_rules`, `revoke_browser_access_automation_rules`, `add_automation_rules_updated_at_trigger`, `index_automation_rules_enabled_account`, `create_merge_account_data_function` |
| Value checks migration | `check_<table>_values` | `check_scheduled_posts_values` |
| Index migration | `index_<table>_<query>`, named for the query the index serves | `index_accounts_list`, `index_scheduled_posts_schedulers` |
| Index | `<table>_<columns>_idx`, or the purpose for a partial index | `accounts_user_id_created_at_idx`, `scheduled_posts_due_idx`, `scheduled_posts_claimed_idx` |
| CHECK constraint | `<table>_<column>_check` | `accounts_platform_check`, `scheduled_posts_claim_check` |
| Foreign key | `<table>_<referenced>_fkey` | `scheduled_posts_account_fkey` |
| Unique key | `<table>_<columns>_key` | `accounts_id_user_id_key` |
| Trigger | `<table>_set_updated_at` | `tracked_posts_set_updated_at` |
| Function | `snake_case` verb first; parameters prefixed `p_` | `set_updated_at()`, `merge_scheduled_post(p_id, p_user_id, p_patch)` |

## Routes

- REST convention: noun-first, plural - `/accounts`, `/scheduled-posts`
- Resource nesting: `/accounts/:id/ig-analytics` (not `/ig-analytics/:accountId`)
- Kebab-case multi-word paths - `/refresh-all`, `/ig-publish`, `/process-scheduled`

## Redis Cache Keys

`{entity}:{userId}:{accountId}` - `videos:abc-123:def-456`, `ig:abc-123:def-456`, `reddit:abc-123:def-456` (defined only in `repositories/analyticsCacheRepository.ts`)

## Environment Variables

- Backend Worker secrets: `SCREAMING_SNAKE_CASE` - `SUPABASE_URL`, `YOUTUBE_API_KEY`
- Frontend Vite variables: `VITE_` prefix + `SCREAMING_SNAKE_CASE` - `VITE_API_URL`, `VITE_SUPABASE_URL`
