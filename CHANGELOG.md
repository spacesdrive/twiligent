# Changelog

All notable changes to Twiligent are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added

- Automations: a private reply on Instagram to anyone who comments a keyword on your posts or reels, from rules with keywords, a reply and a link, aimed at every post or chosen ones, with a preview and a test that sends nothing (#87, #90)
- A signed Instagram comments webhook that stores every comment before answering Meta, sends matched replies within seconds and retries, waits out limits and recovers stopped runs without sending a reply twice (#89, ADR-040)
- Reply limits per hour for the instance, each member, each Instagram account and each rule, and per day for each person, with a cooldown when Instagram limits the account; `AUTOMATION_PAUSED` holds every reply (#89)
- The Automations page shows each account's state with pause and resume, counts for the period, and the activity of every comment with its status and a retry (#90)
- New tables `automation_accounts`, `automation_rules`, `automation_comments`, `automation_attempts` and `audit_events`, and their functions; existing instances run `npm run db:push` before deploying (#88)
- An audit record of connecting, reconnecting and removing accounts and of every automation change, kept a year (#89)
- Every migration now holds one database entity (a table, its access, a trigger, an index or a function) with a rollback of the same size, and the migration test enforces it for new migrations (#93, ADR-041)
- Automation rules can answer any comment, with no keyword; the most specific rule answers, so a comment still gets one reply (#102)
- Followers-only rules, in testing and not yet tried with a real account: the first reply asks the person to follow and reply, and the link goes out only when Instagram confirms they follow; nothing is sent when Instagram cannot say (#103, #105, ADR-043)
- A new every-minute cron trigger dispatches waiting replies and follow-ups, and the five minute runs off the quarter hour expire overdue replies, look for replies whose answer was lost in the conversation on Instagram, and log the queue's health (#99, #100, ADR-043)
- New table `automation_followups` and new columns and functions for the reply queue; existing instances run `npm run db:push` before deploying (#99, #100, #102, #103)
- Public replies: a rule can also post a public reply under the comment, or only that, with up to five wordings that rotate per comment; the private and public replies have their own status, limits, cooldown and retry, and one failing never sends the other again (#107, ADR-044)
- A public reply whose answer was lost is looked for among the comment's replies and posted again once only when it is not there; `AUTOMATION_PUBLIC_ACCOUNT_HOURLY_LIMIT` (default 60) paces public replies, and each person gets at most one per post a day (#107)
- New table `automation_public_replies` and new columns and functions; existing instances run `npm run db:push` before deploying (#107)
- `GET /api/health/ready`, a readiness check for monitors: it confirms the Supabase secrets are set and the database answers, and reports how long the database took (#110)
- A recovery runbook, `docs/workflows/RECOVERY.md`: finding a failed request, pausing automation, rolling back, and backing up and restoring the database (#114)
- When YouTube, Instagram or Reddit fails five times in a row, Twiligent stops calling it for 30 seconds and answers at once that it is not answering, instead of waiting on every request; scheduled posts that meet it are retried (#117, ADR-045)
- A unique index on accounts, so adding the same account twice at the same moment stores it once; existing instances run `npm run db:push` (#116)
- A shorter README with animated recordings of each main page, made with Flute from the real pages and made-up data, that points to the docs for everything else; the old screenshots are removed (#119)
- `supabase/schemas/`, the schema as it stands with one file per table and function, generated from the database by the new `npm run db:schema`; the migration test checks it names the same objects as the migrations (#122, ADR-046)
- Every migration and rollback opens with one plain sentence that says what it does, and the migration test checks real UTC versions and a verb at the start of each name; only comments changed in the applied files (#122, #124)

### Changed

- Connecting an Instagram account that is already connected renews its token instead of answering that it is already added, so a revoked token can be fixed without removing the account (#89)
- The Worker's publishing cron runs every 5 minutes instead of 15; posts still publish on the quarter hour, and the other runs check the reply queue (#89, #100)
- The reply queue sends up to 10 replies a minute instead of 10 every five minutes, accounts take turns so one busy reel cannot hold back another account, and paused, cooling or limited accounts are no longer claimed and put back on every run (#99)
- The daily retention deletes old comments in batches of 1,000 instead of one statement (#101)
- A database call that does not answer within 15 seconds now fails as a database error, so a hung query can no longer hold a request until its deadline (#112)
- Error and log text also hides Bearer tokens and token-like parameters, not only URLs (#113)

### Fixed

- The sign-in page opens the dashboard when you are already signed in, so the public site's Sign in and Get started buttons no longer ask you to sign in again (#94)
- The public site's home page opens the dashboard when you are signed in to the app; the docs stay readable (#96)
- Runs claiming replies at the same moment no longer leave each other with nothing to send while jobs wait (#99)
- A missing `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` or `SUPABASE_ANON_KEY` now answers 503 naming the secret instead of an internal error, and a cron run logs it and stops (#111)

---

## [1.2.0] - 2026-10-16

### Added

- The database layout is kept as versioned migrations in `supabase/migrations/`, applied with the Supabase CLI, with the reverse of each change in `supabase/rollbacks/`; existing instances run `npm run db:push` before deploying this version, and the setup SQL in the README and docs is replaced by the same command (#74, ADR-038)
- `npm run db:new`, `db:status`, `db:check` and `db:push` create, list, preview and apply migrations (#74)

### Changed

- The database now refuses values the app never writes: an unknown platform, post status or tracked item type, a YouTube tracked item with an account, or a post marked Publishing without a claim time (#77)
- Every table has an `updated_at` time that the database keeps current (#77)
- Removing an account also removes its scheduled posts, published ones included; tracked items stay and lose only the account (#76)
- Account, scheduled post and tracked item lists are served by indexes that match their order, and the schedulers read only pending and publishing posts (#78)
- New accounts, scheduled posts and tracked items get random ids that cannot be worked out from another one (#80)

### Fixed

- Security: a signed-in member could read their stored Instagram tokens and Reddit cookies and write rows directly through Supabase's public API; the tables and database functions are now closed to the browser (#75)
- Security: a scheduled post could name another member's Instagram account, and the scheduler would publish to it; the account must now be one of your own Instagram accounts (#76)
- Changing a tracked item's account now only accepts one of your own Reddit accounts, and refuses an account on a YouTube item (#76)
- A token refresh and an analytics refresh on the same account at the same moment no longer put the old access token back, and a manual view count no longer disappears when a refresh lands at the same time (#79)
- Accounts are listed in the order they were added, the same on every load (#78)
- CI and the deploys no longer fail when npm skips a platform binary during the install; every workflow checks the platform packages after `npm ci` and installs once more if one is missing (#82)
- Security: hono in the Worker and react-router in the app and the site are updated to versions without known vulnerabilities; Wrangler moves to 4 and the shadcn CLI to 4.21.5, which clears every audit finding that has a fix (#83, ADR-039)

---

## [1.1.1] - 2026-10-15

### Fixed

- The docs home at `/docs` shows the Introduction page again; before, it showed the docs frame with an empty page
- A scheduled post no longer stays in Publishing for ever when a publishing run stops halfway; the next run takes it over 20 minutes later (#63)
- A scheduled post that reached Instagram is no longer marked failed when Instagram's reply is lost; the scheduler saves the Instagram container and checks it before deciding or publishing again, so the post is not published twice (#64)
- A passing problem, such as a timeout or a temporary Instagram error, no longer fails a scheduled post at once; it goes back to Pending and is tried on the next two runs, and the row shows "Trying again on the next run" (#64)
- The app and docs no longer promise that the GitHub backup publishes within 15 minutes; GitHub often starts these runs hours late, and the server's own scheduler is the one that publishes within 15 minutes (#65)
- Deleting or editing a scheduled post at the moment a scheduler claims it can no longer remove or change a post that is being published (#66)
- The overdue alert in Publish also counts posts stuck in Publishing for more than 50 minutes, and counts a retried post from its last attempt (#63)

### Changed

- `scheduled_posts` has two new columns, `claimed_at` and `attempts`, and the two indexes the schema always listed; existing instances run the upgrade SQL in the Supabase SQL editor before deploying (ADR-037)
- The GitHub Actions scheduler runs at minutes 7, 22, 37 and 52, one run at a time, with a 14 minute limit; a private copy uses `7,37 * * * *` (#65)

---

## [1.1.0] - 2026-10-15

### Added

**Public website and docs site**
- A marketing site at `https://twiligent.ujjwal.fyi` that explains what Twiligent does, with product previews, platform and FAQ sections, and Sign in and Get started buttons that open the app
- The docs now live on the same site at `/docs`, written in MDX: section tabs, a grouped sidebar, an "On this page" outline, previous and next links, highlighted code blocks, and Suggest edits and Raise issue links on every page
- Full-text docs search with Ctrl K (Cmd K on a Mac); the index is built with the site and opens results at the matching section
- A light and dark theme toggle that follows the system setting until you choose, and remembers the choice
- Product previews that play while on screen: a cursor schedules an Instagram Reel step by step, reads a channel's growth chart and opens Shorts and regular, and each feature card shows one live detail (a new account row, the Worker's request log, a GitHub run, a filter click, a tracked link)
- Smooth area charts drawn at real size, with numbers that count up
- `sitemap.xml`, `llms.txt` and `robots.txt` for search engines and AI tools
- A new `site/` workspace with `npm run dev:site`, its own tests, and a deploy workflow for the `twiligent-site` Pages project (ADR-035)

**API rate limiting**
- Every API request is rate limited: per network before sign-in is checked, per user after it, and tighter on actions that use YouTube, Instagram or Reddit quota (adding accounts, refreshing, the scheduler trigger) and on Instagram publishing
- Token bucket, leaking bucket, fixed window, sliding window log and sliding window counter algorithms, counted atomically in Redis with Lua scripts and per server instance in memory when Redis is not configured or not reachable
- Requests over a limit get `429` with `Retry-After` and a message that says when to try again; every response carries `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset`

**Issue tracking for every change**
- Every task is tracked by a GitHub issue that is opened before work starts and closed when it is complete; commits reference it with `Refs #N` or `Closes #N`
- Issue templates, a pull request template and `docs/workflows/ISSUES.md` describe the lifecycle, labels and `gh` commands
- `ROADMAP.md` now starts with the project goals and links in-progress items to their issues

**Passwords for every account**
- Settings has a Password section to set or change the password; for an account that joined with Google it adds a password to the same account
- Forgot password on the sign-in page: enter the email, then the 6-digit code from the email and a new password; the reset email goes through the same capped email path as sign-up codes

**Email verification codes**
- New email accounts are confirmed with a 6-digit code: after sign-up the page asks for the code, with a button to send a new one (once a minute), and signing in with an unconfirmed address opens the same step
- Supabase Auth hands its emails to the backend through the Send Email hook (`POST /api/auth/email-hook`), which checks Supabase's signature and sends them for free through Resend
- At most 100 emails a day (`EMAIL_DAILY_LIMIT`) and 5 a day to one address; past the daily limit, the sign-up page says so and points to Continue with Google
- New optional Worker secrets `SEND_EMAIL_HOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` and `EMAIL_DAILY_LIMIT`, and a setup guide at `/docs/self-host/email-codes` (ADR-033)

**Sign in with Google**
- Continue with Google on the sign-in page, using Google's own button and a nonce-checked ID token sent to Supabase; shown only when `VITE_GOOGLE_CLIENT_ID` is set
- Docs page for administrators: branding, audience, scopes, client, Supabase provider and brand verification
- Redesigned sign-in page: Google first, a show or hide password toggle, a privacy policy note and footer, and an inset brand panel previewing analytics and scheduling

**Documentation site at `/docs`**
- Public documentation built into the app, laid out like a modern developer docs site: section tabs, grouped sidebar, "On this page" outline with scroll tracking, search with `/` or Ctrl K, previous and next links, copy-page and copy-code buttons, light and dark themes and a phone layout
- Separate paths for members (sign in, connect accounts, analytics, publishing, tracked content, troubleshooting) and administrators (Supabase, YouTube, Instagram, Cloudinary, Redis, backend and frontend deploys, GitHub automation, launch checklist)
- Reference pages for every environment variable, how scheduling works, the security model and common questions
- Links to the docs from the sign-in page, the user menu, the command palette and Settings
- These docs were first built into the app and then moved, before release, to the public site at `https://twiligent.ujjwal.fyi/docs` (see Public website and docs site above, and Changed)

### Changed

**Docs and app addresses**
- The docs moved from the app to the public site; links in the app (sign-in page, user menu, command palette, Settings) open `https://twiligent.ujjwal.fyi/docs`, and old `/docs/...` links in the app redirect to the same page there
- The app moves to `https://app.twiligent.ujjwal.fyi`. The app's old paths on `twiligent.ujjwal.fyi` (such as `/login` and `/settings`) redirect to the new address. The Worker's `FRONTEND_URL` and `ALLOWED_ORIGINS`, the Supabase Auth URLs and the Google sign-in origins must name the new address
- The sign-in page shows the sign-up headline and Sign up with Google when the link ends in `?mode=signup`
- `npm run build`, `npm test` and `npm run typecheck` at the root now cover the site as well

**Sign-in page**
- The sign-in page follows the Activepieces layout in the Twiligent brand: one centred card, styled like the app's dialogs, over a blurred picture of the dashboard. The split layout and its brand panel are gone (ADR-036)
- Signing in starts with Continue with Google or an email address: Twiligent emails a 6-digit code that signs you in, and creates the account the first time an address is used. Use password opens email and password sign-in, Forgot your password? and Create one with a password
- A password sign-in for an address that was never confirmed sends a sign-in code instead of failing
- Each code sign-in is one email against the daily cap; when the cap is reached, the sign-in page shows that email codes are paused until tomorrow and points to Google or the password
- Without the Send Email hook, Supabase's own Magic Link email signs people in with a link; the self-hosting docs explain how to add the code to it

**Protected main branch**
- `main` only accepts pull requests whose CI check passed on an up-to-date branch, merged with rebase; force pushes and deleting the branch are blocked for everyone (ADR-034)

**Backend request pipeline in layers**
- The Worker is organised as middleware, route tables, controllers, services and repositories (`docs/architecture/backend/REQUEST_PIPELINE.md`); every database query is in a repository and every rule in a service
- Every failed request answers with one body, `{ success, code, message, requestId }`, and a status that matches the failure: 400 invalid input, 401 sign-in, 404 not found, 409 already added, 429 rate limited, 502 platform error, 503 server not configured, 504 platform timeout, 500 server error. Database and unexpected errors no longer show internal messages; server errors in the app show a request id to quote
- Every response carries `X-Request-Id`, and the Worker writes one JSON log line per request plus error lines tied to the same id
- Request bodies and query strings are checked before any work starts; malformed JSON is a clear 400
- Platform calls stop when the browser disconnects or after 30 seconds, and Overview background syncing stops after 25 seconds
- The API only answers browsers on `FRONTEND_URL` and the new optional `ALLOWED_ORIGINS` list, and sends security headers (content security policy, no framing, no referrer, nosniff, HSTS)
- Account fields in the analytics responses go through `safeAccount()` like every other account response

**TypeScript**
- The backend Worker, the React app, the scheduled publisher script and every test are now TypeScript in strict mode, with no change in behaviour: each file, with its types removed, matches the JavaScript it replaced
- API request and response shapes live once in `shared/types/` and are used by both the Worker routes and `services/api.ts`
- `npm run typecheck` checks the whole repository; the deploy workflows type-check and test before deploying, and a new CI workflow checks every pull request and branch
- Running the tests or the publisher locally needs Node 22.18 or newer; the GitHub Actions publisher runs on Node 24
- The publisher log no longer prints emoji


**Interface redesign in the Twiligent brand**
- New app shell: 256px sidebar with the Twiligent lockup, search, grouped navigation, account and category lists, and a user menu with theme and sign-out; a 50px top bar with breadcrumb, refresh and theme toggle
- Every page rebuilt on shared components and design tokens: Sora headings, Manrope text, JetBrains Mono numbers, brand red for primary actions and active states, warm dusk and paper surfaces, hairline borders
- Light and dark themes from the same tokens, with a system option; the logo switches between the paper and dusk lockups with the theme
- Overview opens with a greeting, quick actions and selectable metric tiles
- Videos, Shorts, Instagram content, Reddit posts and Tracked content share one library layout: search, filter chips, quiet tables or card grids and a pager
- Adding an account is a choice-card flow with a review step; Publish is a working surface with the editor on the left and settings on the right
- Settings reorganised into labelled sections, with a theme picker
- UI copy in sentence case, without exclamation marks; error messages say what to do next
- Charts use the brand data-visualisation series in both themes
- Settings, Scheduled publishing now says who needs to set anything up: members nothing, administrators only the backend deploy. The GitHub backup guide is marked optional and for administrators, and starts folded

**Development setup**
- One `npm install` at the repository root installs the backend and the frontend as npm workspaces, with a single root `package-lock.json`; never install inside `backend/` or `frontend/`
- `npm run dev` starts the Worker (port 8787) and the Vite dev server (port 5173) together; `npm run build`, `npm test`, `npm run lint` and `npm run format` also run from the root
- One ESLint config, Prettier config and EditorConfig at the root; the backend is now linted too, and the invisible BOM characters in its regexes are written as `\uFEFF` escapes
- Tests moved out of the source folders into `backend/tests/` and `frontend/tests/`, mirroring the source tree; backend fixtures and golden snapshots are in `backend/tests/fixtures/`
- The deploy workflows install once at the root on Node 24, deploy with the Wrangler version from the lockfile, and also run when the root `package.json` or `package-lock.json` changes
- Removed the unused Express packages from the root `package.json` and the leftover `backend/nodemon.json`

### Fixed

- The Instagram connection redirected to `//accounts` when `FRONTEND_URL` ended with a slash
- Refreshing all accounts sent the YouTube API key to YouTube without removing a pasted byte order mark
- Media chips and scrims over photos used a hex colour and `text-white`; they now use the `media-scrim` and `on-media` design tokens. The Overview metric tabs use a declared `none` variant of `TabsList`, and the mobile sidebar keeps the class and HTML attributes passed to `Sidebar` instead of dropping them
- YouTube analytics counted hidden like and comment counts as zero, which pulled averages and engagement rates down; averages and rates now use only the videos that report each count, and hidden counts sort last (see `docs/architecture/data-flows/ANALYTICS.md`). A channel with no videos now returns the same fields and formats as a full result, a Reddit profile without karma totals reports 0 instead of NaN, and date checks use `getTime()`
- Saving the scheduling repository in Settings erased the stored GitHub token and then reported `configured: false` and `patSet: false`. The unused token is no longer stored or reported: `GET /api/settings/github` returns only `repoOwner`, `repoName` and `branch`
- Refreshing or loading an account without the field its platform needs (a YouTube channel id or uploads playlist, a Reddit username) called the platform with `undefined`; it now answers with a message that says to re-add the account. Channel analytics also refuse accounts on other platforms, and the analytics response no longer carries `bannerUrl` and `isLinked`, which are not account fields
- Publishing and scheduling checked too little before calling Instagram: a missing Instagram app secret made the OAuth callback fail with a server error, posts for an account without a token or on another platform called `/undefined/media`, and a Reel still processing after the last status check was published anyway. Each case now fails with a message that says what to fix, and `GET /api/cloudinary-config` answers 503 instead of 200 when Cloudinary is not configured
- The Instagram sign-in state is now checked in constant time
- When Redis was unreachable, every cached request waited about 4 seconds for the cache client's retries; the cache now gives up after one quick retry and skips Redis for 30 seconds after a failure
- `GET /api/comparison` returned stored account secrets (Instagram tokens, Reddit cookies) and ranked Instagram and Reddit accounts with YouTube channels; it now ranks YouTube channels only, passed through `safeAccount()`

- The frontend test for the Google sign-in nonce failed about one run in 23, because it required at least 40 characters while the nonce length varies around 36 to 43
- The Worker cron and the GitHub Actions workflow could both publish the same scheduled post; posts are now claimed atomically
- Channels with no public videos failed to load with "playlist cannot be found"; they now open with a "No public videos yet" message
- Overview could show "Syncing analytics" forever: Reddit accounts and empty channels never finished syncing, and the page only re-checked once
- YouTube likes and comments the owner hid showed as 0; they now show as Hidden
- Cached YouTube, Instagram and Reddit analytics never expired; they now refresh after 6 hours
- Collapsing the sidebar showed clipped labels; icons now stay in place while labels and group headings fade
- The Reddit "Upvoted" column is now "Upvote rate", with an explanation of what it measures and why some rows show a dash
- README: `VITE_API_URL` example now ends in `/api`; the setup SQL now creates `tracked_posts` and turns on row level security for all four tables
- Buttons rendered as links no longer log a Base UI native-button warning
- In dark mode, Continue with Google showed the G on a white square; the app now draws the button in its own outline style, with Google's button over it handling the sign-in

### Removed

- The in-app documentation under `frontend/src/docs/` and its tests; the app's `/docs/*` route now only redirects to the public docs
- Dead code found during the TypeScript migration: the unused `backend/lib/crypto.ts`, the empty Reddit session refresh in the daily cron and the unread `REDDIT_ENCRYPTION_KEY` secret (delete it from the Worker if it is set), the `scheduled` post status checks (no post ever has it), and fallbacks for fields the API never sends
- The unused GitHub personal access token field and its guide in Settings (nothing used the token)
- Legacy root `public/` dashboard, unmounted `trackedPosts.js` route, unused Redis OAuth helpers, unused shadcn block templates and the unused Geist font package
- Duplicated helpers merged: platform badges and avatars, account paths, chart styling, filter tiers, pagination, Reddit post table, `safeAccount()`, Instagram publishing parameters

### Fixed

**Instagram Reels counted as Videos**
- Reels were labelled Videos everywhere because the backend only requested `media_type`, which Instagram reports as `VIDEO` for reels, and checked for a `REEL` value the API never returns
- Media is now classified from `media_product_type` into exactly one of Reels, Posts (photos and carousels), or Videos (in-feed videos), with a `/reel/` permalink fallback and case-insensitive matching
- IG Content Explorer: Newest First sorting works, Best Engagement is (likes + comments) / views, and filter dropdowns show their labels instead of raw values
- Cached Instagram media from older versions is refetched automatically

### Added

**Redesign additions**
- Scheduling setup rewritten as five plain steps with one button each, a check for each step, progress you can tick off, and fixes for common errors (`docs/workflows/SCHEDULING_SETUP.md`)
- The GitHub publisher accepts Supabase's new `sb_secret_` keys as well as the legacy `service_role` key
- Scheduled publishing guide in Settings: how it works for users, and administrator setup for the server cron and the optional GitHub Actions backup, with direct links to the repository's secrets and workflow pages
- Publish explains when scheduled posts go out and warns when posts are overdue, with the administrator contact
- Instagram tester guide wherever Instagram is connected: email the administrator, accept the invite, then connect
- `VITE_ADMIN_EMAIL` sets the administrator contact shown in the app
- Theme changes cross-fade the whole page in one step
- Command palette (Ctrl+K or Cmd+K) for pages, accounts, categories, theme and actions
- Hold-to-confirm for removing accounts, untracking content and deleting scheduled posts
- `/accounts?add=1` opens the add-account flow directly
- Location field in bulk publishing (the value was already sent with each post but had no input)
- Frontend unit tests (`npm test` at the repo root) and backend tests for credential stripping and Instagram publishing parameters
- `docs/design-reference.md` and `docs/architecture/frontend/DESIGN_SYSTEM.md`

**Instagram views by content type**
- Views are fetched from the Instagram `views` insight alongside media, with no extra requests per item; items without insights show `-` instead of 0
- Instagram analytics page: Total Views plus Reels, Posts, and Videos cards; views columns in the top posts and content type tables
- IG Content Explorer: views on every card, per-type count and view totals, and a Most Viewed sort
- Overview: Total Views now includes Instagram views; the Views tab adds an Instagram Views card and a per-account Reels / Posts / Videos views table; the Content tab breaks Instagram content down by type
- Backend unit tests for classification, views parsing, pagination fallback, and per-type totals (`cd backend && npm test`)


**Images on tracked Reddit posts**
- Reddit's public JSON API carries no usable thumbnail, so a screenshot can now be uploaded per tracked Reddit post
- The browser posts the file directly to Cloudinary with the unsigned preset and sends only the returned `secure_url`, keeping the Worker free of binary uploads as the architecture requires
- `PUT /api/tracked-content/:id` accepts `imageUrl`: Reddit-only (400 for YouTube, which has a real thumbnail), must parse as an `https:` URL since the value is rendered into an `img src`, and `null` clears it
- Stored as `data.imageUrl` and merged through `patchTrackedPostData()`, so it survives a live refresh
- `components/ImageLightbox.jsx` added: a thumbnail that opens the full image in a shadcn `Dialog`, with `cursor-zoom-in`, keyboard focus ring, and an `sr-only` title
- Tracked Content: upload, preview, and remove controls in the edit dialog; 10MB and image-only client-side checks; the field explains itself when Cloudinary is not configured
- Tracked Content and Tracked Category tables: Reddit posts with an image show it at the left of the row, matching where YouTube thumbnails already sit, and clicking it opens the full size view

**Manual view counts for tracked Reddit posts**
- Reddit removed `view_count` from its API in December 2018, so views for a tracked Reddit post can now be entered by hand
- `PUT /api/tracked-content/:id` accepts `manualViews`: a whole number of 0 or more, `null` to clear, rejected with a 400 for YouTube items which report a real view count
- `patchTrackedPostData()` added to `backend/lib/db.js` - merges keys into the `data` jsonb instead of replacing it
- `POST /api/tracked-content/:id/refresh` now patches rather than replaces `data`, so a manually entered view count survives a live refresh
- `frontend/src/utils/trackedContent.js` added with `trackedViews()` and `hasTrackedViews()`; every view total in the UI reads through them so YouTube and Reddit items resolve the right field
- Tracked Content table: Views column now shows the manual figure for Reddit posts, with a "Set" button on posts that have none; the Views sort covers both platforms
- Tracked Content edit dialog: Views field for Reddit posts, with an explanation of why it is manual

### Changed

- Tracked Category "Post Views" subtitle now reads "across 9 posts" rather than "entered by hand on 9 of 9 posts"

**Views now include tracked content everywhere**
- Overview Total Views tab: channel views plus tracked YouTube views plus manual Reddit views; tab subtitle breaks the two apart
- Views tab gained Total Views, Channel Views, and Tracked Views stat cards, plus a "Views by Category" area chart
- Tracked Category page: "YouTube Views" replaced with a combined "Total Views" card showing the YouTube and Reddit split
- Tracked Category Reddit section: "Post Views" stat card added; "Avg Karma per Post" folded into the Post Karma subtitle to keep the grid at four cards
- Tracked Category Reddit table: Views column added
- Overview Tracked Categories card: view figure is now the YouTube plus Reddit total rather than YouTube alone

**Audience Comparison plots category karma only**
- Categories previously plotted karma plus views, which mixed an audience metric with a reach metric an order of magnitude larger and pushed categories far above the accounts beside them
- Tooltip now reads "Karma", the legend reads "Category (karma)", and the caption reads "Categories = karma"

**Reddit score renamed to karma across the UI**
- Every user-facing "score" label for a Reddit post now reads "karma", matching the vocabulary Reddit shows its own users
- `RedditAnalytics.jsx`: "Total Score" to "Total Karma", "Score Over Time" to "Karma Over Time", "Score Breakdown" to "Karma Breakdown", "Top Posts by Score" to "Top Posts by Karma", table headers and tooltips updated
- `RedditPosts.jsx`, `RedditPostsAll.jsx`: sort options and table headers now read "Karma"; "Combined Score" to "Combined Karma"
- `TrackedContent.jsx`: "Likes / Score" to "Likes / Karma" in the sort select and table header
- `TrackedCategory.jsx`: "Reddit Score" to "Reddit Karma", "Net Upvotes" to "Post Karma", "Avg Net Upvotes" to "Avg Karma per Post"
- `Overview.jsx`: `categoryStats.rdScore` renamed to `rdKarma`, `trackedStats.rdScore` to `rdKarma`, `cacheTotals.rdScore` to `rdKarma`; chart tooltip now reads "Views + Karma" and the legend "Category (views + karma)"
- Backend field names are unchanged; Reddit's API still returns `score` and it is read as-is
- "Virality Score" and "Consistency Score" keep the word "score" - they are computed indices, not karma

**Overview metric totals corrected**
- Tracked Reddit post karma moved out of Total Audience into Total Likes; a monitored post is content, not owned audience
- Total Comments and Total Likes now sum the analytics cache and tracked content instead of preferring one over the other; tracked items are third-party URLs and never overlap with connected-account content
- Reddit Karma stat now shows account karma plus tracked post karma with both parts in the subtitle

**Overview charts replaced with area charts**
- Audience Share pie chart removed; Audience Comparison now spans the full width
- Comments tab: "Tracked Content by Comments" table replaced with two area charts - "Comments by Tracked Content" and "Comments by Category" - plus a "Comments per Content" stat and per-platform comment share percentages
- Likes tab: "Reddit Accounts by Karma" and "Tracked YouTube by Likes" lists replaced with two area charts - "Karma by Reddit Account" and "Engagement by Tracked Content" - plus an Instagram Likes stat and per-platform like share percentages
- `components/MetricAreaChart.jsx` added: shared single-series area chart with project axis, grid, gradient, and tooltip styling; generates a unique gradient id per instance via `useId()`

**Tracked Category page**
- Horizontal bar charts replaced with area charts for both the YouTube and Reddit sections
- Duplicate value display fixed: the full number below the abbreviated one is now only rendered when `fmtNum` actually abbreviated it (values of 1000 and above)
- Stat card labels now name the metric precisely: "Total Items" to "Total Content", "Total Views" to "YouTube Views" and "Video Views", "Total Likes" to "Video Likes", "Total Comments" to "Video Comments" and "Post Comments"
- Empty state rebuilt on the shadcn `Empty` component

**Sidebar**
- Categories section added below Accounts, listing every tracked-content category with a link to its analytics page

### Removed

- `features/analytics/reddit/RedditTracked.jsx` deleted; superseded by `features/analytics/tracked/TrackedContent.jsx` and unreferenced since the Tracked Content rename

**Tracked Content (expanded from Tracked Reddit Posts)**
- Renamed feature from "Tracked Posts" / "Tracked Reddit Posts" to "Tracked Content" throughout the UI, routing, and API
- Route changed from `/reddit-tracked` to `/tracked-content` (old route redirects to new)
- API endpoint changed from `/api/reddit/tracked-posts` to `/api/tracked-content`
- Frontend page moved from `features/analytics/reddit/RedditTracked.jsx` to `features/analytics/tracked/TrackedContent.jsx`
- YouTube video and Shorts tracking added: paste any YouTube URL to track viewCount, likeCount, commentCount
- `content_type` column added to `tracked_posts` table: `'reddit'` (default) or `'youtube'`
- YouTube and Reddit tracked items share the same categories (categories are plain text labels)
- `fetchTrackedYouTubeData(videoUrl, apiKey)` added to `backend/services/youtube.js`
- Route handler now auto-detects URL platform and calls the appropriate fetch function
- TrackedContent page table: type badge per row, YouTube shows views/likes/comments, Reddit shows score/upvote%/comments
- Sidebar nav label changed from "Tracked Posts" to "Tracked Content" with updated route

**Overview dashboard redesigned**
- KPI StatCards replaced with a 6-tab interface: Total Audience, Total Views, Total Content, Accounts, Total Comments, Total Likes
- Reddit karma now included in Total Audience metric (subs + followers + karma)
- Tracked content count included in Total Content metric
- Audience Comparison chart replaced from AreaChart to BarChart; now includes all platforms (YouTube, Instagram, Reddit) and tracked categories
- Audience Share pie chart now includes Reddit accounts and tracked categories
- Top by Audience list now includes Reddit accounts (with karma metric)
- Top by Content list now shows all platforms
- Total Comments tab: aggregate comment counts from tracked content (Reddit numComments + YouTube commentCount)
- Total Likes tab: Reddit post karma from connected accounts + tracked YouTube video likes
- Reddit section card removed; Reddit data fully integrated into the tab views
- Accounts tab now shows all accounts including Reddit in a unified table

**Tracked Content category analytics**
- New page at `/tracked-content/category/:name` showing detailed analytics per category
- YouTube section: views, likes, comments, like-to-view ratio StatCards; top videos horizontal bar chart; full table sorted by views
- Reddit section: total score, comments, avg upvote ratio, avg score StatCards; top posts horizontal bar chart; full table sorted by score
- Category name decoded from URL param; handles mixed categories (YouTube + Reddit items in the same category)
- Overview category cards now navigate to `/tracked-content/category/:name` instead of the general Tracked Content page
- `categoryStats` in Overview now tracks `ytViews`, `ytLikes`, `ytComments`, `rdScore`, `rdComments` per platform separately; no longer mixes YouTube views and Reddit score under a single "totalScore" label
- Audience Comparison chart tooltip for categories now shows "Views + Score" instead of "Score"
- Audience chart legend updated to "Category (views + score)"
- Tracked Categories card in the Content tab now shows platform-specific metrics: YouTube views in red, Reddit score in orange

**Overview metrics fixed**
- New `/api/overview` backend endpoint reads per-account analytics from Redis cache (YouTube video likes/comments, Instagram media likes/comments, Reddit account posts/score/comments)
- Total Comments and Total Likes now include YouTube channel video data and Instagram media data, not just tracked content
- Total Content now includes Reddit account posts from analytics cache
- Audience Comparison changed from BarChart to AreaChart with gradient fill and platform-colored custom dots per account
- Top by Audience list simplified: shows rank, avatar, account name, and platform badge only (no metric value)
- Tab trigger subtitles now truncated cleanly; no visual overflow between adjacent triggers
- When any account's analytics cache is cold, backend fires a background warm-up task (YouTube fetchAllVideos, Instagram fetchInstagramMedia); frontend shows "Syncing analytics..." and auto-refreshes after 6 seconds

### Removed

**X (Twitter) integration removed**
- Removed `backend/routes/x.js`, `backend/services/x.js` and all X API client code
- Removed `GET /api/accounts/:id/x-analytics` and `GET /api/accounts/:id/x-tweets` routes
- Removed `POST /api/accounts/x` route and X account creation handler from `routes/accounts.js`
- Removed X cache functions (`getXCache`, `setXCache`, `deleteXCache`) from `lib/cache.js`
- Removed `frontend/src/features/analytics/x/` directory (`XAnalytics.jsx`, `XTweets.jsx`)
- Removed X routes (`/x/:id`, `/x-tweets/:id`) from `App.jsx`
- Removed X tab and X accounts section from `AccountManager.jsx`
- Removed X nav item ("X Tweets") from `Sidebar.jsx`
- Removed X normalization block from `formatters.js`
- Removed X methods (`addXAccount`, `getXAnalytics`, `getXTweets`) from `api.js`

### Added

**Tracked Reddit Posts feature**
- New `tracked_posts` Supabase table: stores post URLs, an optional account cookie reference, label, category, and cached Reddit data as jsonb
- `backend/routes/trackedPosts.js` - 5 routes under `/api/reddit/tracked-posts`: GET (list), POST (add + fetch), PUT (update label/category/account), DELETE, and POST `:id/refresh`
- `fetchTrackedPostData(postUrl, cookie)` added to `backend/services/reddit.js` - uses the `.json` trick to retrieve score, upvote ratio, comment count, and metadata for any public Reddit post
- `backend/lib/db.js` - 5 new functions: `getTrackedPosts`, `getTrackedPostById`, `createTrackedPost`, `updateTrackedPost`, `deleteTrackedPost`
- `frontend/src/features/analytics/reddit/RedditTracked.jsx` - new page at `/reddit-tracked`:
  - StatCards: Tracked Posts, Categories, Avg Score
  - "Track Post" dialog: URL input, account cookie selector (nullable), label, category
  - Table with score, comment count, upvote%, last fetched, per-row refresh/edit/delete/open
  - Checkbox selection with bulk category assignment bar
  - "Edit" dialog with category quick-select from existing categories
  - Filters: text search, category filter, sort by date/score/comments
  - Empty state with CTA
- Route `/reddit-tracked` added to `App.jsx`
- "Tracked Posts" nav item with `BookmarkCheck` icon added to Analytics group in `Sidebar.jsx`
- `api.js` - 5 new methods: `getTrackedPosts`, `addTrackedPost`, `updateTrackedPost`, `deleteTrackedPost`, `refreshTrackedPost`
- `Overview.jsx` - category stats section below Reddit karma card; lazily fetches tracked posts and groups by category showing total score, avg score, upvote%; hidden when no categories assigned

**Reddit Analytics improvements**
- Karma separated into its own dedicated card in `RedditAnalytics.jsx` (total, post, comment, awardee karma); previously karma was mixed into the profile header
- KPI cards: Posts Fetched, Total Score, Total Comments, Awards Received - replacing the previous generic set
- Awards Received (`total_awards_received` from Reddit API) added to per-post data and analytics computation (`totalAwards`, `avgAwards`)
- Score Breakdown card now shows 6 metrics: avg score, median score, best single post, avg upvote ratio, total comments, avg comments
- Section labels updated: "Post Activity" to "Posting Frequency", "Score Distribution" to "Score Breakdown", "Performance Scores" to "Performance Indicators"

**Reddit Posts global page**
- `frontend/src/features/analytics/reddit/RedditPostsAll.jsx` - new page at `/reddit-posts` aggregating posts across all connected Reddit accounts using `Promise.allSettled`
- Account selector dropdown (shown only when 2+ Reddit accounts connected)
- Subreddit filter, text search, and sort by score, comments, or date
- Three summary StatCards: Posts Shown, Combined Score, Total Comments
- Empty state when no Reddit accounts connected
- Route `/reddit-posts` added to `App.jsx` before the existing `/reddit-posts/:id` route
- "Reddit Posts" nav item added to Analytics section of Sidebar

**Overview karma fix**
- Reddit karma no longer counted in Total Audience KPI (karma is not subscribers/followers)
- Audience Comparison bar chart and Audience Share pie chart now exclude Reddit accounts
- Content leaderboard and All Accounts table now exclude Reddit accounts
- Reddit accounts display a dedicated karma card (total, post, comment karma per account) below the main KPI row

### Fixed

**Reddit Application-Only OAuth**
- Added `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` optional Worker secrets for application-only OAuth (client credentials grant)
- `getAppOnlyToken(env)` in `backend/services/reddit.js` - exchanges client credentials for a bearer token via `POST /api/v1/access_token` with `grant_type=client_credentials`; token cached in isolate memory with expiry
- When credentials are set, all Reddit API calls use `oauth.reddit.com` with `Authorization: Bearer` header instead of unauthenticated `www.reddit.com` requests; this resolves Reddit's datacenter IP block
- When credentials are absent, requests fall back to unauthenticated (may 403 depending on Reddit's IP filtering)
- Fixed User-Agent to proper Reddit-required format: `script:twiligent:v1.0 (by /u/spacesdrive)`
- Better 403 error message: distinguishes between "account is private or suspended" (authenticated 403) and "Reddit blocked the request - set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET" (unauthenticated 403)
- `fetchRedditProfile(username, cookie, env)` and `fetchRedditPosts(username, cookie, limit, env)` now accept `env` as an optional last parameter; all call sites updated in `accounts.js` and `routes/reddit.js` to pass `c.env`

**Reddit Login Fix - Remove Broken Auto-Login**
- Removed `loginToReddit` password-based auto-login; Reddit's `ssl.reddit.com/api/login` blocks all server/datacenter IPs and cannot be used from Cloudflare Workers
- `POST /api/accounts/reddit` now accepts `{ username, cookie }` - cookie is optional and manually provided by the user from browser DevTools for private accounts
- Public Reddit accounts work without any session cookie - all analytics data is fetched from Reddit's public JSON API
- `autoRefreshRedditSessions` replaced with a no-op; session cookies must be refreshed manually by re-adding the account
- AccountManager Reddit tab updated: password and TOTP fields removed; replaced with optional session cookie field with clear browser DevTools instructions
- AccountCard badge shows "Session cookie stored" or "Public access" based on `hasCookie`
- `safeAccount` and `safeRedditAccount` now expose `hasCookie: boolean` instead of `hasTotpSecret`
- `generateTOTP` remains in `crypto.js` for potential future use

**Reddit Automatic Session Refresh**
- `backend/lib/crypto.js` - AES-256-GCM encrypt/decrypt using `crypto.subtle` (Web Crypto API, no npm dependency)
- `POST /api/accounts/reddit` now accepts `password` instead of `cookie`; logs in to Reddit automatically, encrypts the password with `REDDIT_ENCRYPTION_KEY`, and stores `cookie`, `cookieAcquiredAt`, `cookieExpiresAt` in `accounts.data`
- `loginToReddit(username, password)` in `backend/services/reddit.js` - authenticates via `ssl.reddit.com/api/login` and returns `{ cookie, cookieAcquiredAt, cookieExpiresAt }`
- `autoRefreshRedditSessions(supabase, encryptionKey)` in `backend/services/reddit.js` - cron handler that re-logs in any Reddit account whose cookie is older than 23 hours; runs on the `0 0 * * *` trigger alongside Instagram token refresh
- `ensureFreshCookie()` in `backend/routes/reddit.js` - per-request freshness check before analytics/posts fetch; auto-re-logins if cookie is stale and credentials are stored
- `safeAccount()` and `safeRedditAccount()` now also strip `encryptedPassword` from all API responses
- Account Manager Reddit tab changed from manual cookie paste to username + password; shows session status badge on each Reddit account card (active / expired / public)
- New Worker secret: `REDDIT_ENCRYPTION_KEY` (optional; Reddit auto-refresh disabled if absent)

**Reddit Integration**
- `POST /api/accounts/reddit` - add Reddit account by username with optional session cookie
- `GET /api/accounts/:id/reddit-analytics` - full analytics: profile, score stats, subreddit breakdown, posting time patterns, monthly breakdown, virality and consistency scores
- `GET /api/accounts/:id/reddit-posts` - paginated post list (up to 100 posts, cached in Redis)
- `backend/services/reddit.js` - Reddit public JSON API client (`redditFetch`), `fetchRedditProfile`, `fetchRedditPosts`, `computeRedditAnalytics`, `safeRedditAccount`
- Reddit cache key `reddit:{userId}:{accountId}` in Upstash Redis; invalidated on account delete
- `frontend/src/features/analytics/reddit/RedditAnalytics.jsx` - detailed stats page with karma breakdown, score timeline, post type distribution, day/hour analysis, subreddit breakdown, top posts table
- `frontend/src/features/analytics/reddit/RedditPosts.jsx` - filterable/sortable post explorer with subreddit filter, search, sort by score/comments/date
- Reddit tab in Account Manager dialog (username + optional session cookie)
- Reddit accounts section in Account Manager accounts list
- Reddit accounts included in Overview totals, leaderboards, and all-accounts table
- Reddit accounts in Sidebar quick navigation (routes to `/reddit/:id`)
- Routes `/reddit/:id` and `/reddit-posts/:id` in App.jsx

### Fixed
- Strip non-ASCII characters from `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` env vars in `scripts/publish-scheduled.js` using `/[^\x20-\x7E]/g` to defend against BOM injected by PowerShell 5.1 when setting GitHub Actions secrets
- Replaced embedded literal U+FEFF in BOM-strip regex with proper `\uFEFF` unicode escape

---

## [1.0.0] - 2025 (Initial Production Release)

### Added

**Backend (Cloudflare Worker + Hono)**
- `GET /api/health` - public health check endpoint
- `POST /api/accounts` - add YouTube channel by URL or handle
- `POST /api/accounts/instagram` - add Instagram account via access token
- `GET /api/accounts` - list all user accounts
- `DELETE /api/accounts/:id` - remove account and invalidate Redis cache
- `POST /api/accounts/refresh-all` - batch refresh all account stats
- `POST /api/accounts/:id/refresh` - refresh single account stats
- `POST /api/accounts/:id/refresh-ig-token` - extend Instagram long-lived token
- `GET /api/accounts/:id/analytics` - full YouTube analytics with video-level computation
- `GET /api/accounts/:id/videos` - YouTube video list (cached in Redis)
- `GET /api/accounts/:id/ig-analytics` - Instagram analytics with engagement computation
- `GET /api/accounts/:id/ig-media` - Instagram media list (cached in Redis)
- `GET /api/comparison` - cross-account comparison data
- `GET /api/auth/instagram/url` - generate HMAC-signed Instagram OAuth URL
- `GET /api/auth/instagram/callback` - OAuth code exchange, account creation, redirect
- `GET /api/resolve-channel` - resolve YouTube URL/handle to channel ID
- `GET /api/keys` - return configuration status for all required API keys
- `GET /api/cloudinary-config` - return Cloudinary cloud name and upload preset
- `POST /api/accounts/:id/ig-publish` - create Instagram media container
- `GET /api/ig-container/:id/status` - poll container processing status
- `POST /api/accounts/:id/ig-media-publish` - publish container to Instagram
- `GET /api/accounts/:id/ig-publishing-limit` - check daily publishing quota
- `GET/POST /api/scheduled-posts` - list and create scheduled posts
- `PUT/DELETE /api/scheduled-posts/:id` - edit and delete individual posts
- `DELETE /api/scheduled-posts` - clear all non-publishing posts
- `GET/POST /api/process-scheduled` - manual scheduler trigger
- `GET/PUT /api/settings/github` - GitHub PAT and repo settings

**Cron triggers (wrangler.toml)**
- `*/15 * * * *` -> `processScheduledPosts()` publishes due Instagram posts
- `0 0 * * *` -> `autoRefreshInstagramTokens()` refreshes tokens expiring within 15 days

**Database (Supabase)**
- `accounts` table - `id, user_id, platform, data jsonb`
- `settings` table - `user_id, key, value jsonb` (PK: user_id + key)
- `scheduled_posts` table - `id, user_id, account_id, status, scheduled_at, data jsonb`

**Frontend (React 19 + Vite)**
- `/login` - email/password authentication via Supabase Auth
- `/` - Overview dashboard: KPI cards, area chart, pie chart, leaderboard tables
- `/channel/:id` - Deep YouTube channel analytics
- `/instagram/:id` - Deep Instagram profile analytics
- `/videos` - Cross-account YouTube video explorer
- `/shorts` - Shorts-filtered video explorer
- `/reels` - Instagram reels/media explorer
- `/upload` - Instagram publishing UI + scheduled post queue
- `/accounts` - Account management: add, remove, refresh, Instagram OAuth
- `/settings` - API key status + GitHub PAT configuration

**GitHub Actions**
- `deploy-backend.yml` - deploy Worker on push to `main` (paths: `backend/**`)
- `deploy-frontend.yml` - build and deploy Pages on push to `main` (paths: `frontend/**`)
- `publish-scheduled.yml` - run scheduled publisher every 15 minutes via cron

**Infrastructure**
- HMAC-signed OAuth state (no Redis dependency for auth flows)
- Optional Upstash Redis caching with silent fallback
- Cloudinary media hosting for Instagram publishing pipeline
- `safeAccount()` strips Instagram access tokens from all API responses
