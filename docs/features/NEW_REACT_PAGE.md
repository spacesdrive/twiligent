# Guide: Adding a New React Page

Read `frontend/src/features/analytics/channel/ChannelAnalytics.jsx` as a reference implementation before starting.

## Files to Create or Modify

| Action | File |
|---|---|
| Create | `frontend/src/features/myFeature/MyPage.jsx` |
| Modify | `frontend/src/App.jsx` (add lazy import + route) |
| Modify | `frontend/src/layout/navigation.js` (add a nav item if the page belongs in the sidebar) |
| Modify | `frontend/src/services/api.js` (add API methods) |
| Update | `docs/architecture/frontend/REACT_ARCHITECTURE.md` |

## Step 1: Create the Page Component

```jsx
// frontend/src/features/myFeature/MyPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { api } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function MyPage() {
    const { id } = useParams();                          // if the page has a dynamic segment
    const { accounts, showToast } = useAppContext();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const account = accounts.find(a => a.id === id);    // find from global accounts

    const loadData = useCallback(async () => {
        if (!account) return;
        try {
            const result = await api.getMyData(id);
            setData(result);
        } catch (err) {
            showToast(err.message, 'error');
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

## Step 2: Add the Route in App.jsx

```jsx
// frontend/src/App.jsx
const MyPage = lazy(() => import('./features/myFeature/MyPage'));

// In the router definition, inside the children array:
{ path: 'my-page/:id', element: <MyPage /> },
```

## Step 3: Add Navigation

If the page belongs in the sidebar, add it to `NAV_GROUPS` in `frontend/src/layout/navigation.js`. The sidebar, top bar title and command palette pick it up automatically:

```js
{ path: '/my-page', label: 'My page', icon: IconName },
```

Detail pages that are not in the sidebar get a top bar title in `DETAIL_ROUTES` in the same file.

## Step 4: Add API Methods

```js
// frontend/src/services/api.js
getMyData: (id) => request(`/accounts/${id}/my-data`),
```

## Conventions

- Use `useAppContext()` - don't re-fetch the accounts list, use what's in context
- Always handle loading and error states
- Use `PageSkeleton` or `Skeleton` for loading states, `EmptyState` for no data, and a toast for failures
- Use semantic HTML for the page structure
- Start the page with `PageHeader`; the app shell already provides the page padding
- Use `flex flex-col gap-6` for vertical rhythm between sections
- Follow the page patterns in `docs/architecture/frontend/DESIGN_SYSTEM.md`

## Page That Doesn't Need an Account Parameter

For pages that show aggregate data across all accounts (like Overview):

```jsx
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
