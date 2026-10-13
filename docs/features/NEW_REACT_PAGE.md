# Guide: Adding a New React Page

Read `frontend/src/features/analytics/channel/ChannelAnalytics.tsx` as a reference implementation before starting.

## Files to Create or Modify

| Action | File |
|---|---|
| Modify | `shared/types/*.ts` (response type for any new endpoint, see `NEW_API_ENDPOINT.md`) |
| Create | `frontend/src/features/myFeature/MyPage.tsx` |
| Modify | `frontend/src/App.tsx` (add lazy import + route) |
| Modify | `frontend/src/layout/navigation.ts` (add a nav item if the page belongs in the sidebar) |
| Modify | `frontend/src/services/api.ts` (add API methods) |
| Update | `docs/architecture/frontend/REACT_ARCHITECTURE.md` |

## Step 1: Create the Page Component

```tsx
// frontend/src/features/myFeature/MyPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { UserX } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState, PageSkeleton } from '@/components/StateViews';
import { useAppContext } from '../../context/AppContext';
import { api } from '../../services/api';
import type { MyData } from '@shared/types/domain.ts';

export default function MyPage() {
    const { id } = useParams<{ id: string }>();          // if the page has a dynamic segment
    const { accounts, showToast } = useAppContext();
    const [data, setData] = useState<MyData | null>(null);
    const [loading, setLoading] = useState(true);

    const account = accounts.find(a => a.id === id);    // find from global accounts

    const loadData = useCallback(async () => {
        if (!account || !id) return;
        try {
            const result = await api.getMyData(id);     // typed by api.ts, no cast needed
            setData(result);
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            setLoading(false);
        }
    }, [id, account, showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading) return <PageSkeleton />;

    if (!account) {
        return (
            <SurfaceBox>
                <EmptyState icon={<UserX />} title="Account not found" description="It may have been removed. Choose another account from the sidebar." />
            </SurfaceBox>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader back={{ to: '/', label: 'Overview' }} title={account.title} />
            <SurfaceBox title="My data">
                {/* content */}
            </SurfaceBox>
        </div>
    );
}
```

## Step 2: Add the Route in App.tsx

```tsx
// frontend/src/App.tsx
const MyPage = lazy(() => import('./features/myFeature/MyPage'));

// In the router definition, inside the children array:
{ path: 'my-page/:id', element: <MyPage /> },
```

## Step 3: Add Navigation

If the page belongs in the sidebar, add it to `NAV_GROUPS` in `frontend/src/layout/navigation.ts`. The sidebar, top bar title and command palette pick it up automatically:

```ts
{ path: '/my-page', label: 'My page', icon: IconName },
```

`icon` is a `LucideIcon` (the component, not an element); the item is checked against the `NavItem` interface in the same file.

Detail pages that are not in the sidebar get a top bar title in `DETAIL_ROUTES` in the same file.

## Step 4: Add API Methods

```ts
// frontend/src/services/api.ts
getMyData: (id: string) => request<MyData>(`/accounts/${id}/my-data`),
```

## Step 5: Type-check

Run `npm run typecheck` from the repository root and fix every error. Vite strips types without checking them, so a page that builds can still have type errors.

## Conventions

- Use `useAppContext()` - don't re-fetch the accounts list, use what's in context
- Use the response types `api.ts` returns; do not restate them in the page. Sub-components get a `<Component>Props` interface
- Always handle loading and error states
- Use `PageSkeleton` or `Skeleton` for loading states, `EmptyState` for no data, and a toast for failures
- Use semantic HTML for the page structure
- Start the page with `PageHeader`; the app shell already provides the page padding
- Use `flex flex-col gap-6` for vertical rhythm between sections
- Follow the page patterns in `docs/architecture/frontend/DESIGN_SYSTEM.md`

## Page That Doesn't Need an Account Parameter

For pages that show aggregate data across all accounts (like Overview):

```tsx
export default function MyAggregatePage() {
    const { accounts, loading: accountsLoading } = useAppContext();
    // accounts is already loaded - no need to fetch
    
    const summary = useMemo(() => {
        return accounts.reduce((sum, a) => sum + (a.viewCount || 0), 0);
    }, [accounts]);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="My summary" />
            <MetricBox label="Total views" value={fmtNum(summary)} />
        </div>
    );
}
```

## Accessibility Requirements

- The main heading (`h1`) should describe the page, not just "Details"
- Tables must have `<thead>` with column headers
- Loading state must be announced (Skeleton is visually recognizable; add `aria-busy` if needed)
- Interactive elements must be reachable by keyboard
