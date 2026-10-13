// fetch is a global in Cloudflare Workers.
import { getDuePosts, updatePost, getAccountById, claimPost } from '../lib/db.ts';
import { buildMediaParams } from '../services/instagram.ts';

const GRAPH_API = 'https://graph.instagram.com/v25.0';

export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function createContainer(igId, params) {
    const query = new URLSearchParams(params).toString();
    const createRes = await fetch(`${GRAPH_API}/${igId}/media?${query}`, { method: 'POST' });
    const createData = await createRes.json();
    if (createData.error) throw new Error(createData.error.message);
    return createData.id;
}

// reels and stories need processing; other media only need a short pause
async function waitForContainer(mediaType, containerId, token) {
    if (mediaType !== 'REELS' && mediaType !== 'STORIES') {
        await wait(2000);
        return;
    }
    for (let i = 0; i < 60; i++) {
        await wait(3000);
        const statusRes = await fetch(`${GRAPH_API}/${containerId}?fields=status_code,status&access_token=${token}`);
        const statusData = await statusRes.json();
        if (statusData.status_code === 'FINISHED' || statusData.status_code === 'PUBLISHED') return;
        if (statusData.status_code === 'ERROR') throw new Error('Processing failed: ' + (statusData.status || ''));
        if (statusData.status_code === 'EXPIRED') throw new Error('Container expired');
    }
}

async function publishContainer(igId, containerId, token) {
    const pubRes = await fetch(
        `${GRAPH_API}/${igId}/media_publish?creation_id=${containerId}&access_token=${token}`,
        { method: 'POST' }
    );
    const pubData = await pubRes.json();
    if (pubData.error) throw new Error(pubData.error.message);
    return pubData.id;
}

async function publishPost(supabase, post) {
    const acct = await getAccountById(supabase, post.accountId);
    if (!acct) throw new Error('Account not found: ' + post.accountId);

    const igId = acct.igUserId;
    const token = acct.accessToken;
    const params = buildMediaParams(post, token);

    const containerId = await createContainer(igId, params);
    await waitForContainer(post.mediaType, containerId, token);
    return publishContainer(igId, containerId, token);
}

// cron entry: there is no request context, so supabase is passed in directly
export async function processScheduledPosts(supabase) {
    let processed = 0;
    const errors = [];

    try {
        const duePosts = await getDuePosts(supabase);

        for (const post of duePosts) {
            if (!(await claimPost(supabase, post.id))) continue;

            try {
                const mediaId = await publishPost(supabase, post);
                await updatePost(supabase, post.id, {
                    status: 'published',
                    publishedMediaId: mediaId,
                    publishedAt: new Date().toISOString(),
                });
                processed++;
                console.log(`Published scheduled post ${post.id} → media ${mediaId}`);
            } catch (err) {
                await updatePost(supabase, post.id, { status: 'failed', error: err.message });
                errors.push({ id: post.id, error: err.message });
                console.error(`Failed to publish scheduled post ${post.id}: ${err.message}`);
            }
        }
    } catch (err) {
        console.error('Scheduler error:', err);
    }

    return { processed, errors };
}
