const fetch = require('node-fetch');
const { readJSON, writeJSON, SCHEDULED_POSTS_FILE, ACCOUNTS_FILE } = require('./dataHelpers');

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

let isProcessing = false;

async function processScheduledPosts() {
    if (isProcessing) return { processed: 0, message: 'Already processing' };
    isProcessing = true;
    let processed = 0;
    let errors = [];

    try {
        const posts = await readJSON(SCHEDULED_POSTS_FILE) || [];
        const accounts = await readJSON(ACCOUNTS_FILE) || [];
        const now = new Date();

        for (const post of posts) {
            if (post.status !== 'pending') continue;
            const scheduledDate = new Date(post.scheduledAt);
            if (scheduledDate > now) continue;

            post.status = 'publishing';
            await writeJSON(SCHEDULED_POSTS_FILE, posts);

            try {
                const acct = accounts.find(a => a.id === post.accountId);
                if (!acct) throw new Error('Account not found: ' + post.accountId);

                const igId = acct.igUserId;
                const token = acct.accessToken;
                const params = { access_token: token };

                if (post.mediaType === 'REELS') {
                    params.media_type = 'REELS';
                    params.video_url = post.mediaUrl;
                    if (post.caption) params.caption = post.caption;
                    if (post.shareToFeed !== undefined) params.share_to_feed = post.shareToFeed;
                    if (post.coverUrl) params.cover_url = post.coverUrl;
                    if (post.collaborators?.length) params.collaborators = JSON.stringify(post.collaborators);
                    if (post.audioName) params.audio_name = post.audioName;
                    if (post.thumbOffset != null) params.thumb_offset = post.thumbOffset;
                    if (post.locationId) params.location_id = post.locationId;
                    if (post.userTags?.length) params.user_tags = JSON.stringify(post.userTags);
                } else if (post.mediaType === 'STORIES') {
                    params.media_type = 'STORIES';
                    if (post.mediaUrl.match(/\.(mp4|mov|avi|webm)/i)) {
                        params.video_url = post.mediaUrl;
                    } else {
                        params.image_url = post.mediaUrl;
                    }
                    if (post.userTags?.length) params.user_tags = JSON.stringify(post.userTags);
                } else {
                    params.image_url = post.mediaUrl;
                    if (post.caption) params.caption = post.caption;
                    if (post.locationId) params.location_id = post.locationId;
                    if (post.userTags?.length) params.user_tags = JSON.stringify(post.userTags);
                    if (post.altText) params.alt_text = post.altText;
                }

                const qs = new URLSearchParams(params).toString();
                const createRes = await fetch(`https://graph.instagram.com/v25.0/${igId}/media?${qs}`, { method: 'POST' });
                const createData = await createRes.json();
                if (createData.error) throw new Error(createData.error.message);

                const containerId = createData.id;

                if (post.mediaType === 'REELS' || post.mediaType === 'STORIES') {
                    for (let i = 0; i < 60; i++) {
                        await new Promise(r => setTimeout(r, 3000));
                        const statusRes = await fetch(
                            `https://graph.instagram.com/v25.0/${containerId}?fields=status_code,status&access_token=${token}`
                        );
                        const statusData = await statusRes.json();
                        if (statusData.status_code === 'FINISHED' || statusData.status_code === 'PUBLISHED') break;
                        if (statusData.status_code === 'ERROR') throw new Error('Processing failed: ' + (statusData.status || ''));
                        if (statusData.status_code === 'EXPIRED') throw new Error('Container expired');
                    }
                } else {
                    await new Promise(r => setTimeout(r, 2000));
                }

                const pubRes = await fetch(
                    `https://graph.instagram.com/v25.0/${igId}/media_publish?creation_id=${containerId}&access_token=${token}`,
                    { method: 'POST' }
                );
                const pubData = await pubRes.json();
                if (pubData.error) throw new Error(pubData.error.message);

                post.status = 'published';
                post.publishedMediaId = pubData.id;
                post.publishedAt = new Date().toISOString();
                processed++;
                console.log(`  ✓ Published scheduled post ${post.id} → media ${pubData.id}`);

            } catch (err) {
                post.status = 'failed';
                post.error = err.message;
                errors.push({ id: post.id, error: err.message });
                console.error(`  ✗ Failed to publish scheduled post ${post.id}: ${err.message}`);
            }

            await writeJSON(SCHEDULED_POSTS_FILE, posts);
        }
    } catch (err) {
        console.error('Scheduler error:', err);
    } finally {
        isProcessing = false;
    }

    return { processed, errors };
}

module.exports = { generateId, processScheduledPosts, get isProcessing() { return isProcessing; } };
