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
2. Every 15 minutes, one of two schedulers fires:
   A. Cloudflare Worker cron -> runScheduledJob() -> scheduledPublisher.publishDue()
   B. GitHub Actions -> node scripts/publish-scheduled.ts -> direct Supabase REST calls
        │
        ▼
3. Scheduler queries due posts:
   SELECT * FROM scheduled_posts WHERE status='pending' AND scheduled_at <= now()
        │
        ▼
4. For each due post:
   a. UPDATE scheduled_posts SET status='publishing' WHERE id=:id AND status='pending'
      (This is the mutex - prevents double-publish if both schedulers fire simultaneously)
   
   b. SELECT account WHERE id=:accountId
      (Gets the accessToken from accounts.data; a missing account, an account on another
      platform or a missing token fails the post with a message that says which)
   
   c. Execute the publish pipeline (same as immediate publishing, steps 2-4 above); the
      schedulers poll a Reel or Story up to 60 times (3 minutes) and fail the post if it
      is still processing
   
   d. On success: UPDATE SET status='published', data.publishedMediaId=:id, data.publishedAt=:ts
   
   e. On failure: UPDATE SET status='failed', data.error=:message
```

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
| Processing timeout | The container was still processing after the last poll | Try again later, or use a shorter or smaller video |
| `status=failed` in scheduled post | Any of the above, plus `accessToken` expired | Re-connect the account |
