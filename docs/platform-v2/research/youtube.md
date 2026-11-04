# YouTube video and Shorts publishing: research for Twiligent

Researched 5 November 2026. Sources are Google's own docs unless stated. Each section separates
**Verified** (read on the cited page) from **Inference** (my reasoning, not stated by a source).

Headline changes since most guides and training data were written:

1. **The private lock for unverified API projects is gone.** On 2 November 2026 Google reversed the
   28 July 2020 rule. Uploads from unaudited projects can be public, unlisted or scheduled.
2. **videos.insert no longer costs 1,600 units.** Since 1 June 2026 it has its own quota bucket:
   100 calls per day, 1 unit per call. Every other method shares the old 10,000 units per day.
3. **thumbnails.set now accepts files up to 50 MB** (was 2 MB), and since 3 November 2026 it can
   set custom thumbnails on Shorts once processing has finished.

---

## 1. OAuth 2.0 for a web server app

### Verified

- Endpoints: authorization `https://accounts.google.com/o/oauth2/v2/auth`, token exchange and refresh
  `https://oauth2.googleapis.com/token`, revocation `https://oauth2.googleapis.com/revoke`.
  https://developers.google.com/identity/protocols/oauth2/web-server
- YouTube scopes and what Google's consent screen says about each one
  (https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps):
  - `youtube`: "Manage your YouTube account"
  - `youtube.force-ssl`: "See, edit, and permanently delete your YouTube videos, ratings, comments and captions"
  - `youtube.readonly`: "View your YouTube account"
  - `youtube.upload`: "Manage your YouTube videos"
  - `youtubepartner`: content owners (CMS) only
- Scopes each method accepts:
  - videos.insert: `youtube.upload`, `youtube`, `youtubepartner`, `youtube.force-ssl`
    (https://developers.google.com/youtube/v3/docs/videos/insert)
  - thumbnails.set: `youtubepartner`, `youtube.upload`, `youtube`, `youtube.force-ssl`
    (https://developers.google.com/youtube/v3/docs/thumbnails/set)
  - playlistItems.insert: `youtubepartner`, `youtube`, `youtube.force-ssl`. **Not `youtube.upload`.**
    (https://developers.google.com/youtube/v3/docs/playlistItems/insert)
  - videos.list: the `fileDetails`, `processingDetails` and `suggestions` parts "are only available to
    that video's owner" (https://developers.google.com/youtube/v3/docs/videos/list)
- `access_type=offline` makes Google return a refresh token "the first time that your application
  exchanges an authorization code for tokens". The Node sample says "The refresh_token is only
  returned on the first authorization." `prompt` accepts `none`, `consent`, `select_account`.
  `include_granted_scopes=true` enables incremental authorization: the new token also covers scopes
  granted earlier. https://developers.google.com/identity/protocols/oauth2/web-server
- Revocation: POST `https://oauth2.googleapis.com/revoke` with `token=<access or refresh token>` and
  `Content-Type: application/x-www-form-urlencoded`. Revoking an access token also revokes its refresh
  token, and "Revocation removes all OAuth 2.0 scopes previously granted to a project". It may take
  some time to take full effect. Same page.
- Token response fields: `access_token`, `expires_in`, `refresh_token`, `refresh_token_expires_in`
  (only set when the user grants time-based access), `scope`, `token_type`. Google now also supports
  DPoP-bound tokens (optional). Same page.
- Refresh token expiry reasons (https://developers.google.com/identity/protocols/oauth2#expiration):
  user revoked access; unused for six months; password change (only for tokens with Gmail scopes);
  too many live refresh tokens; time-based access expired; admin restricted the scopes.
  **"A Google Cloud Platform project with an OAuth consent screen configured for an external user type
  and a publishing status of 'Testing' is issued a refresh token expiring in 7 days"** unless the only
  scopes are name, email and profile. Limit of 100 refresh tokens per Google Account per OAuth client
  ID; the 101st silently invalidates the oldest.
- Token sizes: refresh tokens up to 512 bytes, access tokens up to 2048 bytes. Same page.
- `invalid_grant` on refresh means the token "may have expired or has been invalidated"; the fix is to
  authenticate the user again. https://developers.google.com/identity/protocols/oauth2/web-server
- A web server app needs a client secret (Google's overview: "a JavaScript application does not
  require a secret, but a web server application does").
  https://developers.google.com/identity/protocols/oauth2
- Consent screen audience (https://support.google.com/cloud/answer/15549945):
  Testing status is limited to 100 test users listed on the consent screen; test users see a warning.
  In production, Google shows an "unverified app" screen while sensitive or restricted scopes are not
  verified, and the unverified app user cap is 100 new users for the lifetime of the project.
- Verification is not mandatory for "Personal Use apps ... (fewer than 100 users)"; users click
  through the unverified app warning. Internal (Workspace) apps skip the warning and the cap.
  https://support.google.com/cloud/answer/13464323
- Scope sensitivity is shown in the Cloud Console; Google's scopes page says sensitive scopes "require
  review by Google". https://developers.google.com/identity/protocols/oauth2/scopes

### PKCE

- **Verified:** the web server guide does not document `code_challenge` for web server apps.
- **Not from Google (secondary):** developer tests and a Google forum thread report that Google
  accepts `code_challenge` / `code_challenge_method=S256` on a Web application client but still
  requires `client_secret` at the token endpoint.
  https://ktaka.blog.ccmp.jp/2025/07/oogle-oauth2-and-pkce-understanding.html,
  https://discuss.google.dev/t/authorization-code-flow-without-client-secret/168113
- **Inference:** send a `state` value tied to a short-lived server-side record (CSRF protection), keep
  the client secret in a Worker secret, and optionally add PKCE as defence in depth. Do not rely on
  PKCE instead of the secret.

### Sensitive or restricted

- **Not stated on a Google page I could read:** the exact class of `youtube.upload`. Secondary sources
  say every YouTube user-data scope is **sensitive** (not restricted) and only `youtubepartner` is
  restricted. https://singhamandeep.com/youtube-api-key-vs-oauth-2-verification,
  https://www.openquok.com/docs/social-integration/youtube
- **Inference:** sensitive means a self-hoster sees the "Google hasn't verified this app" screen and can
  click through (Advanced, Go to app). No CASA security assessment (that is for restricted scopes).

### Narrowest scope set

- Upload + thumbnail + read own upload status: `youtube.upload` covers videos.insert and thumbnails.set.
  **Inference:** reading `processingDetails` and calling `channels.list mine=true` needs a read scope,
  so add `youtube.readonly`.
- Adding to a playlist needs `youtube.force-ssl` (or `youtube`). `youtube.force-ssl` alone also covers
  insert, thumbnails and reads.
- **Recommendation:** request `youtube.upload` + `youtube.readonly` at connect time. Request
  `youtube.force-ssl` incrementally (`include_granted_scopes=true`) only when the owner turns on
  "add to playlist". Owners who want one consent can request `youtube.force-ssl` alone, but it reads
  as broader ("permanently delete") on the consent screen.

---

## 2. The private lock for unverified projects (reversed)

### Verified

- Original rule, 28 July 2020: "All videos uploaded via the videos.insert endpoint from unverified API
  projects created after 28 July 2020 will be restricted to private viewing mode. To lift this
  restriction, each project must undergo an audit to verify compliance with the Terms of Service."
  https://developers.google.com/youtube/v3/revision_history (July 28, 2020 entry)
- **Reversal, 2 November 2026:** "Videos uploaded through the videos.insert method from unverified API
  projects are no longer restricted to private viewing mode. This change reverses the policy announced
  on July 28, 2020". If `status.privacyStatus` is omitted, the video defaults to `public`; "Certain
  uploads might default to private based on creator account settings".
  https://developers.google.com/youtube/data/revision_history (November 2, 2026 entry)
- The videos.insert reference now reads: "Videos uploaded from unverified API projects are not
  restricted to private viewing mode." https://developers.google.com/youtube/v3/docs/videos/insert
- A Google staff reply on the issue tracker (13 October 2026) says an unaudited project can upload
  public or unlisted videos and can schedule with `publishAt`, and that an audit is no longer needed
  for this. https://issuetracker.google.com/issues/572863050 and
  https://issuetracker.google.com/issues/572902667
- The YouTube Help page on videos locked as private still mentions unverified API services (stale).
  https://support.google.com/youtube/answer/7300965

### What a self-hoster must do

- Nothing for privacy. No audit needed to publish publicly.
- The audit form still matters for more quota: https://support.google.com/youtube/contact/yt_api_form
- **Inference:** after each upload, read `status.privacyStatus` back from the 201 response and compare
  it with what was asked. If YouTube returns `private` when `public` was asked, show it to the owner
  (channel default settings, under-18 account, or a policy action) rather than failing silently.

---

## 3. videos.insert

### Verified (https://developers.google.com/youtube/v3/docs/videos/insert, https://developers.google.com/youtube/v3/docs/videos)

- Endpoint for uploads: `POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`
- Maximum file size 256 GB. Accepted media types `video/*` and `application/octet-stream`.
- **Quota:** "100 calls per day. A call to this method has a quota cost of 1 unit in the Video Uploads
  quota bucket." Background: 4 Dec 2025 cost dropped from about 1,600 to about 100 units; 1 June 2026
  videos.insert and search.list moved to their own buckets. Default allocation is "100 search.list
  calls, 100 videos.insert calls, and 10,000 units per day combined for all other endpoints". Quotas
  reset at midnight Pacific Time. "All API requests, including invalid requests, incur at least a
  one-point quota cost." https://developers.google.com/youtube/v3/determine_quota_cost,
  https://developers.google.com/youtube/v3/getting-started,
  https://developers.google.com/youtube/data/revision_history
- Settable properties: `snippet.title`, `snippet.description`, `snippet.tags[]`, `snippet.categoryId`,
  `snippet.defaultLanguage`, `localizations.*`, `status.embeddable`, `status.license`,
  `status.privacyStatus`, `status.publicStatsViewable`, `status.publishAt`,
  `status.selfDeclaredMadeForKids`, `status.containsSyntheticMedia`, `recordingDetails.recordingDate`.
- Limits:
  - `snippet.title`: max 100 characters, any UTF-8 except `<` and `>`. Required (invalidTitle on empty).
  - `snippet.description`: max **5000 bytes** (not characters), any UTF-8 except `<` and `>`.
    Clickable links need channel verification or advanced features.
  - `snippet.tags[]`: whole list max 500 characters; commas between items count; a tag with a space
    counts its implied quotation marks ("Foo Baz" counts as 9). The Go sample notes an empty tag
    string gives 400.
  - `snippet.categoryId`: must be a valid category ID (videoCategories.list).
  - `snippet.defaultLanguage`: language of title and description; required if `localizations` are set
    (error `defaultLanguageNotSet`).
  - `status.privacyStatus`: `private`, `public`, `unlisted`; defaults to `public` if omitted.
  - `status.publishAt`: the scheduled publish time. Can only be set when privacy is `private` and the
    video has never been published; a past date publishes immediately; updates that set it must also
    set privacyStatus to `private`. Error `invalidPublishAt` exists. The resource lists its type as
    datetime (ISO 8601).
  - `status.selfDeclaredMadeForKids`: boolean, channel owner's designation. (15 Oct 2026: omitted
    values are not overridden on update.)
  - `status.containsSyntheticMedia`: boolean, discloses realistic altered or synthetic content
    (added 30 Oct 2024).
  - `status.license`: `youtube` or `creativeCommon`. `status.embeddable`: boolean.
- `notifySubscribers` query parameter: boolean, default `True`.
- Length: 15 minutes by default; verified accounts can upload longer. Max "256 GB or 12 hours, whichever
  is less." https://support.google.com/youtube/answer/71673
- Errors listed: `defaultLanguageNotSet`, `invalidCategoryId`, `invalidDescription`, `invalidFilename`,
  `invalidPublishAt`, `invalidRecordingDetails`, `invalidTags`, `invalidTitle`,
  `invalidVideoGameRating`, `invalidVideoMetadata`, `mediaBodyRequired`, `uploadLimitExceeded` (all
  400), `forbidden`, `forbiddenLicenseSetting`, `forbiddenPrivacySetting` (403).

### Inference

- Validate title (1 to 100 characters, no `<` `>`), description (UTF-8 byte length up to 5000, no
  `<` `>`) and the tag budget in a pure `lib/` helper so the browser form and the Worker share the rule.
- `publishAt` must be in the future at insert time, with a margin (for example 15 minutes), because a
  past time publishes immediately.
- `notifySubscribers` with `publishAt`: whether the notification is sent at upload or at publish time
  is not documented.
- One resumable session initiation probably counts as the videos.insert call against the 100 per day
  bucket, even if the upload is never finished. Count it on initiation.

---

## 4. Resumable upload protocol

### Verified (https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol)

1. **Initiate:** `POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=PARTS`
   with headers `Authorization: Bearer ...`, `Content-Type: application/json; charset=UTF-8`,
   `Content-Length` (of the JSON body), `X-Upload-Content-Length: <file size>`,
   `X-Upload-Content-Type: video/*` (or `application/octet-stream`). Body: the video resource JSON.
2. **Session URI:** response `200 OK` with a `Location` header holding the session URI
   (`...&upload_id=...`). Save it.
3. **Upload in chunks:** `PUT <session URI>` with `Authorization`, `Content-Length: <chunk size>`,
   `Content-Range: bytes FIRST-LAST/TOTAL`. Rules: "The chunk size must be a multiple of 256 KB" except
   the last; "The chunk size must be the same for each request in the upload sequence with the
   exception of the last request". Every non-final chunk returns `308 Resume Incomplete` with a `Range`
   header; the final chunk returns `201 Created` with the video resource.
4. **Status query:** `PUT <session URI>` with `Content-Length: 0` and `Content-Range: bytes */TOTAL`.
   - If the upload already completed, "regardless of whether it succeeded or failed, the API will return
     the same response that it sent when the upload originally completed".
   - Otherwise `308` with `Range: bytes=0-N` (0-indexed, inclusive), or no `Range` header if nothing
     was received. Honour `Retry-After` if present.
   - Resume from byte N+1 exactly. Overlapping or skipping bytes means "none of the binary content
     will be uploaded". "Do not assume that the server received all (or none) of the bytes sent in the
     previous request." Status can be queried between chunks at any time.
5. **Retryable:** connection lost, or `500`, `502`, `503`, `504`, with exponential backoff. Any other
   4xx or 5xx is permanent.
6. **Expiry:** "each resumable session URI has a finite lifetime and eventually expires". A request
   with an expired session URI returns `404`; start a new session from byte 0.
- Google's Python sample: `RETRIABLE_STATUS_CODES = [500, 502, 503, 504]`, `MAX_RETRIES = 10`,
  sleep `random() * 2 ** retry` seconds. https://developers.google.com/youtube/v3/guides/uploading_a_video
- Google also calls chunking "rarely necessary and ... discouraged" for performance, but allows it.

### Session lifetime: not documented for YouTube

- Drive: "A resumable session URI expires after one week." Any 4xx during a resumable upload means
  restart. https://developers.google.com/drive/api/guides/manage-uploads
- Cloud Storage: one week; `410 Gone` if cancelled or invalid within the week, `404` after.
  https://docs.cloud.google.com/storage/docs/resumable-uploads
- **Inference:** YouTube likely uses the same Google upload stack (one week), but plan for less. Treat
  both `404` and `410` on the session URI as "session gone". Finish uploads within hours, not days.

### Inference: chunk size for this stack

- 8 MiB (32 x 256 KiB) per chunk. A 100 MB file (Cloudinary free maximum) is 12 or 13 chunks.
- Keep it constant for the whole session; only the last chunk is shorter.

---

## 5. Upload and processing status

### Verified (https://developers.google.com/youtube/v3/docs/videos, https://developers.google.com/youtube/v3/docs/videos/list)

- `status.uploadStatus`: `uploaded`, `processed`, `failed`, `rejected`, `deleted`.
- `status.failureReason` (only when failed): `codec`, `conversion`, `emptyFile`, `invalidFile`,
  `tooSmall`, `uploadAborted`.
- `status.rejectionReason` (only when rejected): `claim`, `copyright`, `duplicate`, `inappropriate`,
  `legal`, `length`, `termsOfUse`, `trademark`, `uploaderAccountClosed`, `uploaderAccountSuspended`.
- `processingDetails.processingStatus`: `processing`, `succeeded`, `failed`, `terminated`;
  `processingProgress` (`partsTotal`, `partsProcessed`, `timeLeftMs`) "is designed to be polled";
  `processingFailureReason`: `other`, `streamingFailed`, `transcodeFailed`, `uploadFailed`;
  `thumbnailsAvailability` and others. "This data can only be retrieved by the video owner."
- `suggestions.processingErrors` / `processingWarnings` / `processingHints` (owner only).
- videos.list costs 1 unit (shared 10,000 bucket).

### Inference

- Poll `videos.list?part=status,processingDetails&id=...` from the 5-minute cron until
  `uploadStatus` is `processed`, `failed`, `rejected` or `deleted`, with a cap (for example 24 hours).
  Batch up to 50 IDs per call (the `id` filter accepts a comma-separated list) to save quota.

---

## 6. Thumbnails, playlists, categories, channel info

### Verified

- **thumbnails.set** (https://developers.google.com/youtube/v3/docs/thumbnails/set): max 50 MB
  (raised from 2 MB on 14 Sep 2026), `image/jpeg`, `image/png`, `application/octet-stream`; about
  50 units. Errors: `invalidImage`, `mediaBodyRequired` (400); `forbidden` (403: "The authenticated
  user doesn't have permissions to upload and set custom video thumbnails"); `videoNotFound` (404);
  `uploadRateLimitExceeded` (429). Since 3 Nov 2026 it supports Shorts thumbnails "after video
  processing is complete", with a new `shortsAspectRatio` property on the thumbnails resource.
  https://developers.google.com/youtube/data/revision_history
- Custom thumbnails need a verified YouTube account (phone verification unlocks intermediate features,
  with a daily limit). https://support.google.com/youtube/answer/72431,
  https://support.google.com/youtube/answer/9890437
- **playlistItems.insert**: 50 units, scopes `youtube` / `youtube.force-ssl` / `youtubepartner`.
  Errors include `playlistContainsMaximumNumberOfVideos`, `playlistItemsNotAccessible`,
  `playlistOperationUnsupported` (cannot insert into the uploads playlist).
  https://developers.google.com/youtube/v3/docs/playlistItems/insert
- **playlists.list** `mine=true`: 1 unit, `maxResults` 0 to 50, paged.
  https://developers.google.com/youtube/v3/docs/playlists/list
- **videoCategories.list** `regionCode=<ISO 3166-1 alpha-2>`, `part=snippet`, `hl` optional: 1 unit.
  https://developers.google.com/youtube/v3/docs/videoCategories/list
- **channels.list** `mine=true`: 1 unit; returns channels owned by the authenticated user.
  https://developers.google.com/youtube/v3/docs/channels/list

### Inference

- Not every category is assignable to uploads; the category resource has a `snippet.assignable` flag
  (from memory, not re-read). Filter on it. Cache categories per region in Redis or Postgres for a day.
- Call thumbnails.set only after `processingDetails.thumbnailsAvailability` / processing succeeds,
  especially for Shorts. Treat `forbidden` as "channel not verified for custom thumbnails" and keep the
  video published, marking only the thumbnail step as failed.
- Store `channelId`, title, thumbnail URL and the uploads playlist ID from channels.list at connect time.

---

## 7. Shorts

### Verified

- No Shorts endpoint exists. Google staff on the googleapis repo: "Shorts are treated as standard video
  resources within the Data API" and there is no `isShort` field.
  https://github.com/googleapis/googleapis/discussions/1153
- Eligibility: for standard channels, videos uploaded on or after 15 October 2024 "with a square or
  vertical aspect ratio up to three minutes in length will be categorised as Shorts" (Official Artist
  Channels from 8 December 2025). https://support.google.com/youtube/answer/15424877
- Shorts thumbnails can be set via API after processing (3 Nov 2026, see section 6).

### Not verified / inference

- `#Shorts` in title or description: no current Google page I read says it is required. Classification
  is by aspect ratio and length. Hootsuite still recommends it as a discovery hint. Treat it as optional
  copy, not a switch.
- How to tell a Short after upload: no official field. Workarounds: duration from
  `contentDetails.duration` plus the source file's aspect ratio (Twiligent knows both from Cloudinary
  at upload time), or an unofficial `HEAD https://www.youtube.com/shorts/<id>` check (200 = Short,
  303 = regular). The HEAD check is unofficial, only works once public, and may be rate limited from
  Workers IPs. https://issuetracker.google.com/issues/232112727
- **Recommendation:** decide "Short" in Twiligent from the source file (Cloudinary returns `width`,
  `height`, `duration`): Short if height >= width and duration <= 180 s. Store the intent, do not
  query YouTube to confirm.

---

## 8. Errors to handle

### Verified

Sources: https://developers.google.com/youtube/v3/docs/core_errors, the insert and thumbnails pages,
and the OAuth web server guide.

| Error | Where | Meaning |
| --- | --- | --- |
| `quotaExceeded` (403) | any | operation needs more quota than remains |
| `rateLimitExceeded` (403 or 429), `userRateLimitExceeded` (403) | any | too many requests in a time span |
| `uploadLimitExceeded` (400) | videos.insert | channel exceeded the number of videos it may upload |
| `forbidden` (403) | insert, thumbnails | not allowed (permissions, unverified for thumbnails) |
| `insufficientPermissions` (403) | any | token lacks the scope |
| `invalidCategoryId`, `invalidTitle`, `invalidDescription`, `invalidTags`, `invalidPublishAt`, `defaultLanguageNotSet`, `invalidVideoMetadata` (400) | insert | metadata fix needed |
| `mediaBodyRequired` (400) | insert, thumbnails | no media content |
| `authError`, `unauthorized`, `expired` (401) | any | bad or expired access token |
| `invalid_grant` | token endpoint | refresh token expired or revoked; reconnect |
| `backendError` (503), `internalError` (500) | any | transient |
| 404 / 410 on session URI | resumable PUT | session expired; restart from byte 0 |

### Inference: classification

| Class | Errors | Action |
| --- | --- | --- |
| Retry with backoff | network error, 500, 502, 503, 504, `backendError`, 429 | keep job, next attempt after backoff |
| Wait for quota reset | `quotaExceeded` | park until next midnight Pacific; no attempt counted |
| Wait, then retry | `rateLimitExceeded`, `userRateLimitExceeded` | longer backoff (minutes) |
| Owner must act on content | `invalid*`, `mediaBodyRequired`, `defaultLanguageNotSet` | `failed`, message names the field |
| Owner must act on account | `invalid_grant`, 401 after refresh, `insufficientPermissions`, `forbidden` | pause account jobs as `needs_reconnect` |
| Channel limit | `uploadLimitExceeded` | `failed` with "YouTube daily upload limit reached for this channel"; let owner retry tomorrow |
| Session gone | 404 / 410 on session URI | see idempotency rules in section 12 |

---

## 9. Cloudflare Workers feasibility

### Verified (https://developers.cloudflare.com/workers/platform/limits/, updated 29 Oct 2026)

| Limit | Free | Paid |
| --- | --- | --- |
| CPU per HTTP request | 10 ms | 30 s default, up to 5 min |
| CPU per Cron Trigger | 10 ms | 30 s (interval < 1 h), 15 min (>= 1 h) |
| Cron wall time | 15 min | 15 min |
| Subrequests per invocation | **50** | **10,000** default (up to 10M) |
| Simultaneous connections waiting for headers | 6 | 6 |
| Memory per isolate | 128 MB | 128 MB |
| Cron triggers per account | 5 | 250 |
| Incoming request body | 100 MB on Free/Pro zones, 200 MB Business | same (zone plan, not Workers plan) |
| Response body size | no enforced limit | same |

- Waiting on `fetch()` does not count as CPU time.
- No documented size limit on an outgoing `fetch()` body from a Worker. (The 100 MiB outbound body
  limit applies to Durable Objects and Container outbound handlers, not plain Workers.)
- Streaming: `fetch()` accepts a `ReadableStream` body. "To have a Content-Length header with a
  specific value specified, the body of the Request must be either a FixedLengthStream or a
  fixed-length value"; "Using any other type of ReadableStream as the body of a request will result in
  Chunked-Encoding being used." https://developers.cloudflare.com/workers/runtime-apis/request
- Streams avoid buffering within the 128 MB limit; forwarding a body without reading it is already
  optimal. https://developers.cloudflare.com/workers/runtime-apis/streams/

### Inference

- **Streaming Cloudinary to Google works without buffering:** fetch the Cloudinary byte range, pipe
  `response.body` into `new FixedLengthStream(chunkLength)`, and PUT the readable side to the session
  URI with `Content-Range`. Memory stays small.
- **Free plan CPU (10 ms per cron run) is the main risk.** Piping bytes through native streams should
  cost little JS CPU, but this needs measuring with a real 8 MiB chunk before promising free-plan
  support. Fallback: smaller chunks per run, or run the upload from GitHub Actions (section 12, option B).
- **Free plan subrequests (50 per run):** each chunk costs 2 subrequests (Cloudinary range GET + Google
  PUT). Supabase writes and the token refresh also count. A 100 MB file (13 chunks = 26) plus about
  8 bookkeeping calls fits in one run, but checkpoints must be sparse. Paid plan removes this concern.
- Throughput is unknown. At 10 to 50 MB/s Worker egress, 100 MB takes 2 to 10 seconds of wall time,
  well inside 15 minutes.

---

## 10. Cloudinary

### Verified

- Free plan: 25 credits per month; 1 credit = 1 GB storage, or 1 GB video bandwidth on Free (2 GB on
  paid), or 1,000 transformations. https://cloudinary.com/documentation/billing_and_plans
- Free plan maximum video file size **100 MB** (Plus 2 GB, Advanced 4 GB); max image 10 MB.
  https://cloudinary.com/pricing/compare-plans
- **Range requests work** (tested 4 Nov 2026 against `res.cloudinary.com/demo/video/upload/dog.mp4`):
  `HEAD` returns `Accept-Ranges: bytes` and `Content-Length`; `Range: bytes=0-262143` returns
  `206 Partial Content`, `Content-Length: 262144`, `Content-Range: bytes 0-262143/9094354`. Delivery is
  fronted by Cloudflare. Also exposes an `ETag`.
- Deleting: the Upload API `destroy` "requires a signature to be generated on the server side" (API key
  and secret); Admin API delete methods also need key and secret. An unsigned upload can return a
  `delete_token` (`return_delete_token=true`) usable "within 10 minutes" without auth.
  https://cloudinary.com/documentation/delete_assets,
  https://cloudinary.com/documentation/image_upload_api_reference_upload

### Inference

- Fetch the **original** delivery URL (no transformation parameters) so no transformation credits are
  spent and the bytes match the size Twiligent recorded. Pin the version segment (`/v<version>/`) to
  avoid a changed asset under the same public ID mid-upload, and compare `ETag` / total length on every
  range response; abort the session if it changes.
- Bandwidth: each upload reads the file once from Cloudinary (plus retried chunks). 100 MB = 0.1 credit.
- `delete_token` is useless for scheduled uploads (expires in 10 minutes). Options: add optional
  `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` Worker secrets so the Worker can sign `destroy` after a
  successful upload; without them, list the asset for manual cleanup and say so in the UI.

---

## 11. How other schedulers do it (secondary, product docs)

- **Later:** Shorts only (no long-form); 15 s to 3 min; title, description, tags (500 characters),
  category, visibility, notify subscribers toggle, made-for-kids required; no custom Shorts thumbnails.
  https://help.later.com/hc/en-us/articles/14720878941463-Schedule-Publish-YouTube-Shorts
- **Buffer:** Shorts only; up to 3 min, up to 10 GB, square or 9:16; automatic or notification
  publishing; no custom Shorts thumbnail; category fixed by YouTube.
  https://support.buffer.com/articles/using-youtube-shorts-with-buffer-Jl8iR6jIck
- **Hootsuite:** long-form and Shorts; title, description, tags, category, privacy; custom thumbnail if
  the account is verified; "You can schedule Unlisted or Private videos to go public at a later date
  and time" (that is, it uses YouTube's own `publishAt`). Their doc still says Shorts are under 60 s,
  which is outdated. https://help.hootsuite.com/s/article/publish-yt

Takeaway: the common form is title, description, tags, category, privacy, made for kids, notify
subscribers, schedule time, optional thumbnail, optional playlist. Hootsuite delegates scheduling to
YouTube.

---

## 12. Recommended pipeline for Twiligent

Everything in this section is **inference** (design), built on the verified facts above.

### 12.1 Key design choice: upload early, let YouTube publish

Unlike Instagram, YouTube can schedule natively: upload as `private` with `status.publishAt`. So the
YouTube job should **upload soon after the owner saves the post**, not at publish time:

- the 15-minute and 50-subrequest limits apply to a background step with no deadline pressure;
- processing, copyright and metadata errors show up hours before the publish time;
- the Cloudinary asset can be deleted as soon as YouTube has the file;
- the time-critical part (going public) is done by YouTube, so neither scheduler has to hit the minute.

"Publish now" posts use `public` (or `unlisted`) directly. Scheduled posts use `private` + `publishAt`.
Constraint to show in the UI: a scheduled post always goes public at the time; "scheduled unlisted" is
not possible through `publishAt`.

### 12.2 Where the bytes come from

1. Browser uploads the video to Cloudinary with the existing unsigned preset (`resource_type=video`).
   Cloudinary returns `public_id`, `version`, `bytes`, `width`, `height`, `duration`, `format`.
2. Browser posts the job to the Worker with those fields. The Worker validates: size <= 256 GB (and
   <= plan limit), duration <= 15 min unless the channel is verified for long uploads (cannot be read
   from the API, so warn instead of block), Short = `height >= width && duration <= 180`.
3. Optional thumbnail: a second Cloudinary image upload (JPEG or PNG, <= 10 MB on the free plan).

### 12.3 Tables (sketch; real migrations one entity per file)

- `youtube_accounts`: `user_id`, `channel_id`, `channel_title`, `refresh_token` (encrypted at rest),
  `access_token`, `access_token_expires_at`, `granted_scopes`, `status` (`active`, `needs_reconnect`),
  `token_lease_until`.
- `youtube_uploads` (the job): `id` (`newRowId()`), `user_id`, `account_id`, `post_id`, metadata
  snapshot (title, description, tags, category, privacy, publish_at, made_for_kids, synthetic,
  notify_subscribers, playlist_id), `source_url`, `source_bytes`, `source_etag`, `content_type`,
  `chunk_size`, `session_uri`, `session_started_at`, `bytes_confirmed`, `video_id`, `state`,
  `attempts`, `next_attempt_at`, `lease_owner`, `lease_until`, `last_error_code`, `last_error`,
  `processing_checked_at`, `created_at`, `updated_at`.
- `youtube_quota_ledger`: `pacific_date`, `bucket` (`uploads`, `default`), `units`; one row per day and
  bucket, incremented atomically.

States: `queued` -> `uploading` -> `uploaded` (have `video_id`) -> `processing` -> `processed` ->
`finalizing` (thumbnail, playlist) -> `done`. Side states: `waiting_quota`, `needs_reconnect`,
`needs_review` (outcome unknown), `failed` (dead letter, needs the owner).

### 12.4 Claim and lease locking

- One SQL function (a migration) claims work atomically:
  `UPDATE youtube_uploads SET lease_owner = $run, lease_until = now() + interval '10 minutes'
  WHERE id = (SELECT id FROM youtube_uploads WHERE state IN ('queued','uploading') AND next_attempt_at
  <= now() AND (lease_until IS NULL OR lease_until < now()) ORDER BY next_attempt_at LIMIT 1
  FOR UPDATE SKIP LOCKED) RETURNING *`.
- Lease shorter than the 15-minute cron wall time; the run stops taking new chunks when less than about
  3 minutes of lease remain and releases the lease when done.
- Every write back is conditional: `WHERE id = $id AND lease_owner = $run`. A run whose lease was taken
  over writes nothing.
- The every-minute cron, the 5-minute cron and GitHub Actions can all call the same claim, so two runs
  never upload the same job.

### 12.5 Upload loop (one claimed job per run)

1. Get a valid access token (12.7).
2. If `session_uri` is null: check quota (12.8); write `session_started_at`, then POST the initiation
   with the metadata JSON, `X-Upload-Content-Length = source_bytes`, `X-Upload-Content-Type =
   content_type`. Store `session_uri` **before sending any bytes**. Increment the uploads bucket.
3. Ask Google for the real offset: empty PUT with `Content-Range: bytes */TOTAL`.
   - 200/201: the upload already finished; take `video_id` from the body (this also recovers a lost
     final response).
   - 308: offset = Range end + 1 (or 0 when no Range).
4. While time and subrequest budget remain: fetch Cloudinary `Range: bytes=offset-(offset+chunk-1)`;
   check 206, `Content-Range` total and ETag; pipe into `FixedLengthStream(len)`; PUT with
   `Content-Range: bytes offset-last/TOTAL`. On 308 set offset from `Range`. On 201 store `video_id`,
   `state = uploaded`.
5. Save `bytes_confirmed` at the end of the run (and every few chunks on the paid plan). Google's
   status query is the source of truth; the stored offset is only a hint, which saves free-plan
   subrequests.

### 12.6 Idempotency: never create two videos

- One job has at most one live session. A new session is created only when `session_uri` is null.
- Never retry the initiation POST blindly. If the initiation response is lost (network error), a
  session may exist that we do not know about, but no bytes were sent to it, so no video can appear.
  Safe to initiate again.
- A lost final-chunk response is recovered by the status query (step 3), which returns the original
  201 with the video ID.
- Session `404`/`410`:
  - if `bytes_confirmed < source_bytes` and no final chunk was ever sent: safe to clear `session_uri`
    and restart from byte 0;
  - if the final chunk was sent and its response lost, the outcome is unknown: set `needs_review` and
    ask the owner to check the channel, following the project's rule for unknown outcomes (as for
    Instagram private replies). Optionally search the channel's uploads playlist (playlistItems.list,
    1 unit) for a video created after `session_started_at` with the same title and offer to link it.
- Record a `client_upload_key` in the video description or tags? Not recommended (visible to viewers).

### 12.7 Token refresh

- Before each job, refresh if `access_token_expires_at` is within 5 minutes. Use a short per-account
  lease (`token_lease_until`) so two runs do not refresh at once; the loser re-reads the row.
- POST `grant_type=refresh_token`, `refresh_token`, `client_id`, `client_secret` to
  `https://oauth2.googleapis.com/token`. Store the new access token and expiry; store a new refresh
  token only if one is returned.
- `invalid_grant` or 401 after a fresh token: set the account `needs_reconnect`, move its jobs to
  `needs_reconnect` (not failed, no attempt used), and show "Reconnect YouTube" in the app. A reconnect
  uses `prompt=consent` + `access_type=offline` so Google issues a new refresh token.
- Disconnect: POST the refresh token to `https://oauth2.googleapis.com/revoke`, then delete it.

### 12.8 Quota accounting

- Uploads bucket: 100 initiations per project per Pacific day. Default bucket: 10,000 units
  (thumbnails.set 50, playlistItems.insert 50, videos.list 1, channels.list 1, playlists.list 1,
  videoCategories.list 1).
- All of an owner's channels share one Google Cloud project, so one ledger per instance.
- Before a call, reserve units with an atomic `UPDATE ... SET units = units + $n WHERE units + $n <=
  $limit RETURNING`; if it fails, set `waiting_quota` with `next_attempt_at` = next midnight Pacific.
- On `quotaExceeded` from Google, trust Google: set the ledger to the limit for that day.
- Show remaining uploads for today in the composer.

### 12.9 Backoff and dead letter

- Transient errors: `next_attempt_at = now() + min(2^attempts, 60) minutes * random(0.5..1)`, honour
  `Retry-After`. After 8 transient attempts (about 4 hours total), move to `failed`.
- Content and channel errors go straight to `failed` with a message that names what to fix
  ("Couldn't upload the video. The title is longer than 100 characters.").
- `failed` jobs keep the Cloudinary asset so the owner can fix metadata and retry, which clears
  `session_uri` only if no bytes were confirmed, otherwise resumes.

### 12.10 After upload

- 5-minute cron: batch `videos.list?part=status,processingDetails&id=...` (up to 50 IDs, 1 unit).
  `processed` -> `finalizing`; `failed` / `rejected` -> `failed` with `failureReason` /
  `rejectionReason` mapped to plain English; stop polling after 24 hours as `needs_review`.
- Finalizing: thumbnails.set (upload endpoint, image streamed from Cloudinary) if a thumbnail was
  given; playlistItems.insert if a playlist was chosen and the scope was granted. Each step is its own
  sub-state so a failure in one does not redo the other. A thumbnail `forbidden` keeps the video and
  marks the post "published, thumbnail not set (verify your channel to use custom thumbnails)".
- Read back `status.privacyStatus` and `publishAt`; flag a mismatch.

### 12.11 Cleanup

- After `uploaded` (YouTube has the file), delete the Cloudinary video if API key and secret are
  configured (signed `destroy`, `resource_type=video`, `invalidate=true`); delete the thumbnail after
  finalizing. Without the secret, mark assets for manual cleanup.
- Clear `session_uri` once `video_id` is stored. Purge `access_token` on disconnect.

### 12.12 Option B: GitHub Actions as the uploader

- The existing second scheduler (`scripts/publish-scheduled.ts`, no npm dependencies) can run the same
  claim and loop with Node's `fetch`: no 10 ms CPU limit, no 50-subrequest limit, 6-hour jobs.
- Recommended split: the Worker cron handles small files and the paid plan; GitHub Actions takes jobs
  the Worker could not finish (same lease). Shared rules (chunk math, error classification, validation)
  live in a `backend/lib/` helper with no runtime imports, as with `scheduledPublishing.ts`.

### 12.13 Option C (not verified): browser uploads straight to YouTube

- The Worker could initiate the session and hand the session URI to the browser, which PUTs the file
  directly, skipping Cloudinary. Not verified: whether YouTube session URIs accept a PUT without the
  `Authorization` header and whether they allow CORS from the app origin. Worth a spike only if the
  100 MB Cloudinary free limit becomes the main complaint.

---

## 13. Owner setup steps (self-hosted)

1. In Google Cloud Console, create a project (or reuse one) and enable **YouTube Data API v3**.
2. Configure the OAuth consent screen: user type **External** (or **Internal** if the channels belong
   to the owner's Google Workspace), app name, support email, add scopes `youtube.upload` and
   `youtube.readonly` (plus `youtube.force-ssl` if playlists are wanted).
3. **Publish the app to "In production".** Leaving it in Testing makes refresh tokens expire after
   7 days, so scheduled uploads would stop weekly. Verification is not required for personal use
   (under 100 users); the owner clicks through "Google hasn't verified this app" once per connection.
4. Create an OAuth client of type **Web application** with the redirect URI
   `https://<worker-host>/api/youtube/oauth/callback` (exact match required).
5. Add Worker secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (and optionally `CLOUDINARY_API_KEY`,
   `CLOUDINARY_API_SECRET` for automatic cleanup).
6. In YouTube, verify the channel's phone number (youtube.com/verify) to allow videos longer than
   15 minutes and custom thumbnails.
7. Connect each channel from Twiligent. For a brand account, pick the channel on Google's chooser.
8. Optional: request more quota with the audit form if 100 uploads per day is not enough.

---

## 14. Could not verify

- The exact sensitivity class of `youtube.upload` on a Google-owned page (secondary sources say sensitive).
- The lifetime of a YouTube resumable session URI (Drive and Cloud Storage document one week).
- Whether a YouTube session URI accepts PUTs without `Authorization`, and its CORS behaviour.
- Whether an unfinished resumable session counts against the 100 per day uploads bucket (assumed yes).
- Whether `notifySubscribers` fires at upload or at `publishAt` time.
- Whether `#Shorts` still influences classification (current Google pages describe only aspect ratio
  and length).
- Actual Worker CPU time for piping an 8 MiB chunk on the free plan (must be measured).
- `snippet.assignable` on video categories (from memory, not re-read this session).
- How brand-account channel selection interacts with one refresh token per channel (Google docs not read).
