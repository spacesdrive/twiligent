# Frontend Feature Modules

## Directory Map

```
frontend/src/
├── components/
│   ├── SurfaceBox.jsx, MetricBox.jsx, PageHeader.jsx, ...   <- Shared components, see DESIGN_SYSTEM.md
│   ├── MetricAreaChart.jsx                 <- Shared Recharts area chart for single-metric comparisons
│   ├── ChartPanel.jsx                      <- Titled chart container with an empty state
│   └── ImageLightbox.jsx                   <- Thumbnail that opens the full image in a Dialog
├── docs/                                   <- Public documentation at /docs (outside the feature tree: no auth, no AppContext)
│   ├── DocsLayout.jsx                      <- Header, tabs, sidebar, outline, search, previous and next
│   ├── components.jsx                      <- DocTitle, H2, H3, Callout, Steps, CodeBlock, Table, PathCards, Badge
│   ├── nav.js                              <- Tabs, groups and pages; the single source for navigation
│   ├── routes.js                           <- Slug to lazy page map; nav.test.js checks it matches nav.js
│   └── pages/                              <- Overview, Use, SelfHost, Reference (one chunk each)
├── features/
│   ├── analytics/
│   │   ├── channel/
│   │   │   └── ChannelAnalytics.jsx        <- YouTube channel analytics
│   │   ├── instagram/
│   │   │   ├── InstagramAnalytics.jsx      <- Page: Instagram account analytics (loads through useAccountAnalytics)
│   │   │   ├── InstagramHeader.jsx, InstagramMetrics.jsx, InstagramInsightChips.jsx, TypeBadge.jsx
│   │   │   ├── InstagramEngagementCharts.jsx, InstagramPostCharts.jsx, InstagramHashtags.jsx, InstagramRecentGrid.jsx
│   │   │   ├── InstagramTopPostsTable.jsx, InstagramTypeSummaryTable.jsx
│   │   │   └── instagramAnalyticsData.js   <- Pure chart rows and labels (instagramAnalyticsData.test.js)
│   │   ├── overview/
│   │   │   ├── Overview.jsx                <- Page: cross-platform aggregate dashboard with six metric tabs
│   │   │   ├── OverviewHeader.jsx, QuickActions.jsx, GettingStarted.jsx, MetricTabsList.jsx
│   │   │   ├── AudienceTab.jsx, AudienceChart.jsx, ViewsTab.jsx, ContentTab.jsx, AccountsTab.jsx, CommentsTab.jsx, LikesTab.jsx
│   │   │   ├── InstagramViewsTable.jsx, YouTubeViewsTable.jsx, AccountCell.jsx, AccountRankRow.jsx, CategoryRow.jsx, OpenAnalytics.jsx
│   │   │   ├── useOverviewData.js          <- Loads api.getOverview() and re-polls while accounts are syncing
│   │   │   ├── useOverviewStats.js         <- Memoized totals, rankings and chart rows
│   │   │   └── overviewStats.js, overviewCharts.js, overviewLabels.js, greeting.js   <- Pure helpers with *.test.js
│   │   ├── reddit/
│   │   │   ├── RedditAnalytics.jsx         <- Page: Reddit account analytics (loads through useAccountAnalytics)
│   │   │   ├── RedditHeader.jsx, RedditKarmaSummary.jsx, RedditKarmaCharts.jsx, RedditStatPanels.jsx
│   │   │   ├── RedditTimingCharts.jsx, RedditSubredditTable.jsx, RedditTopPostsTable.jsx
│   │   │   ├── redditAnalyticsData.js      <- Pure chart rows and stat lists (redditAnalyticsData.test.js)
│   │   │   ├── RedditPosts.jsx             <- Per-account post explorer
│   │   │   ├── RedditPostsAll.jsx          <- Global post explorer (all Reddit accounts)
│   │   │   ├── redditPostTable.jsx         <- Filters and table shared by both post explorers
│   │   │   └── redditPostUtils.js          <- Shared sort options, filtering and sorting
│   │   └── tracked/
│   │       ├── TrackedContent.jsx          <- Page: tracked Reddit posts and YouTube videos
│   │       ├── TrackedMetrics.jsx, TrackedFilters.jsx, BulkCategoryBar.jsx, TrackedTable.jsx, TrackedRow.jsx, TrackedThumbnail.jsx
│   │       ├── AddTrackedDialog.jsx, EditTrackedDialog.jsx, TrackedImageField.jsx, CategoryPicker.jsx, RowAction.jsx
│   │       ├── useTrackedItems.js, useTrackedFilters.js, useTrackedSelection.js, useBulkCategory.js
│   │       ├── useTrackedDelete.js, useAddTracked.js, useTrackedEditor.js   <- Delete, add form, edit and image upload
│   │       ├── trackedList.js              <- Pure sort, filter, stats and form helpers (trackedList.test.js)
│   │       ├── TrackedCategory.jsx         <- Page: per-category analytics for tracked content
│   │       ├── CategoryYouTubeSection.jsx, CategoryRedditSection.jsx, NumberCell.jsx, OpenLink.jsx
│   │       └── trackedCategoryStats.js     <- Pure per-category totals and labels (trackedCategoryStats.test.js)
│   ├── accounts/
│   │   └── AccountManager.jsx              <- Add/remove connected accounts
│   ├── publishing/
│   │   ├── UploadContent.jsx               <- Page: tabs, Cloudinary alert, scheduled posts (default export)
│   │   ├── SinglePostTab.jsx               <- Single post form or its progress view
│   │   ├── MediaPicker.jsx, CaptionBox.jsx, SinglePostSettings.jsx, ReelOptions.jsx, ScheduleFields.jsx, PostSummary.jsx
│   │   ├── PublishProgress.jsx, PublishResult.jsx   <- Upload, processing, done, scheduled and error states
│   │   ├── BulkUploadTab.jsx               <- Bulk queue, results and settings
│   │   ├── BulkFileList.jsx, BulkFileItem.jsx, BulkResults.jsx, BulkSettings.jsx, BulkScheduleFields.jsx
│   │   ├── ScheduledPostsSection.jsx       <- Scheduled post table with filters and the overdue alert
│   │   ├── ScheduledPostRow.jsx, ScheduledPostEditRow.jsx, ScheduledPostDialogs.jsx, OverdueAlert.jsx
│   │   ├── AccountSelect.jsx, TypePicker.jsx, ScheduleToggle.jsx, ScheduleHint.jsx, IconInput.jsx, StatusBadge.jsx, NoInstagramAccount.jsx
│   │   ├── useSinglePostForm.js, useSinglePostMedia.js   <- Single post fields, file and cover
│   │   ├── useSinglePublish.js, usePublishProgress.js    <- Single post publish or schedule run
│   │   ├── useBulkSettings.js, useBulkQueue.js, useBulkPublish.js   <- Bulk settings, file queue, upload loop
│   │   ├── useScheduledPosts.js, useScheduledPostEdit.js, useScheduledPostDelete.js
│   │   ├── igPublishFlow.js                <- Cloudinary upload, container polling, single post publish steps
│   │   ├── publishConstants.js             <- Content types, statuses, intervals, caption limit
│   │   └── publishHelpers.js, scheduleHelpers.js, queueHelpers.js   <- Pure helpers with *.test.js
│   ├── settings/
│   │   ├── Settings.jsx                    <- Theme, server keys, scheduling, platform requirements, links
│   │   └── SchedulingSetupGuide.jsx        <- Optional GitHub backup scheduler steps for administrators
│   ├── analytics/videos/
│   │   ├── VideoExplorer.jsx               <- YouTube video library with filtering
│   │   └── useChannelVideos.js             <- Loads every channel's videos; shared with Shorts
│   ├── analytics/shorts/ShortsExplorer.jsx <- YouTube Shorts (60 seconds or less)
│   └── analytics/reels/ReelsExplorer.jsx   <- Instagram reels, posts and videos
```

## Metric Naming

Reddit exposes a post's net upvotes as `score` in its JSON API. In the UI this is always
labelled **karma**, never "score", so it matches the vocabulary Reddit shows its own users.
The raw `score` field name is kept when reading API responses; every aggregate derived from
it is named `karma` (`rdKarma`, `avgKarma`, `redditKarma`).

"Virality Score" and "Consistency Score" are separate computed indices, not karma, and keep
the word "score".

## Shared Chart Component

`components/MetricAreaChart.jsx` renders a single-series area chart with the project's axis,
grid, gradient, and tooltip styling. Use it instead of hand-rolling a Recharts `AreaChart`:

```jsx
<MetricAreaChart
  data={[{ name: 'Item', karma: 42 }]}
  dataKey="karma"
  label="Karma"
  color={SERIES.warm}   // from @/lib/chart
  emptyMessage="Track content to compare karma"
/>
```

Each instance generates its own gradient id via `useId()`, so multiple charts on one page
never collide.

## Image Lightbox

`components/ImageLightbox.jsx` renders a thumbnail that opens the full image in a shadcn
`Dialog`. Used for tracked Reddit post images, which have no platform thumbnail:

```jsx
<ImageLightbox src={item.imageUrl} alt={item.title} thumbClassName="size-14" />
```

Base UI supports nested dialogs, so this works inside the Tracked Content edit dialog. Child
dialogs skip the backdrop and only the topmost one responds to Escape and outside clicks.

Note the Base UI composition rule: the trigger takes a `render` prop, not `asChild`.

## Feature Conventions

### One directory per feature domain

Each top-level directory under `features/` represents a product area. Sub-directories represent per-platform views within that area.

```
features/analytics/youtube/   <- correct
features/ChannelAnalytics.jsx <- wrong (flat, not grouped)
```

### One page component per file

Each `.jsx` file in `features/` is a routable page. It is lazy-imported in `App.jsx` and mapped to a URL path. Shared sub-components that appear only on that page live in the same directory:

```
features/analytics/channel/
  ChannelAnalytics.jsx         <- page (exported as default)
  VideoCard.jsx                <- sub-component used only here
  useChannelData.js            <- hook used only here
```

Shared components used across multiple features go in `components/` (shadcn UI pieces) or `components/shared/` (custom cross-feature pieces).

### Page components receive no props

Pages are entry points from the router. They get their context from `useAppContext()` and URL params from `useParams()`. They are never rendered as child components by other pages.

### Feature state is local

Each page manages its own loading/data/error state. Pages do not write to `AppContext` - the context is for account list and toast only. If you need shared state between two pages, it belongs in the URL (query params or route params), not in context.

### Naming

- Page files: `PascalCase.jsx` matching the feature name - `ChannelAnalytics.jsx`, `Schedule.jsx`
- Sub-components: `PascalCase.jsx` named for what they render - `VideoCard.jsx`, `StatRow.jsx`
- Hooks: `camelCase.js` with `use` prefix - `useChannelData.js`
- Directories: `camelCase` matching the feature - `analytics/channel/`, `publish/`

## Current Features

| Feature | Path | Description |
|---|---|---|
| Overview | `/` | Aggregate KPIs across all connected accounts (YouTube, Instagram, Reddit); six metric tabs, each with area charts |
| Accounts | `/accounts` | Connect/disconnect accounts (YouTube, Instagram, Reddit) |
| Channel Analytics | `/channel/:id` | YouTube analytics for one channel |
| Instagram Analytics | `/instagram/:id` | Instagram analytics for one account |
| Reddit Analytics | `/reddit/:id` | Reddit analytics for one account - karma breakdown, score timeline, post type distribution, day/hour analysis, subreddit breakdown, top posts |
| Reddit Posts (global) | `/reddit-posts` | Combined post explorer across all Reddit accounts with account and subreddit filters |
| Reddit Posts (per account) | `/reddit-posts/:id` | Searchable and sortable post list for a single Reddit account |
| Tracked Content | `/tracked-content` | Monitor Reddit posts and YouTube videos; add by URL, assign categories, bulk edit, per-row refresh |
| Tracked Category | `/tracked-content/category/:name` | Detailed per-category analytics; YouTube section (views, likes, comments, bar chart, table) and Reddit section (score, ratio, comments, bar chart, table) rendered separately |
| Video Explorer | `/videos/:id` | YouTube video library with search and sort |
| Publish | `/upload` | Publish or schedule to Instagram, bulk upload, and the scheduled post queue |
| Settings | `/settings` | Theme, server key status, who sets up scheduling, the optional GitHub backup guide |
| Documentation | `/docs` | Public guides for members and administrators, and the environment variable reference |

## Adding a New Feature

1. Create `frontend/src/features/myFeature/MyPage.jsx`
2. Follow `docs/features/NEW_REACT_PAGE.md` for the component template
3. Add lazy import and route in `App.jsx`
4. Add sidebar link in `Sidebar.jsx` if it's a top-level destination or per-account page
5. Add API methods in `api.js`
6. Update this file with the new entry in the Current Features table
