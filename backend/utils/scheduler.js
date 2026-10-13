// fetch is a global in Cloudflare Workers.
import { getDuePosts, updatePost, getAccountById } from '../lib/db.js';
import { buildMediaParams } from '../services/instagram.js';

export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// Called by the cron trigger (every 15 min). Receives supabase directly since
// there is no Hono request context in cron handlers.
export async function processScheduledPosts(supabase) {
    let processed = 0;
    const errors = [];

    try {
        const duePosts = await getDuePosts(supabase);

        for (const post of duePosts) {
            await updatePost(supabase, post.id, { status: 'publishing' });

            try {
                const acct = await getAccountById(supabase, post.accountId);
                if (!acct) throw new Error('Account not found: ' + post.accountId);

                const igId = acct.igUserId;
                const token = acct.accessToken;
                const params = buildMediaParams(post, token);

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

                await updatePost(supabase, post.id, {
                    status: 'published',
                    publishedMediaId: pubData.id,
                    publishedAt: new Date().toISOString(),
                });
                processed++;
                console.log(`Published scheduled post ${post.id} → media ${pubData.id}`);

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
