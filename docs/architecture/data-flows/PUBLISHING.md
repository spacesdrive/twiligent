# Data Flow - Instagram Publishing

## Immediate Publishing

```
User selects account + uploads media + fills caption
        │
        ▼
1. Frontend: Upload media to Cloudinary
   api.getCloudinaryConfig() -> GET /api/cloudinary-config
   -> returns { cloudName, uploadPreset }, or 503 when the Worker has no Cloudinary settings
   
   Browser uploads directly to Cloudinary using unsigned preset (api.uploadToCloudinary)
   -> Cloudinary returns public URL (e.g., https://res.cloudinary.com/cloud/image/upload/...)
        │
        ▼
2. Frontend: Create media container
   api.createIGContainer(accountId, { mediaUrl, caption, mediaType, ... })
   -> POST /api/accounts/:id/ig-publish
   -> Backend: publishing.createContainer() -> buildMediaParams() and createMediaContainer()
       POST https://graph.instagram.com/v25.0/{igUserId}/media
       params: { image_url|video_url, caption, media_type, access_token }
   -> 404 when the account is not an Instagram account of this user, 400 when it has no stored token
   -> Returns { containerId }
        │
        ▼
3. For REELS or STORIES: poll container status (images skip this step)
   api.getIGContainerStatus(containerId, accountId)
   -> GET /api/ig-container/:containerId/status?accountId=:id
   -> Backend: GET https://graph.instagram.com/v25.0/{containerId}?fields=status_code,status
   -> accountId is required (400 without it); the account must be an Instagram account with a token
   -> Poll every 3 seconds, up to 30 times (about 90 seconds); after that the post fails
      with a "took too long" message, in single and bulk publishing alike, because
      publishing an unfinished container fails anyway
   -> Wait for status_code = 'FINISHED'
   -> ERROR -> throw error, mark as failed
   -> EXPIRED -> throw error
        │
        ▼
4. Frontend: Publish the container
   api.publishIGContainer(accountId, containerId)
   -> POST /api/accounts/:id/ig-media-publish
   -> Backend: POST https://graph.instagram.com/v25.0/{igUserId}/media_publish
       body: { creation_id: containerId, access_token }
   -> Returns { mediaId }
        │
        ▼
5. Frontend: Show success toast with mediaId
```

## Scheduled Publishing

```
User creates a scheduled post
        │
        ▼
1. Frontend: api.createScheduledPost({ accountId, scheduledAt, mediaUrl, caption, ... })
   -> POST /api/scheduled-posts
   -> Backend: scheduledPosts.create(userId, request) -> posts.create(post, userId)
       (400 unless scheduledAt is a future date)
       INSERT INTO scheduled_posts (id, user_id, account_id, status='pending', scheduled_at, data)
        │
        ▼
2. A scheduler run starts:
   A. Cloudflare Worker cron, every 15 minutes -> runScheduledJob() -> scheduledPublisher.publishDue()
   B. GitHub Actions, asked for at minutes 7, 22, 37 and 52 but often started hours late
      -> node scripts/publish-scheduled.ts -> direct Supabase REST calls
        │
        ▼
3. Scheduler queries due posts and stale claims:
   SELECT * FROM scheduled_posts WHERE status='pending' AND scheduled_at <= now()
   SELECT * FROM scheduled_posts WHERE status='publishing' AND claimed_at < now() - 20 minutes
        │
        ▼
4. For each candidate:
   a. UPDATE scheduled_posts SET status='publishing', claimed_at=now(), attempts=attempts+1
      WHERE id=:id AND attempts=:attempts AND (status='pending' OR claimed_at=:expiredClaim)
      (Only one run gets the row; a stale claim is taken over by the next run)

   b. SELECT account WHERE id=:accountId
      (Gets the accessToken from accounts.data; a missing account, an account on another
      platform or a missing token fails the post with a message that says which)

   c. If data.containerId is saved, read its status_code first: PUBLISHED marks the post
      published, FINISHED publishes that container, EXPIRED creates a new one, ERROR fails it

   d. Execute the publish pipeline (same as immediate publishing, steps 2-4 above), saving
      data.containerId right after the container is created; the schedulers poll a Reel or
      Story up to 60 times (3 minutes)

   e. On success: UPDATE SET status='published', data.publishedMediaId=:id, data.publishedAt=:ts

   f. On failure: read the container status if there is one. PUBLISHED marks the post
      published; an unreadable status leaves it publishing for a run after the lease.
      A temporary failure sets status='pending' with data.error, up to 3 attempts;
      a definite failure or the third attempt sets status='failed', data.error=:message
```

The full failure table is in `docs/architecture/data-flows/SCHEDULING.md`.

## Media Type Differences

| Type | Container params | Status polling | Notes |
|---|---|---|---|
| IMAGE | `image_url`, optional `alt_text`, `location_id`, `user_tags` | No | Publishes immediately |
| REELS | `video_url`, `media_type=REELS`, optional `share_to_feed`, `cover_url`, `audio_name`, `thumb_offset`, `collaborators` | Yes | Requires FINISHED before publish |
| STORIES | `video_url` or `image_url`, `media_type=STORIES`, optional `user_tags` | Yes (for video) | Images publish immediately |

## Error States

| Error | Cause | Recovery |
|---|---|---|
| Container `ERROR` | Instagram processing failed (bad codec, too long, etc.) | User must re-upload |
| Container `EXPIRED` | >24 hours since container was created | User must re-create container |
| `media_publish` rejected | Usually quota exceeded or invalid containerId; the Worker answers 502 (`UPSTREAM_ERROR`) with Instagram's message | Check publishing limit |
| Processing timeout | The container was still processing after the last poll | A scheduled post is retried on the next run, up to 3 attempts; otherwise try again later, or use a shorter or smaller video |
| `status=failed` in scheduled post | Any of the above, plus `accessToken` expired, or a temporary failure on the third attempt | Re-connect the account if needed, then schedule the post again |
