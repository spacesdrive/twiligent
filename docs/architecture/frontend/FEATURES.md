# Frontend Feature Modules

## Directory Map

```
frontend/src/
├── components/
│   ├── SurfaceBox.tsx, MetricBox.tsx, PageHeader.tsx, ...   <- Shared components, see DESIGN_SYSTEM.md
│   ├── MetricAreaChart.tsx                 <- Shared Recharts area chart for single-metric comparisons
│   ├── ChartPanel.tsx                      <- Titled chart container with an empty state
│   ├── ImageLightbox.tsx                   <- Thumbnail that opens the full image in a Dialog
│   └── DocsRedirect.tsx                    <- The /docs/* route: replaces the location with the same page on the public docs
├── lib/
│   └── docs.ts                             <- DOCS_URL and docsUrl(path): links from the app to the public docs
├── features/
│   ├── analytics/
│   │   ├── channel/
│   │   │   ├── ChannelAnalytics.tsx        <- Page: YouTube channel analytics with eight tabs
│   │   │   ├── ChannelOverviewTab.tsx, ChannelVideosTab.tsx, ChannelEngagementTab.tsx, ChannelContentTab.tsx
│   │   │   ├── ChannelPublishingTab.tsx, ChannelGrowthTab.tsx, ChannelShortsTab.tsx, ChannelTagsTab.tsx, TagCloud.tsx
│   │   │   ├── ChannelHeader.tsx, ChannelNoVideos.tsx, ChannelVideoTable.tsx, TrendArea.tsx, MetricGrid.tsx
│   │   │   ├── useChannelAnalytics.ts      <- Loads api.getAnalytics(id); returns data, loading and the reload
│   │   │   └── channelChartData.ts         <- Pure chart rows and labels (channelChartData.test.ts)
│   │   ├── instagram/
│   │   │   ├── InstagramAnalytics.tsx      <- Page: Instagram account analytics (loads through useAccountAnalytics)
│   │   │   ├── InstagramHeader.tsx, InstagramMetrics.tsx, InstagramInsightChips.tsx, TypeBadge.tsx
│   │   │   ├── InstagramEngagementCharts.tsx, InstagramPostCharts.tsx, InstagramHashtags.tsx, InstagramRecentGrid.tsx
│   │   │   ├── InstagramTopPostsTable.tsx, InstagramTypeSummaryTable.tsx
│   │   │   └── instagramAnalyticsData.ts   <- Pure chart rows and labels (instagramAnalyticsData.test.ts)
│   │   ├── overview/
│   │   │   ├── Overview.tsx                <- Page: cross-platform aggregate dashboard with six metric tabs
│   │   │   ├── OverviewHeader.tsx, QuickActions.tsx, GettingStarted.tsx, MetricTabsList.tsx
│   │   │   ├── AudienceTab.tsx, AudienceChart.tsx, ViewsTab.tsx, ContentTab.tsx, AccountsTab.tsx, CommentsTab.tsx, LikesTab.tsx
│   │   │   ├── InstagramViewsTable.tsx, YouTubeViewsTable.tsx, AccountCell.tsx, AccountRankRow.tsx, CategoryRow.tsx, OpenAnalytics.tsx
│   │   │   ├── useOverviewData.ts          <- Loads api.getOverview() and re-polls while accounts are syncing
│   │   │   ├── useOverviewStats.ts         <- Memoized totals, rankings and chart rows
│   │   │   └── overviewStats.ts, overviewTrackedStats.ts, overviewCharts.ts, overviewLabels.ts, greeting.ts   <- Pure helpers with *.test.ts
│   │   ├── reddit/
│   │   │   ├── RedditAnalytics.tsx         <- Page: Reddit account analytics (loads through useAccountAnalytics)
│   │   │   ├── RedditHeader.tsx, RedditKarmaSummary.tsx, RedditKarmaCharts.tsx, RedditStatPanels.tsx
│   │   │   ├── RedditTimingCharts.tsx, RedditSubredditTable.tsx, RedditTopPostsTable.tsx
│   │   │   ├── redditAnalyticsData.ts      <- Pure chart rows and stat lists (redditAnalyticsData.test.ts)
│   │   │   ├── RedditPosts.tsx             <- Per-account post explorer
│   │   │   ├── RedditPostsAll.tsx          <- Global post explorer (all Reddit accounts)
│   │   │   ├── RedditPostFilters.tsx, RedditPostTable.tsx   <- Filters and table shared by both post explorers
│   │   │   └── redditPostUtils.ts          <- Shared sort options, filtering and sorting
│   │   └── tracked/
│   │       ├── TrackedContent.tsx          <- Page: tracked Reddit posts and YouTube videos
│   │       ├── TrackedMetrics.tsx, TrackedFilters.tsx, BulkCategoryBar.tsx, TrackedTable.tsx, TrackedRow.tsx, TrackedThumbnail.tsx
│   │       ├── AddTrackedDialog.tsx, EditTrackedDialog.tsx, TrackedImageField.tsx, CategoryPicker.tsx, RowAction.tsx
│   │       ├── useTrackedItems.ts, useTrackedFilters.ts, useTrackedSelection.ts, useBulkCategory.ts
│   │       ├── useTrackedDelete.ts, useAddTracked.ts, useTrackedEditor.ts   <- Delete, add form, edit and image upload
│   │       ├── trackedList.ts              <- Pure sort, filter, stats and form helpers (trackedList.test.ts)
│   │       ├── TrackedCategory.tsx         <- Page: per-category analytics for tracked content
│   │       ├── CategoryYouTubeSection.tsx, CategoryRedditSection.tsx, NumberCell.tsx, OpenLink.tsx
│   │       └── trackedCategoryStats.ts     <- Pure per-category totals and labels (trackedCategoryStats.test.ts)
│   ├── accounts/
│   │   ├── AccountManager.tsx              <- Page: connected accounts by platform, refresh and remove
│   │   ├── AccountSection.tsx, AccountCard.tsx, AccountsEmptyState.tsx
│   │   ├── AddAccountDialog.tsx            <- Platform picker, per-platform fields and footer actions
│   │   ├── YouTubeAccountFields.tsx, RedditAccountFields.tsx, AddAccountFooter.tsx
│   │   ├── useAddAccount.ts                <- Add dialog state; Back keeps typed fields, Cancel clears them
│   │   ├── useAccountRefresh.ts, useAccountDelete.ts
│   │   ├── useInstagramOAuthReturn.ts      <- Reads ?ig_connected, ?ig_error and ?add once, then clears them
│   │   ├── platformChoices.ts              <- Platform choice titles, descriptions and icons
│   │   └── accountManagerData.ts           <- Pure OAuth return, error text, card metrics (accountManagerData.test.ts)
│   ├── publishing/
│   │   ├── UploadContent.tsx               <- Page: tabs, Cloudinary alert, scheduled posts (default export)
│   │   ├── SinglePostTab.tsx               <- Single post form or its progress view
│   │   ├── MediaPicker.tsx, CaptionBox.tsx, SinglePostSettings.tsx, ReelOptions.tsx, ScheduleFields.tsx, PostSummary.tsx
│   │   ├── PublishProgress.tsx, PublishResult.tsx   <- Upload, processing, done, scheduled and error states
│   │   ├── BulkUploadTab.tsx               <- Bulk queue, results and settings
│   │   ├── BulkFileList.tsx, BulkFileItem.tsx, BulkResults.tsx, BulkSettings.tsx, BulkScheduleFields.tsx
│   │   ├── ScheduledPostsSection.tsx       <- Scheduled post table with filters and the overdue alert
│   │   ├── ScheduledPostRow.tsx, ScheduledPostEditRow.tsx, ScheduledPostDialogs.tsx, OverdueAlert.tsx
│   │   ├── AccountSelect.tsx, TypePicker.tsx, ScheduleToggle.tsx, ScheduleHint.tsx, IconInput.tsx, StatusBadge.tsx, NoInstagramAccount.tsx
│   │   ├── useSinglePostForm.ts, useSinglePostMedia.ts   <- Single post fields, file and cover
│   │   ├── useSinglePublish.ts, usePublishProgress.ts    <- Single post publish or schedule run
│   │   ├── useBulkSettings.ts, useBulkQueue.ts, useBulkPublish.ts   <- Bulk settings, file queue, upload loop
│   │   ├── useScheduledPosts.ts, useScheduledPostEdit.ts, useScheduledPostDelete.ts
│   │   ├── containerPolling.ts             <- Waits for an Instagram container (single post and bulk)
│   │   ├── singlePostFlow.ts               <- Single post Cloudinary upload, then publish or schedule
│   │   ├── publishConstants.ts             <- Content types, statuses, intervals, caption limit
│   │   └── publishHelpers.ts, scheduleHelpers.ts, queueHelpers.ts   <- Pure helpers with *.test.ts
│   ├── settings/
│   │   ├── Settings.tsx                    <- Page: loads server settings, then renders each section; keeps the #hash scroll
│   │   ├── SettingsSection.tsx, AppearanceSection.tsx, PasswordSection.tsx, ServerKeysSection.tsx, SchedulingSection.tsx
│   │   ├── PlatformRequirementsSection.tsx, UsefulLinksSection.tsx
│   │   ├── SchedulingSetupGuide.tsx        <- Optional GitHub backup scheduler steps for administrators
│   │   ├── SchedulingSetupSteps.tsx, SetupStep.tsx, GithubRepoForm.tsx, CopyChip.tsx, GuideLinkButton.tsx, RepoLinkButton.tsx
│   │   ├── useServerSettings.ts            <- Loads keys and the saved repository; saves the repository
│   │   ├── useApiHealthCheck.ts            <- Runs api.health() for the server keys section
│   │   ├── settingsData.ts                 <- Pure load sequence (api injected), links, health text (settingsData.test.ts)
│   │   └── schedulingProgress.ts           <- Pure guide progress in localStorage (schedulingProgress.test.ts)
│   ├── analytics/videos/
│   │   ├── VideoExplorer.tsx               <- Page: YouTube video library with filtering
│   │   ├── VideoFilters.tsx, LayoutToggle.tsx, VideoListTable.tsx, VideoSortHeader.tsx, VideoGrid.tsx
│   │   ├── useChannelVideos.ts             <- Loads every channel's videos; shared with Shorts
│   │   └── videoLibrary.ts                 <- Pure channel merge, filter, sort and totals (videoLibrary.test.ts)
│   ├── analytics/shorts/
│   │   ├── ShortsExplorer.tsx              <- Page: YouTube Shorts (60 seconds or less)
│   │   ├── ShortsFilters.tsx, ShortsGrid.tsx
│   │   └── shortsLibrary.ts                <- Pure Shorts selection, filter, sort and description (shortsLibrary.test.ts)
│   └── analytics/reels/
│       ├── ReelsExplorer.tsx               <- Page: Instagram reels, posts and videos
│       ├── ReelsMetrics.tsx, ReelsFilters.tsx, ReelsGrid.tsx
│       ├── useInstagramMedia.ts            <- Loads media from every Instagram account
│       └── reelsLibrary.ts                 <- Pure merge, filter, sort and totals (reelsLibrary.test.ts)
```

Test files are not in this tree. A `(name.test.ts)` or `with *.test.ts` note above means the helper has a test in `frontend/tests/` at the mirrored path: `src/features/analytics/channel/channelChartData.ts` is covered by `frontend/tests/features/analytics/channel/channelChartData.test.ts`. See `docs/workflows/TESTING.md`.

The user and self-hosting documentation is not part of the app. It lives in the `site/` workspace and is served at `https://twiligent.ujjwal.fyi/docs`; see `docs/architecture/site/SITE.md`.

## Metric Naming

Reddit exposes a post's net upvotes as `score` in its JSON API. In the UI this is always
labelled **karma**, never "score", so it matches the vocabulary Reddit shows its own users.
The raw `score` field name is kept when reading API responses; every aggregate derived from
it is named `karma` (`rdKarma`, `avgKarma`, `redditKarma`).

"Virality Score" and "Consistency Score" are separate computed indices, not karma, and keep
the word "score".

## Shared Chart Component

`components/MetricAreaChart.tsx` renders a single-series area chart with the project's axis,
grid, gradient, and tooltip styling. Use it instead of hand-rolling a Recharts `AreaChart`:

```tsx
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

`components/ImageLightbox.tsx` renders a thumbnail that opens the full image in a shadcn
`Dialog`. Used for tracked Reddit post images, which have no platform thumbnail:

```tsx
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
features/ChannelAnalytics.tsx <- wrong (flat, not grouped)
```

### One page component per file

Each feature directory has one routable page component, exported as default from a `PascalCase.tsx` file. It is lazy-imported in `App.tsx` and mapped to a URL path. Sub-components, hooks and pure helpers that serve only that page live in the same directory:

```
features/analytics/channel/
  ChannelAnalytics.tsx         <- page (exported as default)
  ChannelHeader.tsx            <- sub-component used only here (props typed by ChannelHeaderProps)
  useChannelAnalytics.ts       <- hook used only here (.ts: no JSX)
  channelChartData.ts          <- pure helper, tested from frontend/tests/
```

Shared components used across multiple features go in `components/ui/` (shadcn primitives) or `components/` (project components such as `PageHeader` and `MetricBox`).

### Page components receive no props

Pages are entry points from the router. They get their context from `useAppContext()` and URL params from `useParams()`. They are never rendered as child components by other pages.

### Feature state is local

Each page manages its own loading/data/error state. Pages do not write to `AppContext` - the context is for account list and toast only. If you need shared state between two pages, it belongs in the URL (query params or route params), not in context.

### Naming

- Page files: `PascalCase.tsx` matching the feature name - `ChannelAnalytics.tsx`, `UploadContent.tsx`
- Sub-components: `PascalCase.tsx` named for what they render, with a `<Component>Props` interface - `ChannelHeader.tsx`, `ReelsGrid.tsx`
- Hooks: `useCamelCase.ts` - `useChannelAnalytics.ts`; export the result type when callers need it
- Pure helpers: `camelCase.ts` with no JSX, so Node tests can import them - `channelChartData.ts`
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
| Documentation | `/docs/*` | Not a page in the app: `DocsRedirect` sends the visitor to the same path on the public docs at `https://twiligent.ujjwal.fyi/docs`. The Documentation item in the sidebar user menu and Open documentation in the command palette open the docs in a new tab |

## Adding a New Feature

1. Create `frontend/src/features/myFeature/MyPage.tsx`
2. Follow `docs/features/NEW_REACT_PAGE.md` for the component template
3. Add lazy import and route in `App.tsx`
4. Add a nav item to `NAV_GROUPS` in `layout/navigation.ts` if it's a top-level destination (accounts are listed in the sidebar automatically)
5. Add API methods in `api.ts` that return the response types from `shared/types/`, then run `npm run typecheck`
6. Update this file with the new entry in the Current Features table
