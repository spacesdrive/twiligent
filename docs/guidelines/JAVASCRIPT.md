# JavaScript Standards

This project is plain JavaScript - no TypeScript, no Babel transpilation beyond what Vite handles. These rules apply to both the backend (Cloudflare Worker) and the frontend (Vite + React).

## Module System

- **Backend:** ES modules only (`"type": "module"` in `backend/package.json`). Use `import`/`export`. No `require()`.
- **Frontend:** ES modules via Vite. Same rules.
- Never mix `import` and `require()` in the same file.

## File Conventions

- **Backend files:** `camelCase.js` - `server.js`, `auth.js`, `instagram.js`, `db.js`
- **Frontend utility/service files:** `camelCase.js` - `api.js`, `formatters.js`
- **Frontend React files:** `PascalCase.jsx` - `Overview.jsx`, `AppContext.jsx`
- **shadcn generated files:** `kebab-case.jsx` - do not rename these

## Comments Policy

Write no comments by default. Add a comment only when the WHY is non-obvious and cannot be expressed in naming alone: a hidden constraint, a surprising invariant, a workaround for a specific bug.

**Do not write:**
- Comments explaining what the code does (naming does that)
- Comments referencing the task or PR ("added for issue #123")
- Multi-line comment blocks
- JSDoc

**Do write (sparingly):**
```js
// userId=null means service-level - used by cron handlers that scan all users
export async function getAccounts(supabase, userId = null) { ... }

// Redis HMAC state: base64url(userId:timestamp).HMAC-SHA256-sig - see cache.js
```

## Naming

- Functions: `camelCase` - `getAccounts`, `computeVideoAnalytics`, `publishToInstagram`
- Variables: `camelCase` - `accountId`, `scheduledAt`, `accessToken`
- Constants: `SCREAMING_SNAKE_CASE` only for true global constants (rare)
- React components: `PascalCase` - `ChannelAnalytics`, `AppProvider`

Prefer names that describe intent, not implementation:
- `getVideosCache` not `redisGetVideos`
- `requireAuth` not `jwtMiddleware`
- `safeAccount` not `stripToken`

## Error Handling

In **route handlers**, always catch and return JSON errors:
```js
try {
    const data = await someOperation();
    return c.json(data);
} catch (err) {
    console.error('GET /my-route:', err.message);
    return c.json({ error: err.message }, 500);
}
```

In **service functions**, throw descriptive errors - let the caller decide how to handle:
```js
if (data.error) throw new Error(data.error.message);
```

In **cache functions**, always catch and silently ignore - cache failures must never bubble up:
```js
try { return await redis.get(key); } catch { return null; }
```

In **frontend components**, catch API errors and show toasts:
```js
try {
    const result = await api.doThing();
    showToast('Done!');
} catch (err) {
    showToast(err.message, 'error');
}
```

## Async/Await

Use `async/await` everywhere. Do not use `.then()/.catch()` chains except in brief one-liners where the chain is clearer.

```js
// Good
const data = await api.getAnalytics(id);

// Avoid
api.getAnalytics(id).then(data => ...).catch(err => ...);
```

## Variable Declarations

Use `const` by default. Use `let` only when the variable is reassigned. Never use `var`.

## Equality

Always use `===` and `!==`. Never `==` or `!=`.

## String Formatting

Use template literals for all string interpolation:
```js
const url = `${SUPABASE_URL}/rest/v1/accounts?id=eq.${accountId}`;
```

## Object Patterns

Prefer destructuring:
```js
const { id, platform, ...data } = account;
const { data: { session } } = await supabase.auth.getSession();
```

Use optional chaining:
```js
const token = session?.access_token;
const name = account?.data?.username;
```

Use nullish coalescing:
```js
const limit = params.limit ?? 500;
const accounts = data ?? [];
```

## No Unused Code

Do not leave unused variables, unused imports, or commented-out code blocks. Remove them.
