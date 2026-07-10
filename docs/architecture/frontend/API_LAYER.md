# Frontend API Layer

## Location: `frontend/src/services/api.js`

The single source of truth for all frontend-to-backend communication. **Never call `fetch()` directly in components or contexts.** Always add methods here and call them from components.

## The `request()` Function

```js
const API = import.meta.env.VITE_API_URL || 'http://localhost:8787/api';

async function request(path, options = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const res = await fetch(`${API}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        ...options,
    });
    const data = await res.json();
    if (!res.ok && !data.success) throw new Error(data.message || data.error || 'Request failed');
    return data;
}
```

**What it does automatically:**
1. Gets the current Supabase session token
2. Attaches `Authorization: Bearer <token>` header if logged in
3. Parses the JSON response
4. Throws an `Error` if the response is not OK (unless `data.success` is explicitly true)

**Error handling:** The error message comes from the backend's `{ error: '...' }` response body, falling back to `'Request failed'`. Callers are responsible for catching this error and showing appropriate UI.

## The `api` Object

All backend endpoints are methods on the exported `api` object:

```js
export const api = {
    health: () => request('/health'),
    getAccounts: () => request('/accounts'),
    addAccount: (input) => request('/accounts', { method: 'POST', body: JSON.stringify({ input }) }),
    // ... (see api.js for full list)
};
```

## Adding a New API Method

1. Add to `api.js`:
   ```js
   export const api = {
       // ... existing methods
       getMyResource: (id) => request(`/my-resource/${id}`),
       createMyResource: (data) => request('/my-resource', { method: 'POST', body: JSON.stringify(data) }),
   };
   ```

2. Use in a component:
   ```jsx
   import { api } from '../services/api';
   // ...
   const data = await api.getMyResource(id);
   ```

3. Update `docs/architecture/backend/ROUTES.md` if this is a new backend route

## Error Handling Pattern in Components

```jsx
const [loading, setLoading] = useState(false);
const { showToast } = useAppContext();

async function handleAction() {
    setLoading(true);
    try {
        const result = await api.someMethod(data);
        showToast('Action completed!');
        // update state with result
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        setLoading(false);
    }
}
```

## Authentication

The `request()` function automatically attaches the JWT. Components do not need to handle auth tokens — the API layer manages this transparently. If the user is not logged in, the token will be absent and the backend will return 401, which `request()` will throw as an error.

## Base URL

| Environment | Value |
|---|---|
| Local development | `http://localhost:8787/api` (default fallback) |
| Production | `https://twiligent.ujjwalkrai.workers.dev/api` (from `VITE_API_URL`) |

Set `VITE_API_URL` in `frontend/.env` for local development if your Worker runs on a different port.
