#!/usr/bin/env node
/**
 * Instagram Scheduled Post Publisher
 *
 * Runs standalone in GitHub Actions (cron every 15 min).
 * Uses native fetch (Node 18+) and the Supabase REST API - no npm install needed.
 *
 * Required GitHub Secrets:
 *   SUPABASE_URL         - your Supabase project URL
 *   SUPABASE_SERVICE_KEY - your Supabase service role key (bypasses RLS)
 */

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/^﻿/, '').trim();
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY?.replace(/^﻿/, '').trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    console.error('   Add these as GitHub Actions secrets in your repo settings.');
    process.exit(1);
}

// ─── Supabase REST helpers (no SDK, native fetch only) ────────────────────────

const sbHeaders = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
};

async function sbGet(path) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { headers: sbHeaders });
    if (!res.ok) throw new Error(`Supabase GET ${path}: ${await res.text()}`);
    return res.json();
}

async function sbPatch(path, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
        method: 'PATCH',
        headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase PATCH ${path}: ${await res.text()}`);
}

// ─── Data access ──────────────────────────────────────────────────────────────

async function getDuePosts() {
    const now = encodeURIComponent(new Date().toISOString());
    const rows = await sbGet(
        `/scheduled_posts?status=eq.pending&scheduled_at=lte.${now}&select=id,account_id,status,scheduled_at,data`
    );
    return (rows || []).map(row => ({
        id: row.id,
        accountId: row.account_id,
        status: row.status,
        scheduledAt: row.scheduled_at,
        ...(row.data || {}),
    }));
}

async function getAccount(accountId) {
    const rows = await sbGet(`/accounts?id=eq.${accountId}&select=id,platform,data`);
    if (!rows || rows.length === 0) return null;
    return { id: rows[0].id, platform: rows[0].platform, ...(rows[0].data || {}) };
}

async function updatePostStatus(id, updates) {
    const { status, ...dataUpdates } = updates;
    const patch = {};
    if (status) patch.status = status;

    if (Object.keys(dataUpdates).length > 0) {
        const rows = await sbGet(`/scheduled_posts?id=eq.${id}&select=data`);
        const currentData = rows?.[0]?.data || {};
        patch.data = { ...currentData, ...dataUpdates };
    }

    await sbPatch(`/scheduled_posts?id=eq.${id}`, patch);
}

// ─── Instagram publishing ─────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function publishToInstagram(post, account) {
    const igId = account.igUserId;
    const token = account.accessToken;
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

    const pubRes = await fetch(
        `https://graph.instagram.com/v25.0/${igId}/media_publish?creation_id=${containerId}&access_token=${token}`,
        { method: 'POST' }
    );
    const pubData = await pubRes.json();
    if (pubData.error) throw new Error(pubData.error.message);

    return pubData.id;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('📅 Instagram Scheduled Post Publisher');
    console.log(`   Time: ${new Date().toISOString()}\n`);

    const duePosts = await getDuePosts();

    if (duePosts.length === 0) {
        console.log('✓ No posts due for publishing');
        process.exit(0);
    }

    console.log(`⏰ ${duePosts.length} post(s) due for publishing\n`);
    let processed = 0;

    for (const post of duePosts) {
        console.log(`  Publishing: ${post.id} (${post.mediaType}) - scheduled ${post.scheduledAt}`);
        await updatePostStatus(post.id, { status: 'publishing' });

        try {
            const account = await getAccount(post.accountId);
            if (!account) throw new Error('Account not found: ' + post.accountId);

            const mediaId = await publishToInstagram(post, account);
            await updatePostStatus(post.id, {
                status: 'published',
                publishedMediaId: mediaId,
                publishedAt: new Date().toISOString(),
            });
            processed++;
            console.log(`  ✓ Published → media ${mediaId}`);
        } catch (err) {
            await updatePostStatus(post.id, { status: 'failed', error: err.message });
            console.error(`  ✗ Failed: ${err.message}`);
        }
    }

    console.log(`\n📊 Results: ${processed}/${duePosts.length} published`);
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
