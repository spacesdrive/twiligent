# React Standards

## Component Rules

**Function components only.** No class components.

```jsx
export default function ChannelAnalytics() {
    // ...
    return <div>...</div>;
}
```

**One component per file.** Small helper sub-components can live in the same file if they are only used in that one file and are not exported.

**No prop-types.** This project does not use PropTypes or TypeScript types. Descriptive prop names are the documentation.

## Hooks

Use hooks at the top level of the component, never inside conditions or loops:

```jsx
// Good
function MyComponent({ id }) {
    const [data, setData] = useState(null);
    const { showToast } = useAppContext();
    // ...
}

// Bad
function MyComponent({ id }) {
    if (id) {
        const [data, setData] = useState(null); // ❌ conditional hook
    }
}
```

**Custom hooks** go in `frontend/src/hooks/`. Name them `use-kebab-case.js`. Export a single function named `useSomething`.

## State Management

**Prefer local state** for data that only one component needs. Use `useState`.

**Use AppContext** for data that multiple components need: `accounts`, `showToast`.

**Do not add new keys to AppContext** without strong justification. Page-level state (loading, analytics data) belongs in the page component, not the global context.

See `docs/guidelines/STATE_MANAGEMENT.md` for detailed guidance.

## Data Fetching Pattern

Fetch data in `useEffect` on component mount:

```jsx
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const { showToast } = useAppContext();

useEffect(() => {
    let cancelled = false;
    async function load() {
        try {
            const result = await api.getAnalytics(id);
            if (!cancelled) setData(result);
        } catch (err) {
            if (!cancelled) showToast(err.message, 'error');
        } finally {
            if (!cancelled) setLoading(false);
        }
    }
    load();
    return () => { cancelled = true; };
}, [id, showToast]);
```

The `cancelled` flag prevents state updates on unmounted components (important for pages that navigate away during loading).

## JSX Rules

**Conditional rendering:**
```jsx
// For if/else with significant content:
{loading ? <Skeleton /> : <DataTable data={data} />}

// For optional rendering:
{error && <ErrorBanner message={error} />}
```

**Lists always need `key`:**
```jsx
{accounts.map(account => (
    <AccountCard key={account.id} account={account} />
))}
```

**Event handlers** are named `handle{Event}` by convention:
```jsx
function handleSubmit(e) { ... }
function handleDeleteClick() { ... }
function handleInputChange(e) { ... }
```

## Lazy Loading

All pages are lazy-loaded via `React.lazy()` in `App.jsx`. Do not import pages directly — always use lazy imports for new pages.

```jsx
const MyNewPage = lazy(() => import('./features/myFeature/MyNewPage'));
```

## Accessibility

- All interactive elements must be keyboard-accessible
- `<button>` for actions, `<a>` for navigation
- Images need `alt` attributes (empty string for decorative images)
- Use semantic HTML: `<main>`, `<nav>`, `<section>`, `<article>` where appropriate
- shadcn components handle most ARIA attributes automatically — use them as provided

## Performance

- Avoid large computations in render — move to `useMemo` if expensive
- Avoid re-creating functions in render that are passed as props — use `useCallback`
- The analytics computation functions (`computeVideoAnalytics`) run on the backend, not the frontend
