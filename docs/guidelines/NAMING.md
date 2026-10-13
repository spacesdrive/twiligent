# Naming Conventions

## Files

| Location | Convention | Examples |
|---|---|---|
| Backend routes | `camelCase.ts` | `accounts.ts`, `scheduledPosts.ts`, `instagramAuth.ts` |
| Backend services | `camelCase.ts` | `instagram.ts`, `youtube.ts` |
| Backend lib | `camelCase.ts` | `db.ts`, `cache.ts`, `supabase.ts`, `redis.ts` |
| Backend middleware | `camelCase.ts` | `auth.ts`, `rateLimit.ts` |
| Type-only modules | `camelCase.ts` | `shared/types/domain.ts`, `backend/types/env.ts`, `backend/types/app.ts` |
| Frontend pages | `PascalCase.tsx` | `Login.tsx`, `Overview.tsx` |
| Frontend feature components | `PascalCase.tsx` | `ChannelAnalytics.tsx`, `AccountManager.tsx` |
| Frontend contexts | `PascalCaseContext.tsx` | `AuthContext.tsx`, `AppContext.tsx` |
| Frontend layout | `PascalCase.tsx` or `index.tsx` | `Sidebar.tsx`, `Header.tsx`, `index.tsx` |
| Frontend feature hooks | `useCamelCase.ts` in the feature folder | `useBulkQueue.ts`, `useChannelVideos.ts` |
| Frontend shared hooks | `use-kebab-case.ts` in `src/hooks` | `use-mobile.ts` |
| Frontend utilities | `camelCase.ts` | `formatters.ts`, `api.ts`, `utils.ts` |
| shadcn components | `kebab-case.tsx` | `button.tsx`, `card.tsx` (generated - do not rename) |
| Tests | `<source name>.test.ts` in the workspace `tests/` folder | `backend/tests/services/youtube.test.ts` |
| Documentation | `SCREAMING_SNAKE_CASE.md` | `OVERVIEW.md`, `TYPESCRIPT.md`, `SCHEMA.md` |

Use `.tsx` only for files that contain JSX; everything else is `.ts`.

## Functions

- Backend route handlers: `camelCase` verb + noun - `getAnalytics(c)`, `createAccount(c)`, `deletePost(c)`
- Backend service functions: `camelCase` verb + noun - `fetchChannelData()`, `computeVideoAnalytics()`, `publishIGContainer()`
- Backend db functions: `camelCase` verb + noun - `getAccounts()`, `createPost()`, `updateAccount()`, `deletePost()`
- Frontend API methods: `camelCase` verb + noun - `getAnalytics()`, `createScheduledPost()`, `deleteAccount()`
- React event handlers: `handle` + PascalCase noun/event - `handleSubmit()`, `handleDeleteClick()`, `handleInputChange()`
- React custom hooks: `use` + PascalCase noun - `useAppContext()`, `useIsMobile()`

## Types

- Interfaces, type aliases and React components: `PascalCase` - `ScheduledPost`, `ChannelAnalytics`
- Component props: `<Component>Props` - `ChannelHeaderProps`
- Request and response bodies: `<Thing>Request`, `<Thing>Response` - `ScheduledPostRequest`, `ScheduledPostListResponse`
- Raw upstream payloads: platform name + `Api` + entity - `YouTubeApiVideo`

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

## Routes

- REST convention: noun-first, plural - `/accounts`, `/scheduled-posts`
- Resource nesting: `/accounts/:id/ig-analytics` (not `/ig-analytics/:accountId`)
- Kebab-case multi-word paths - `/refresh-all`, `/ig-publish`, `/process-scheduled`

## Supabase Cache Keys

`{entity}:{userId}:{accountId}` - `videos:abc-123:def-456`, `ig:abc-123:def-456`

## Environment Variables

- Backend Worker secrets: `SCREAMING_SNAKE_CASE` - `SUPABASE_URL`, `YOUTUBE_API_KEY`
- Frontend Vite variables: `VITE_` prefix + `SCREAMING_SNAKE_CASE` - `VITE_API_URL`, `VITE_SUPABASE_URL`
