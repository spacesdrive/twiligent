#!/usr/bin/env node
/**
 * Instagram Scheduled Post Publisher
 * 
 * Runs standalone in GitHub Actions (cron every 15 min).
 * Reads scheduled posts, publishes due ones to Instagram, updates the file.
 * 
 * Environment variables (set as GitHub Secrets):
 *   ACCOUNTS_JSON - Base64-encoded contents of accounts.json
 * 
 * Requires Node.js 18+ (uses native fetch).
 */

const fs = require('fs');
const path = require('path');

const SCHEDULED_POSTS_FILE = path.join(__dirname, '..', 'backend', 'data', 'scheduled_posts.json');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAccounts() {
    // Priority 1: ACCOUNTS_JSON env var (GitHub Actions)
    if (process.env.ACCOUNTS_JSON) {
        try {
            return JSON.parse(Buffer.from(process.env.ACCOUNTS_JSON, 'base64').toString('utf8'));
        } catch {
            // Maybe it's plain JSON, not base64
            return JSON.parse(process.env.ACCOUNTS_JSON);
        }
    }
    // Priority 2: Local file
    const localFile = path.join(__dirname, '..', 'backend', 'data', 'accounts.json');
    if (fs.existsSync(localFile)) {
        return JSON.parse(fs.readFileSync(localFile, 'utf8'));
    }
    return [];
}

function getScheduledPosts() {
    if (!fs.existsSync(SCHEDULED_POSTS_FILE)) return [];
    return JSON.parse(fs.readFileSync(SCHEDULED_POSTS_FILE, 'utf8'));
}

function saveScheduledPosts(posts) {
    fs.writeFileSync(SCHEDULED_POSTS_FILE, JSON.stringify(posts, null, 2));
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ─── Instagram Publishing ────────────────────────────────────────────────────

async function publishPost(post, accounts) {
    const acct = accounts.find(a => a.id === post.accountId);
    if (!acct) throw new Error('Account not found: ' + post.accountId);

    const igId = acct.igUserId;
    const token = acct.accessToken;
    const params = { access_token: token };

    // Build container params based on media type
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
        // IMAGE
        params.image_url = post.mediaUrl;
        if (post.caption) params.caption = post.caption;
        if (post.locationId) params.location_id = post.locationId;
        if (post.userTags?.length) params.user_tags = JSON.stringify(post.userTags);
        if (post.altText) params.alt_text = post.altText;
    }

    // Step 1: Create container
    const qs = new URLSearchParams(params).toString();
    const createRes = await fetch(
        `https://graph.instagram.com/v25.0/${igId}/media?${qs}`,
        { method: 'POST' }
    );
    const createData = await createRes.json();
    if (createData.error) throw new Error(createData.error.message);

    const containerId = createData.id;

    // Step 2: Wait for processing (videos/reels need polling)
    if (post.mediaType === 'REELS' || post.mediaType === 'STORIES') {
        for (let i = 0; i < 60; i++) {
            await sleep(3000);
            const statusRes = await fetch(
                `https://graph.instagram.com/v25.0/${containerId}?fields=status_code,status&access_token=${token}`
            );
            const statusData = await statusRes.json();
            if (statusData.status_code === 'FINISHED' || statusData.status_code === 'PUBLISHED') break;
            if (statusData.status_code === 'ERROR') throw new Error('Processing failed: ' + (statusData.status || ''));
            if (statusData.status_code === 'EXPIRED') throw new Error('Container expired');
        }
    } else {
        await sleep(2000);
    }

    // Step 3: Publish
    const pubRes = await fetch(
        `https://graph.instagram.com/v25.0/${igId}/media_publish?creation_id=${containerId}&access_token=${token}`,
        { method: 'POST' }
    );
    const pubData = await pubRes.json();
    if (pubData.error) throw new Error(pubData.error.message);

    return pubData.id;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log('📅 Instagram Scheduled Post Publisher');
    console.log(`   Time: ${new Date().toISOString()}`);
    console.log('');

    const accounts = getAccounts();
    if (!accounts.length) {
        console.log('❌ No accounts found.');
        console.log('   Set the ACCOUNTS_JSON secret (base64 of accounts.json)');
        process.exit(1);
    }
    console.log(`   Accounts loaded: ${accounts.length}`);

    const posts = getScheduledPosts();
    const now = new Date();
    const duePosts = posts.filter(p => p.status === 'pending' && new Date(p.scheduledAt) <= now);

    if (!duePosts.length) {
        console.log('✓ No posts due for publishing');
        process.exit(0);
    }

    console.log(`⏰ ${duePosts.length} post(s) due for publishing\n`);
    let processed = 0;

    for (const post of duePosts) {
        console.log(`  Publishing: ${post.id} (${post.mediaType}) — scheduled for ${post.scheduledAt}`);
        post.status = 'publishing';
        saveScheduledPosts(posts);

        try {
            const mediaId = await publishPost(post, accounts);
            post.status = 'published';
            post.publishedMediaId = mediaId;
            post.publishedAt = new Date().toISOString();
            processed++;
            console.log(`  ✓ Published → media ${mediaId}`);
        } catch (err) {
            post.status = 'failed';
            post.error = err.message;
            console.error(`  ✗ Failed: ${err.message}`);
        }

        saveScheduledPosts(posts);
    }

    console.log(`\n📊 Results: ${processed}/${duePosts.length} published successfully`);
    // Exit 0 even if some failed — so the commit step still runs
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
