# YouTube publishing

How Twiligent uploads videos and Shorts to a person's YouTube channel (#147): the Google connection, the upload pipeline, its states, quota, limits and security, and how an instance owner sets it up. The design and its trade-offs are in `ARCHITECTURE.md` (section 3) and ADR-053 in `DECISIONS.md`.

## What it does

- A person verifies a YouTube channel they already added on the Accounts page: **Verify** on its card signs in with Google once, and Twiligent checks the Google account manages that channel. There is no separate list of publishing channels (#166).
- On the YouTube uploads page (`/youtube-uploads`) they queue a video with:
  - title, description and tags;
  - category;
  - visibility, or a publish time;
  - the made-for-kids answer YouTube requires;
  - the AI disclosure;
  - whether to notify subscribers;
  - an optional thumbnail.
- The video goes to the instance's Cloudinary account from the browser first.
- Scheduled runs then move it to YouTube in resumable 8 MiB chunks, wait for YouTube to process it, and set the thumbnail.
- The page shows each upload's state in words, its progress, any reason it stopped, and retry or cancel where they apply.
- Claude can do the same through the MCP tools (`MCP_DOCUMENTATION.md`).
- A vertical or square video of at most three minutes becomes a Short. YouTube decides this from the file itself; there is no separate Shorts upload.
- Playlists are not part of this release. Adding a video to a playlist needs Google's full `youtube` scope; Twiligent asks only to upload and to read, so a leaked token can never change or delete what is already on a channel.

## Verifying a channel

1. `GET /api/auth/youtube/url?accountId=<id>` (signed in, for one of the person's own YouTube accounts) returns Google's consent URL:
   - scopes `youtube.upload` and `youtube.readonly`;
   - `access_type=offline` and `prompt=consent`, so a refresh token comes back every time;
   - no `include_granted_scopes`: the instance may reuse a client that also signs people in with Google, and merging those sign-in scopes (`openid`, `email`, `profile`) makes Google refuse a Brand Account channel, which accepts YouTube scopes only (#173);
   - a state signed with the Google client secret that names the person and the account (`createOAuthState` with a subject).
2. Google sends the browser to the public `GET /api/auth/youtube/callback`.
   - It checks the state's signature and redirects to the Accounts page with `#yt_code=...&yt_state=...` in the fragment, which never reaches a server or a referrer.
   - A cancelled or changed sign-in goes back with `?yt_error=...`.
3. The signed-in app posts the code to `POST /api/auth/youtube/complete`. The service:
   - refuses a state started by anyone else (403), or one that names no account or an account that is gone;
   - exchanges the code;
   - reads the channel with `channels.list?mine=true`, which answers for the channel the person picked in Google's channel chooser;
   - refuses any channel but the account's own (400, naming both channels), after revoking the access Google just granted. This is the proof of ownership: only a Google account that manages the channel can return it;
   - stores both tokens sealed with AES-GCM under a key derived from `TOKEN_ENCRYPTION_KEY` (`backend/lib/tokenCrypto.ts`), linked to the account.
4. Verifying the same channel again renews its tokens in place and puts any parked uploads back in the queue.
5. **Turn off** on the card asks Google to revoke the refresh token, then deletes the connection with its upload queue and history. Removing the YouTube account does the same first (`accountService.remove` calls `disconnectChannel`). Videos already on YouTube stay.

Tokens never appear in a response, a log or an MCP result. A refresh Google refuses (`invalid_grant`), or a token that no longer unseals because the key changed, marks the connection `needs_reconnect` and parks its uploads without spending their attempts.

## The upload pipeline

**Where the work happens:**
- One row per video in `youtube_uploads`, holding:
  - a snapshot of the metadata;
  - the Cloudinary source (address, size, content type);
  - the resumable session, the bytes Google confirmed and the video id;
  - the state, attempts, next attempt and a lease.
- The five minute cron gives the second run of each quarter hour, at minutes 5, 20, 35 and 50, to `youtubeRunner.run()` (`backend/services/youtubeUploadRunner.ts`).
- Each run claims one due job with `claim_youtube_upload` (`FOR UPDATE SKIP LOCKED`, a 10 minute lease) and moves it as far as its 50 subrequests and 12 minutes allow. Every write checks the run still holds the lease.

**What one run does:**
1. **Queued:**
   - It reserves one call from the day's `uploads` bucket (`reserve_youtube_quota`).
   - It opens a resumable session (`videos.insert`, `uploadType=resumable`, `part=snippet,status`).
   - It saves the session address before any byte goes out, so a run that dies resumes it instead of starting a second video.
2. **Uploading:**
   - It asks Google how many bytes it holds (`Content-Range: bytes */total`) and resumes from there.
   - Each chunk is read from Cloudinary with a `Range` request, sent with an exact `Content-Range` and saved.
   - Chunks are 8 MiB, a multiple of 256 KiB, the same size except the last. Each costs three subrequests (the read, the write and the save), so a run moves about 13 chunks, roughly 100 MB.
3. **Processing:**
   - The next runs check `videos.list` (`part=status,processingDetails`, 1 unit) every 3 minutes until YouTube reports the video processed, failed or rejected.
4. **Finalizing:**
   - When there is a thumbnail, it is read from Cloudinary and set with `thumbnails.set` (50 units).
   - A thumbnail YouTube refuses, such as on an unverified channel, never undoes the upload: the job ends `done` with a note.

## States

| State | Meaning | What happens next |
|---|---|---|
| `queued` | Waiting for a run | The next YouTube run opens the session |
| `uploading` | Chunks are being sent | Each run continues from Google's own count |
| `processing` | YouTube has the whole file | Checked every 3 minutes |
| `finalizing` | Processed; the thumbnail is being set | One more step |
| `done` | On the channel | Nothing; the page links to the video |
| `waiting_quota` | The day's allowance is used up | Continues after midnight Pacific time |
| `needs_reconnect` | Google stopped accepting the sign-in | Signing in again puts it back in the queue |
| `needs_review` | Every byte was sent but the answer and the session were lost | A person checks the channel; retry would start a second upload |
| `failed` | A lasting error, or 8 passing errors in a row | Retry starts again from byte 0 |
| `cancelled` | Stopped before YouTube had the video | Nothing |

**How errors are handled:**
- Passing errors back off exponentially with jitter, from a minute to about four hours. They are network failures, timeouts, 5xx, 429, database errors and Cloudinary hiccups.
- An upload address that expired before the last byte (404 or 410) starts again from byte 0.
- `quotaExceeded` and its kin wait until midnight Pacific time.

## Quota

The Google Cloud project's daily allowance is shared by every channel on the instance:
- 100 `videos.insert` calls a day;
- 10,000 units for everything else.

`youtube_quota_usage` counts both per Pacific day, and `reserve_youtube_quota` takes units atomically before each call, so Twiligent stops before Google refuses. The analytics features use the instance's API key and their own per-member meter (`youtubeQuotaService`, audit lead L6).

## Limits

- **Video size:** Cloudinary's plan sets the largest video, 100 MB on the free plan. Larger videos need a paid plan.
- **Throughput:** four YouTube runs an hour move about 400 MB an hour. Each run handles one job at a time.
- **Worker CPU:** each chunk copies 8 MiB through the Worker. Whether that stays within the Workers Free plan's 10 ms of CPU per invocation has not been measured; if it does not, the run fails as a passing error and the paid plan is the fix.
- **The Google app's publishing status:** while the OAuth consent screen is in testing, only its listed test users can sign in and their refresh tokens expire after 7 days; publish it to production. An app not verified by Google shows people an unverified-app screen at sign-in and is limited to 100 users. Google's `videos.insert` reference (checked 5 Nov 2026) no longer locks uploads from unaudited API projects as private; Google confirmed the change on its issue tracker in October 2026, though its revision history still has the 2020 rule.

## Security

**Who can reach what:**
- Every request method is scoped to the verified user.
- An upload is built only from the caller's own connection and media.
- The runner reads only Cloudinary addresses (`fetchFileRange` and `fetchWholeFile` refuse any other host), so a changed row cannot point the Worker elsewhere.
- A browser upload is added to the library only from this instance's own cloud (`res.cloudinary.com/<cloud>/<type>/upload/`), with its size measured by the server.

**Google sign-in and tokens:**
- The Google sign-in is finished by the person who started it, through the authenticated complete step (ADR-050).
- Tokens are sealed at rest and revoked at Google on disconnect.

**Claude tools:**
- Queuing or changing a public, unlisted or scheduled video asks for a confirmation that shows the title, visibility, publish time and description.
- Cancelling always asks.

## Setting it up (instance owner)

1. In Google Cloud:
   - create or choose a project;
   - enable **YouTube Data API v3**;
   - configure the OAuth consent screen, add the scopes `youtube.upload` and `youtube.readonly`, and publish it to production (see Limits);
   - create an OAuth client of type **Web application** with the redirect URI `https://<worker>/api/auth/youtube/callback`.
2. Set the Worker secrets:
   - `npx wrangler secret put GOOGLE_CLIENT_ID`
   - `npx wrangler secret put GOOGLE_CLIENT_SECRET`
   - `npx wrangler secret put TOKEN_ENCRYPTION_KEY`: 32 or more random characters, for example from `openssl rand -base64 48`. Changing it later makes every stored token unreadable, and people must connect again.
3. Apply the migrations: `npm run db:push`, then `npm run db:schema`.
4. Deploy the Worker. On the Accounts page, add the channel if it is not there, then choose **Verify** on its card.

The public guide is at `https://twiligent.ujjwal.fyi/docs/self-host/youtube-publishing` (source: `site/content/docs/self-host/youtube-publishing.mdx`).

## Verified and not verified

**Verified:** unit and service tests cover every runner transition:
- session-before-bytes;
- resume from Google's count;
- the run budget;
- quota, reconnect, expired session, lost answer;
- passing and lasting errors;
- processing and thumbnail;
- a lost lease.

They also cover the sign-in binding and token sealing, the upload service's ownership and limits, the callback, the tools and the page helpers.

**Not verified:** a live upload to a real channel, Google's exact answers against this code, and the Worker's CPU use per chunk. These need the owner's Google client. The Google API calls follow the documentation recorded in `research/youtube.md`.
