# Frontend Feature Modules

## Directory Map

```
frontend/src/
├── components/
│   ├── SurfaceBox.tsx, MetricBox.tsx, PageHeader.tsx, ...   <- Shared components, see DESIGN_SYSTEM.md
│   ├── MetricAreaChart.tsx                 <- Shared Intent UI area chart for single-metric comparisons
│   ├── ChartPanel.tsx, ChartFigure.tsx     <- Titled chart container with an empty state; the chart's screen-reader name and description
│   ├── ExactTooltip.tsx, DonutChart.tsx    <- Intent's tooltip with exact values; a ring for parts of a whole
│   ├── AccountSelect.tsx                   <- Instagram account picker with avatars (Publish, Automations)
│   ├── RowAction.tsx                       <- Icon button with a tooltip for table and list rows (Tracked content, Automations)
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
│   │   └── tracked/
│   │       ├── TrackedContent.tsx          <- Page: tracked YouTube videos
│   │       ├── TrackedMetrics.tsx, TrackedFilters.tsx, BulkCategoryBar.tsx, TrackedTable.tsx, TrackedRow.tsx, TrackedThumbnail.tsx
│   │       ├── AddTrackedDialog.tsx, EditTrackedDialog.tsx, CategoryPicker.tsx
│   │       ├── useTrackedItems.ts, useTrackedFilters.ts, useTrackedSelection.ts, useBulkCategory.ts
│   │       ├── useTrackedDelete.ts, useAddTracked.ts, useTrackedEditor.ts   <- Delete, add form and edit
│   │       ├── trackedList.ts              <- Pure sort, filter, stats and form helpers (trackedList.test.ts)
│   │       ├── TrackedCategory.tsx         <- Page: per-category analytics for tracked content
│   │       ├── CategoryYouTubeSection.tsx, NumberCell.tsx, OpenLink.tsx
│   │       └── trackedCategoryStats.ts     <- Pure per-category totals and labels (trackedCategoryStats.test.ts)
│   ├── accounts/
│   │   ├── AccountManager.tsx              <- Page: connected accounts by platform, refresh and remove
│   │   ├── AccountSection.tsx, AccountCard.tsx, AccountsEmptyState.tsx
│   │   ├── AddAccountDialog.tsx            <- Platform picker, per-platform fields and footer actions
│   │   ├── YouTubeAccountFields.tsx, AddAccountFooter.tsx
│   │   ├── useAddAccount.ts                <- Add dialog state; Back keeps typed fields, Cancel clears them
│   │   ├── useAccountRefresh.ts, useAccountDelete.ts
│   │   ├── useInstagramOAuthReturn.ts      <- Finishes a sign-in from #ig_code and #ig_state, reads ?ig_error and ?add, then clears them
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
│   │   ├── TypePicker.tsx, ScheduleToggle.tsx, ScheduleHint.tsx, IconInput.tsx, StatusBadge.tsx, NoInstagramAccount.tsx
│   │   ├── useSinglePostForm.ts, useSinglePostMedia.ts   <- Single post fields, file and cover
│   │   ├── useSinglePublish.ts, usePublishProgress.ts    <- Single post publish or schedule run
│   │   ├── useBulkSettings.ts, useBulkQueue.ts, useBulkPublish.ts   <- Bulk settings, file queue, upload loop
│   │   ├── useScheduledPosts.ts, useScheduledPostEdit.ts, useScheduledPostDelete.ts
│   │   ├── containerPolling.ts             <- Waits for an Instagram container (single post and bulk)
│   │   ├── singlePostFlow.ts               <- Single post Cloudinary upload, then publish or schedule
│   │   ├── publishConstants.ts             <- Content types, statuses, intervals, caption limit
│   │   └── publishHelpers.ts, scheduleHelpers.ts, queueHelpers.ts   <- Pure helpers with *.test.ts
│   ├── automations/
│   │   ├── Automations.tsx                 <- Page: server notices, counts, account controls, rules, activity
│   │   ├── AutomationNotices.tsx           <- Webhook not set up, or replies paused on the server
│   │   ├── AutomationMetrics.tsx, AutomationAccounts.tsx, AutomationRules.tsx, AutomationActivity.tsx
│   │   ├── RuleEditorPage.tsx              <- The rule editor at /automations/rules/new and /automations/rules/:id: sticky Save bar, draft, leave warning
│   │   ├── RuleMediaPicker.tsx, RulePublicReplies.tsx, RulePreview.tsx   <- Rule form (private and public reply sections), post picker, public wordings, thread and message preview, keyword test
│   │   ├── useAutomations.ts               <- Overview and every rule and account action, with toasts
│   │   ├── useAutomationActivity.ts        <- Filters, counts, activity pages and retry
│   │   ├── useRuleForm.ts                  <- Rule editor state, draft, field problems, the account's posts, the test call
│   │   └── automationData.ts               <- Pure status labels, filters, summary, form conversion and checks (automationData.test.ts)
│   ├── settings/
│   │   ├── Settings.tsx                    <- Page: loads server settings, then renders each section; keeps the #hash scroll
│   │   ├── SettingsSection.tsx, AppearanceSection.tsx, PasswordSection.tsx, ServerKeysSection.tsx, SchedulingSection.tsx
│   │   ├── PlatformRequirementsSection.tsx, UsefulLinksSection.tsx
│   │   ├── SchedulingSetupGuide.tsx        <- Optional GitHub backup scheduler steps for administrators
│   │   ├── SchedulingSetupSteps.tsx, SetupStep.tsx, GithubRepoForm.tsx, CopyChip.tsx, GuideLinkButton.tsx, RepoLinkButton.tsx
│   │   ├── useServerSettings.ts            <- Loads keys and the saved repository; saves the repository
│   │   ├── useApiHealthCheck.ts            <- Runs api.health() for the server keys section
│   │   ├── ClaudeSection.tsx               <- Settings, Claude: server address, Claude Code command, tokens, approved apps
│   │   ├── ClaudeTokenForm.tsx, ClaudeTokenList.tsx, ClaudeClientList.tsx, CopyField.tsx
│   │   ├── useClaudeAccess.ts              <- Loads the address, tokens and apps; creates and revokes tokens; removes apps
│   │   ├── claudeAccessData.ts             <- Pure load sequence, permission and expiry choices, the Claude Code command (claudeAccessData.test.ts)
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

The computed indices `viralityScore` and `consistencyScore` (YouTube and Instagram analytics) are labelled
**Virality** and **Consistency** in the UI, with the value's unit (`2.4x`, `78 of 100`) in place of the word
"score".

## Shared Chart Components

Charts are drawn with Intent UI's components in `components/ui` (`AreaChart`, `BarChart`; ADR-048)
inside the shared pieces below. Each chart is a figure with a screen-reader name and a hidden description of its
data; nothing extra is shown on screen.

| Component | Use it for |
|---|---|
| `ChartPanel` | A titled box around an Intent chart; pass the same `height` as the chart's `containerHeight` and a `description`. A string title names the figure |
| `MetricAreaChart` | One value across months, weeks or items; names itself and writes its own description unless given one |
| `DonutChart` | Parts of a whole as a ring, with the exact tooltip and a legend |
| `ExactTooltip` | The tooltip for every chart: `tooltip={<ExactTooltip />}` shows values in full |

```tsx
<ChartPanel title="Uploads by month" height={240} description={trendSummary(pointsOf(rows, 'month', 'uploads'), fmtNumFull, 'uploads')}>
  <BarChart data={rows} dataKey="month" config={{ uploads: { label: 'Uploads', color: SERIES.neutral } }} containerHeight={240} legend={false} tooltip={<ExactTooltip />} />
</ChartPanel>
```

`lib/chart.ts` has `pointsOf`, `trendSummary` and `rankingSummary` for the description. Intent's charts take
`data` as plain records, so rows typed by an interface are spread first (`rows.map(row => ({ ...row }))`).

## Shared Library Pieces

The library pages (Videos, Shorts, Instagram content, Tracked content) are built from the same parts:

| Piece | Job |
|---|---|
| `features/analytics/useLibrarySources.ts` | Loads one list per account, keyed on the account ids; returns the results, failed accounts, the oldest `fetchedAt`, `initialLoading`, `refreshing` and a `refresh` that asks for fresh data |
| `features/analytics/useLibraryParams.ts` | Search, filters, sort, layout and page in the address; a filter change returns to page 1 in one history step |
| `SearchField`, `FilterChips`, `SortSelect` | The controls, in that order, with the account select between search and sort |
| `ActiveFilters`, `NoResults`, `Pager` | Result count and removable filters, the no-match state that echoes the search, and the announced page range |
| `FailedSourcesAlert`, `DataFreshness`, `RefreshButton` | Accounts that failed to load, the data's age, and the one Refresh control |
| `lib/metricIcons.ts` | One icon per meaning (`METRIC_ICONS`, `IG_TYPE_ICONS`) |

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
| Overview | `/` | Aggregate KPIs across all connected accounts (YouTube, Instagram); six metric tabs, each with area charts |
| Accounts | `/accounts` | Connect/disconnect accounts (YouTube, Instagram) |
| Channel Analytics | `/channel/:id` | YouTube analytics for one channel |
| Instagram Analytics | `/instagram/:id` | Instagram analytics for one account |
| Tracked Content | `/tracked-content` | Monitor YouTube videos; add by link, assign categories, bulk edit, per-row refresh |
| Tracked Category | `/tracked-content/category/:name` | Detailed per-category analytics for its YouTube videos: views, likes, comments, area chart, table |
| Video Explorer | `/videos/:id` | YouTube video library with search and sort |
| Publish | `/publish` (`/upload` redirects) | Publish or schedule to Instagram, bulk upload, and the scheduled post queue |
| Automations | `/automations` | Keyword rules that answer Instagram comments with a private reply, a public reply under the comment or both, account pause and comment events, counts and the activity of both replies with separate retries (`docs/architecture/data-flows/AUTOMATION.md`) |
| Settings | `/settings` | Theme, server key status, who sets up scheduling, the optional GitHub backup guide |
| Documentation | `/docs/*` | Not a page in the app: `DocsRedirect` sends the visitor to the same path on the public docs at `https://twiligent.ujjwal.fyi/docs`. The Documentation item in the sidebar user menu and Open documentation in the command palette open the docs in a new tab |

## Adding a New Feature

1. Create `frontend/src/features/myFeature/MyPage.tsx`
2. Follow `docs/features/NEW_REACT_PAGE.md` for the component template
3. Add lazy import and route in `App.tsx`
4. Add a nav item to `NAV_GROUPS` in `layout/navigation.ts` if it's a top-level destination (accounts are listed in the sidebar automatically)
5. Add API methods in `api.ts` that return the response types from `shared/types/`, then run `npm run typecheck`
6. Update this file with the new entry in the Current Features table
