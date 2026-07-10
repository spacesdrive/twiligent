# Frontend Feature Modules

## Directory Map

```
frontend/src/
├── features/
│   ├── analytics/
│   │   ├── channel/
│   │   │   └── ChannelAnalytics.jsx        ← YouTube channel analytics
│   │   ├── instagram/
│   │   │   └── InstagramAnalytics.jsx      ← Instagram account analytics
│   │   └── overview/
│   │       └── Overview.jsx                ← Cross-platform aggregate dashboard
│   ├── accounts/
│   │   └── Accounts.jsx                    ← Add/remove connected accounts
│   ├── publish/
│   │   └── Publish.jsx                     ← Instagram immediate publish
│   ├── schedule/
│   │   └── Schedule.jsx                    ← Instagram scheduled posts queue
│   ├── settings/
│   │   └── Settings.jsx                    ← GitHub PAT and other settings
│   └── videos/
│       └── VideoExplorer.jsx               ← YouTube video library with filtering
```

## Feature Conventions

### One directory per feature domain

Each top-level directory under `features/` represents a product area. Sub-directories represent per-platform views within that area.

```
features/analytics/youtube/   ← correct
features/ChannelAnalytics.jsx ← wrong (flat, not grouped)
```

### One page component per file

Each `.jsx` file in `features/` is a routable page. It is lazy-imported in `App.jsx` and mapped to a URL path. Shared sub-components that appear only on that page live in the same directory:

```
features/analytics/channel/
  ChannelAnalytics.jsx         ← page (exported as default)
  VideoCard.jsx                ← sub-component used only here
  useChannelData.js            ← hook used only here
```

Shared components used across multiple features go in `components/` (shadcn UI pieces) or `components/shared/` (custom cross-feature pieces).

### Page components receive no props

Pages are entry points from the router. They get their context from `useAppContext()` and URL params from `useParams()`. They are never rendered as child components by other pages.

### Feature state is local

Each page manages its own loading/data/error state. Pages do not write to `AppContext` — the context is for account list and toast only. If you need shared state between two pages, it belongs in the URL (query params or route params), not in context.

### Naming

- Page files: `PascalCase.jsx` matching the feature name — `ChannelAnalytics.jsx`, `Schedule.jsx`
- Sub-components: `PascalCase.jsx` named for what they render — `VideoCard.jsx`, `StatRow.jsx`
- Hooks: `camelCase.js` with `use` prefix — `useChannelData.js`
- Directories: `camelCase` matching the feature — `analytics/channel/`, `publish/`

## Current Features

| Feature | Path | Description |
|---|---|---|
| Overview | `/` | Aggregate KPIs across all connected accounts |
| Accounts | `/accounts` | Connect/disconnect social accounts |
| Channel Analytics | `/channel/:id` | YouTube analytics for one channel |
| Instagram Analytics | `/instagram/:id` | Instagram analytics for one account |
| Video Explorer | `/videos/:id` | YouTube video library with search and sort |
| Publish | `/publish/:id` | Publish a post to Instagram immediately |
| Schedule | `/schedule/:id` | View and manage the scheduled post queue |
| Settings | `/settings` | GitHub PAT and platform settings |

## Adding a New Feature

1. Create `frontend/src/features/myFeature/MyPage.jsx`
2. Follow `docs/features/NEW_REACT_PAGE.md` for the component template
3. Add lazy import and route in `App.jsx`
4. Add sidebar link in `Sidebar.jsx` if it's a top-level destination or per-account page
5. Add API methods in `api.js`
6. Update this file with the new entry in the Current Features table
