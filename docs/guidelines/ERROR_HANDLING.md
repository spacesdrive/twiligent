# Error Handling Standards

## Layer-by-Layer Rules

### External API Calls (services/)

Throw descriptive errors immediately when the external API returns an error object. Let the caller decide what to do:

```js
const data = await res.json();
if (data.error) throw new Error(data.error.message);
```

For HTTP-level errors (non-200 but no error body):
```js
if (!res.ok) throw new Error(`YouTube API ${res.status}: ${await res.text()}`);
```

### Database Calls (lib/db.js)

Check the Supabase `error` field and throw:

```js
const { data, error } = await supabase.from('accounts').select('*').eq('user_id', userId);
if (error) throw error;
```

Supabase errors are objects with `message`, `code`, and `details`. Throwing the error object directly passes the message through cleanly.

### Cache Operations (lib/cache.js)

Always catch and silently ignore — cache failures must never surface to users:

```js
try {
    return (await redis.get(key)) || null;
} catch {
    return null;
}
```

The empty `catch` block is intentional. Do not log cache errors — they create noise for transient Redis connection issues.

### Route Handlers (routes/)

Wrap the main logic in try/catch, log the error, and return a JSON error response:

```js
router.get('/accounts/:id/analytics', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    try {
        const account = await getAccountById(supabase, id, userId);
        if (!account) return c.json({ error: 'Account not found' }, 404);
        const analytics = await getAnalytics(account, c.env);
        return c.json(analytics);
    } catch (err) {
        console.error(`GET /accounts/${id}/analytics:`, err.message);
        return c.json({ error: err.message }, 500);
    }
});
```

**Status codes:**
- `400` — bad request (missing required fields, invalid input)
- `401` — unauthorized (handled by `requireAuth`, not route handlers)
- `403` — forbidden (account belongs to another user)
- `404` — resource not found
- `500` — unexpected server error

### Frontend API Calls

Catch in the component or handler, show a toast, and handle loading state:

```jsx
const [loading, setLoading] = useState(false);
const { showToast } = useAppContext();

async function handleSubmit() {
    setLoading(true);
    try {
        await api.doSomething(data);
        showToast('Saved successfully!');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        setLoading(false);
    }
}
```

The `api.js` `request()` function already extracts the error message from `{ error: '...' }` backend responses, so `err.message` will be the backend's error string.

### Global Error Handler (server.js)

The Hono global error handler catches any uncaught errors that bubble up past route handlers:

```js
app.onError((err, c) => {
    console.error('Worker error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
});
```

This is the last resort. Route handlers should not rely on it.

## Logging

Use `console.error()` for errors in route handlers — Cloudflare Workers captures these in the dashboard logs.

Format: `console.error('METHOD /path:', err.message)` — includes the route for easy filtering.

Do not log sensitive values: access tokens, API keys, user emails, Supabase URLs.

Do not use `console.log()` in production code paths except for cron job status messages (these are useful for monitoring scheduled tasks).

## User-Facing Error Messages

Backend errors should be descriptive but not expose implementation details:
- Good: `'Account not found'`, `'Instagram API rate limit exceeded'`, `'Missing required field: scheduledAt'`
- Bad: `'supabase error: duplicate key value violates unique constraint accounts_pkey'`

When the Supabase or Instagram API returns a message that is end-user readable, pass it through. When it is technical (e.g., PostgreSQL constraint violation), translate it.
