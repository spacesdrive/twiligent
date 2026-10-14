# React Standards

Start with `docs/guidelines/CODE_STYLE.md`, which shows how code reads across the repository and ends with the checklist to run before every commit; this page has the detailed rules for its area.

## Component Rules

**Function components only.** No class components.

```tsx
export default function ChannelAnalytics() {
    // ...
    return <div>...</div>;
}
```

**One component per file.** Small helper sub-components can live in the same file if they are only used in that one file and are not exported.

**Typed props.** Every component that receives props declares a `<Component>Props` interface in the same file; export it only when another file needs it. Children are `React.ReactNode`, icons are `LucideIcon`. No PropTypes. See `docs/guidelines/TYPESCRIPT.md`.

```tsx
interface AccountCardProps {
    account: AppAccount;
    onRemove: (id: string) => void;
}

export default function AccountCard({ account, onRemove }: AccountCardProps) {
    // ...
}
```

## Hooks

Use hooks at the top level of the component, never inside conditions or loops:

```tsx
// Good
function MyComponent({ id }: MyComponentProps) {
    const [data, setData] = useState<YouTubeAnalyticsPayload | null>(null);
    const { showToast } = useAppContext();
    // ...
}

// Bad: conditional hook
function MyComponent({ id }: MyComponentProps) {
    if (id) {
        const [data, setData] = useState<YouTubeAnalyticsPayload | null>(null);
    }
}
```

Give `useState` a type argument when the initial value does not show the full type (`null`, `[]`), and `useRef` the element type: `useRef<HTMLDivElement>(null)`.

**Custom hooks** live where they are used:

- A hook used by one feature lives in that feature folder as `useCamelCase.ts`, for example `features/analytics/videos/useChannelVideos.ts` or `features/publishing/useBulkQueue.ts`.
- A hook shared across features lives in `frontend/src/hooks/` as `use-kebab-case.ts`, for example `hooks/use-cloudinary-config.ts`.

Either way, export a single function named `useSomething`. A hook that returns several values also exports its result type, for example `export type BulkQueue = ReturnType<typeof useBulkQueue>`. Move a feature hook into `hooks/` (and rename it) once a second feature needs it.

## State Management

**Prefer local state** for data that only one component needs. Use `useState`.

**Use AppContext** for data that multiple components need: `accounts`, `showToast`.

**Do not add new keys to AppContext** without strong justification. Page-level state (loading, analytics data) belongs in the page component, not the global context.

See `docs/guidelines/STATE_MANAGEMENT.md` for detailed guidance.

## Data Fetching Pattern

Fetch data in `useEffect` on component mount:

```tsx
const [data, setData] = useState<YouTubeAnalyticsPayload | null>(null);
const [loading, setLoading] = useState(true);
const { showToast } = useAppContext();

useEffect(() => {
    let cancelled = false;
    async function load() {
        try {
            const result = await api.getAnalytics(id);
            if (!cancelled) setData(result);
        } catch (err) {
            if (!cancelled) showToast((err as Error).message, 'error');
        } finally {
            if (!cancelled) setLoading(false);
        }
    }
    load();
    return () => { cancelled = true; };
}, [id, showToast]);
```

`api` methods return the shared response types from `shared/types`, so `result` is already typed; do not restate the shape in the page. The `cancelled` flag prevents state updates on unmounted components (important for pages that navigate away during loading).

## JSX Rules

**Conditional rendering:**
```tsx
// For if/else with significant content:
{loading ? <Skeleton /> : <DataTable data={data} />}

// For optional rendering:
{error && <ErrorBanner message={error} />}
```

**Lists always need `key`:**
```tsx
{accounts.map(account => (
    <AccountCard key={account.id} account={account} />
))}
```

**Event handlers** are named `handle{Event}` by convention:
```tsx
function handleSubmit(e: React.FormEvent<HTMLFormElement>) { ... }
function handleDeleteClick() { ... }
function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) { ... }
```

## Lazy Loading

All pages are lazy-loaded via `React.lazy()` in `App.tsx`. Do not import pages directly - always use lazy imports for new pages.

```tsx
const MyNewPage = lazy(() => import('./features/myFeature/MyNewPage'));
```

## Accessibility

- All interactive elements must be keyboard-accessible
- `<button>` for actions, `<a>` for navigation
- Images need `alt` attributes (empty string for decorative images)
- Use semantic HTML: `<main>`, `<nav>`, `<section>`, `<article>` where appropriate
- shadcn components handle most ARIA attributes automatically - use them as provided

## Performance

- Avoid large computations in render - move to `useMemo` if expensive
- Avoid re-creating functions in render that are passed as props - use `useCallback`
- The analytics computation functions (`computeVideoAnalytics`) run on the backend, not the frontend
