# Naming Conventions

## Files

| Location | Convention | Examples |
|---|---|---|
| Backend routes | `camelCase.js` | `accounts.js`, `scheduledPosts.js`, `instagramAuth.js` |
| Backend services | `camelCase.js` | `instagram.js`, `youtube.js` |
| Backend lib | `camelCase.js` | `db.js`, `cache.js`, `supabase.js`, `redis.js` |
| Backend middleware | `camelCase.js` | `auth.js` |
| Frontend pages | `PascalCase.jsx` | `Login.jsx`, `Overview.jsx` |
| Frontend feature components | `PascalCase.jsx` | `ChannelAnalytics.jsx`, `AccountManager.jsx` |
| Frontend contexts | `PascalCaseContext.jsx` | `AuthContext.jsx`, `AppContext.jsx` |
| Frontend layout | `PascalCase.jsx` or `index.jsx` | `Sidebar.jsx`, `Header.jsx`, `index.jsx` |
| Frontend hooks | `use-kebab-case.js` | `use-mobile.js` |
| Frontend utilities | `camelCase.js` | `formatters.js`, `api.js`, `utils.js` |
| shadcn components | `kebab-case.jsx` | `button.jsx`, `card.jsx` (generated - do not rename) |
| Documentation | `SCREAMING_SNAKE_CASE.md` | `OVERVIEW.md`, `JAVASCRIPT.md`, `SCHEMA.md` |

## Functions

- Backend route handlers: `camelCase` verb + noun - `getAnalytics(c)`, `createAccount(c)`, `deletePost(c)`
- Backend service functions: `camelCase` verb + noun - `fetchChannelData()`, `computeVideoAnalytics()`, `publishIGContainer()`
- Backend db functions: `camelCase` verb + noun - `getAccounts()`, `createPost()`, `updateAccount()`, `deletePost()`
- Frontend API methods: `camelCase` verb + noun - `getAnalytics()`, `createScheduledPost()`, `deleteAccount()`
- React event handlers: `handle` + PascalCase noun/event - `handleSubmit()`, `handleDeleteClick()`, `handleInputChange()`
- React custom hooks: `use` + PascalCase noun - `useAppContext()`, `useIsMobile()`

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
- jsonb field names: `camelCase` - these are JavaScript objects embedded in JSON, so they follow JS conventions: `accessToken`, `subscriberCount`, `publishedAt`

## Routes

- REST convention: noun-first, plural - `/accounts`, `/scheduled-posts`
- Resource nesting: `/accounts/:id/ig-analytics` (not `/ig-analytics/:accountId`)
- Kebab-case multi-word paths - `/refresh-all`, `/ig-publish`, `/process-scheduled`

## Supabase Cache Keys

`{entity}:{userId}:{accountId}` - `videos:abc-123:def-456`, `ig:abc-123:def-456`

## Environment Variables

- Backend Worker secrets: `SCREAMING_SNAKE_CASE` - `SUPABASE_URL`, `YOUTUBE_API_KEY`
- Frontend Vite variables: `VITE_` prefix + `SCREAMING_SNAKE_CASE` - `VITE_API_URL`, `VITE_SUPABASE_URL`
