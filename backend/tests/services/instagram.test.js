import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    classifyInstagramMedia,
    extractInstagramViews,
    normalizeInstagramMedia,
    fetchInstagramMedia,
    summarizeContentTypes,
    computeInstagramAnalytics,
} from '../../services/instagram.js';

const viewsInsight = (value) => ({ data: [{ name: 'views', period: 'lifetime', values: [{ value }] }] });

describe('classifyInstagramMedia', () => {
    test('reel reported as VIDEO with REELS product type is a reel', () => {
        assert.equal(classifyInstagramMedia({ media_type: 'VIDEO', media_product_type: 'REELS' }), 'reel');
    });

    test('in-feed video with FEED product type is a video', () => {
        assert.equal(classifyInstagramMedia({ media_type: 'VIDEO', media_product_type: 'FEED' }), 'video');
    });

    test('images and carousels are posts', () => {
        assert.equal(classifyInstagramMedia({ media_type: 'IMAGE', media_product_type: 'FEED' }), 'post');
        assert.equal(classifyInstagramMedia({ media_type: 'CAROUSEL_ALBUM', media_product_type: 'FEED' }), 'post');
    });

    test('falls back to the reel permalink when product type is missing', () => {
        assert.equal(classifyInstagramMedia({ media_type: 'VIDEO', permalink: 'https://www.instagram.com/reel/C1a2b3/' }), 'reel');
        assert.equal(classifyInstagramMedia({ media_type: 'VIDEO', permalink: 'https://www.instagram.com/p/C1a2b3/' }), 'video');
    });

    test('product type wins over a reel-looking permalink', () => {
        assert.equal(classifyInstagramMedia({ media_type: 'VIDEO', media_product_type: 'FEED', permalink: 'https://www.instagram.com/reel/x/' }), 'video');
    });

    test('handles lowercase values and legacy REEL media types', () => {
        assert.equal(classifyInstagramMedia({ media_type: 'video', media_product_type: 'reels' }), 'reel');
        assert.equal(classifyInstagramMedia({ media_type: 'REEL' }), 'reel');
        assert.equal(classifyInstagramMedia({ media_type: 'REELS' }), 'reel');
    });

    test('unknown or empty input defaults to post', () => {
        assert.equal(classifyInstagramMedia({}), 'post');
        assert.equal(classifyInstagramMedia(null), 'post');
    });
});

describe('extractInstagramViews', () => {
    test('reads the lifetime value', () => {
        assert.equal(extractInstagramViews({ insights: viewsInsight(1234) }), 1234);
    });

    test('keeps a genuine zero', () => {
        assert.equal(extractInstagramViews({ insights: viewsInsight(0) }), 0);
    });

    test('reads total_value when values is absent', () => {
        assert.equal(extractInstagramViews({ insights: { data: [{ name: 'views', total_value: { value: 88 } }] } }), 88);
    });

    test('returns null when insights are missing, empty, or malformed', () => {
        assert.equal(extractInstagramViews({}), null);
        assert.equal(extractInstagramViews({ insights: { data: [] } }), null);
        assert.equal(extractInstagramViews({ insights: viewsInsight('n/a') }), null);
    });
});

describe('normalizeInstagramMedia', () => {
    test('reel keeps its cover as the thumbnail and never uses the video file', () => {
        const item = normalizeInstagramMedia({
            id: '1', media_type: 'VIDEO', media_product_type: 'REELS',
            media_url: 'https://cdn/video.mp4', like_count: 44, comments_count: 6,
            insights: viewsInsight(900),
        });
        assert.equal(item.contentType, 'reel');
        assert.equal(item.thumbnailUrl, '');
        assert.equal(item.viewCount, 900);
        assert.equal(item.likeCount, 44);
    });

    test('image post uses media_url as the thumbnail', () => {
        const item = normalizeInstagramMedia({ id: '2', media_type: 'IMAGE', media_product_type: 'FEED', media_url: 'https://cdn/img.jpg' });
        assert.equal(item.contentType, 'post');
        assert.equal(item.thumbnailUrl, 'https://cdn/img.jpg');
        assert.equal(item.viewCount, null);
    });
});

describe('fetchInstagramMedia', () => {
    const originalFetch = globalThis.fetch;
    afterEach(() => { globalThis.fetch = originalFetch; });

    test('retries a page without insights when the insights request fails', async () => {
        const requests = [];
        globalThis.fetch = async (url) => {
            const fields = new URL(url).searchParams.get('fields');
            requests.push(fields);
            if (fields.includes('insights')) {
                return { json: async () => ({ error: { message: 'Media posted before business account conversion' } }) };
            }
            return { json: async () => ({ data: [{ id: 'a', media_type: 'VIDEO', media_product_type: 'REELS' }] }) };
        };

        const media = await fetchInstagramMedia('123', 'token', 500);
        assert.equal(requests.length, 2);
        assert.equal(media.length, 1);
        assert.equal(media[0].contentType, 'reel');
        assert.equal(media[0].viewCount, null);
    });

    test('follows cursors, drops duplicate ids, and respects the limit', async () => {
        const pages = {
            '': { data: [{ id: 'a', media_type: 'IMAGE' }, { id: 'b', media_type: 'VIDEO', media_product_type: 'REELS', insights: viewsInsight(5) }], paging: { cursors: { after: 'p2' }, next: 'https://next' } },
            p2: { data: [{ id: 'b', media_type: 'VIDEO', media_product_type: 'REELS' }, { id: 'c', media_type: 'VIDEO', media_product_type: 'FEED' }], paging: { cursors: { after: 'p3' } } },
        };
        globalThis.fetch = async (url) => {
            const after = new URL(url).searchParams.get('after') ?? '';
            return { json: async () => pages[after] };
        };

        const media = await fetchInstagramMedia('123', 'token', 500);
        assert.deepEqual(media.map(m => m.id), ['a', 'b', 'c']);
        assert.deepEqual(media.map(m => m.contentType), ['post', 'reel', 'video']);

        const limited = await fetchInstagramMedia('123', 'token', 1);
        assert.equal(limited.length, 1);
    });
});

describe('content type tracking', () => {
    const media = [
        { id: '1', contentType: 'reel', likeCount: 44, commentsCount: 6, viewCount: 1000, timestamp: '2026-08-20T10:00:00+0000', caption: '' },
        { id: '2', contentType: 'reel', likeCount: 11, commentsCount: 8, viewCount: null, timestamp: '2026-08-21T10:00:00+0000', caption: '' },
        { id: '3', contentType: 'post', likeCount: 2, commentsCount: 0, viewCount: 50, timestamp: '2026-06-01T10:00:00+0000', caption: '' },
        { id: '4', contentType: 'video', likeCount: 7, commentsCount: 1, viewCount: 300, timestamp: '2025-01-01T10:00:00+0000', caption: '' },
    ];

    test('summarizeContentTypes counts each item exactly once', () => {
        const summary = summarizeContentTypes(media);
        assert.equal(summary.reel.count + summary.post.count + summary.video.count, media.length);
        assert.deepEqual(summary.reel, { count: 2, likes: 55, comments: 14, views: 1000, viewsReported: 1 });
        assert.deepEqual(summary.post, { count: 1, likes: 2, comments: 0, views: 50, viewsReported: 1 });
        assert.deepEqual(summary.video, { count: 1, likes: 7, comments: 1, views: 300, viewsReported: 1 });
    });

    test('summarizeContentTypes always returns all three types', () => {
        const summary = summarizeContentTypes([]);
        assert.deepEqual(Object.keys(summary), ['reel', 'post', 'video']);
        assert.equal(summary.reel.count, 0);
    });

    test('computeInstagramAnalytics splits counts and views by type without double counting', () => {
        const analytics = computeInstagramAnalytics({ followersCount: 100, mediaCount: 4 }, media);
        const { reel, post, video } = analytics.contentTypeStats;

        assert.equal(reel.count, 2);
        assert.equal(post.count, 1);
        assert.equal(video.count, 1);
        assert.equal(reel.totalViews, 1000);
        assert.equal(reel.avgViews, 1000);
        assert.equal(analytics.totalViews, reel.totalViews + post.totalViews + video.totalViews);
        assert.equal(analytics.totalLikes, reel.totalLikes + post.totalLikes + video.totalLikes);
        assert.equal(analytics.mediaWithViews, 3);
        assert.equal(analytics.avgViews, Math.round(1350 / 3));
    });

    test('computeInstagramAnalytics returns empty type stats with no media', () => {
        const analytics = computeInstagramAnalytics({ mediaCount: 0 }, []);
        assert.equal(analytics.totalViews, 0);
        assert.equal(analytics.contentTypeStats.reel.count, 0);
        assert.equal(analytics.contentTypeStats.video.avgViews, 0);
    });
});
