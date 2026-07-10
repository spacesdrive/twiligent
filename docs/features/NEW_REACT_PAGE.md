# Guide: Adding a New React Page

Read `frontend/src/features/analytics/channel/ChannelAnalytics.jsx` as a reference implementation before starting.

## Files to Create or Modify

| Action | File |
|---|---|
| Create | `frontend/src/features/myFeature/MyPage.jsx` |
| Modify | `frontend/src/App.jsx` (add lazy import + route) |
| Modify | `frontend/src/layout/Sidebar.jsx` (add nav link if needed) |
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

    if (loading) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    if (!account) {
        return <div className="p-6 text-muted-foreground">Account not found.</div>;
    }

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold">{account.title}</h1>
            <Card>
                <CardHeader>
                    <CardTitle>My Data</CardTitle>
                </CardHeader>
                <CardContent>
                    {/* content */}
                </CardContent>
            </Card>
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

## Step 3: Add Navigation in Sidebar.jsx

If the page appears in the sidebar (e.g., once per account):

```jsx
// In Sidebar.jsx, inside the per-account link generation
{
    title: 'My Feature',
    url: `/my-page/${account.id}`,
    icon: IconName,
}
```

## Step 4: Add API Methods

```js
// frontend/src/services/api.js
getMyData: (id) => request(`/accounts/${id}/my-data`),
```

## Conventions

- Use `useAppContext()` - don't re-fetch the accounts list, use what's in context
- Always handle loading and error states
- Use `Skeleton` components for loading state (not spinners - shadcn's Skeleton matches the page layout)
- Use semantic HTML for the page structure
- Wrap content in `className="p-6"` padding (matches existing pages)
- Use `space-y-6` or `space-y-4` for vertical rhythm between sections

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
        <div className="p-6">
            <p>Total views: {summary}</p>
        </div>
    );
}
```

## Accessibility Requirements

- The main heading (`h1`) should describe the page, not just "Details"
- Tables must have `<thead>` with column headers
- Loading state must be announced (Skeleton is visually recognizable; add `aria-busy` if needed)
- Interactive elements must be reachable by keyboard
