import { test, describe, afterEach } from 'node:test';
import { classifyInstagramMedia, extractInstagramViews, normalizeInstagramMedia, fetchInstagramMedia } from '../../services/instagramMedia.ts';
import type { InstagramApiMedia } from '../../services/instagramMedia.ts';
import { assertGolden } from '../fixtures/golden.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import type { FetchMock } from '../fixtures/fakeFetch.ts';

let fetchMock: FetchMock | null = null;
afterEach(() => fetchMock?.restore());

const rawItems = [
    { id: '1', media_type: 'VIDEO', media_product_type: 'REELS', media_url: 'https://cdn/v.mp4', thumbnail_url: 'https://cdn/t.jpg', cover_url: 'https://cdn/c.jpg', permalink: 'https://www.instagram.com/reel/1/', timestamp: '2026-08-01T10:00:00+0000', like_count: 9, comments_count: 2, caption: 'Reel', insights: { data: [{ name: 'views', values: [{ value: 300 }] }] } },
    { id: '2', media_type: 'IMAGE', media_url: 'https://cdn/i.jpg' },
    { id: '3', media_type: 'VIDEO', media_product_type: 'FEED', thumbnail_url: 'https://cdn/t3.jpg', insights: { data: [{ name: 'views', total_value: { value: '41' } }] } },
    { id: '4', media_type: 'CAROUSEL_ALBUM', insights: { data: [{ name: 'reach', values: [{ value: 5 }] }] } },
    { id: '5', permalink: 'https://instagram.com/reels/5/', insights: { data: [{ name: 'views', values: [{ value: null }] }] } },
    { id: '6', media_type: 'reel', insights: { data: [{ name: 'views', values: [{ value: 'Infinity' }] }] } },
    { id: '7' },
] as unknown as InstagramApiMedia[];

describe('instagram media golden output', () => {
    test('classifies, reads views and normalizes raw items', () => {
        assertGolden(rawItems.map(raw => ({
            type: classifyInstagramMedia(raw),
            views: extractInstagramViews(raw),
            normalized: normalizeInstagramMedia(raw),
        })), 'instagramMedia.normalize');
    });

    test('pages through media, falls back without insights and dedupes', async () => {
        fetchMock = installFetch((request) => {
            const params = new URL(request.url).searchParams;
            const after = params.get('after') ?? '';
            if (after === 'p2' && params.get('fields')!.includes('insights')) return reply({ error: { message: 'insights unavailable' } });
            if (after === '') return reply({ data: [rawItems[0], rawItems[1], null, { media_type: 'IMAGE' }], paging: { next: 'https://next', cursors: { after: 'p2' } } });
            if (after === 'p2') return reply({ data: [rawItems[1], rawItems[2]], paging: { next: 'https://next', cursors: { after: 'p3' } } });
            return reply({ data: [rawItems[3]], paging: { cursors: { after: 'p4' } } });
        });
        const media = await fetchInstagramMedia('17841', 'TOKEN');
        const limited = await fetchInstagramMedia('17841', 'TOKEN', 2);
        assertGolden({ media, limited, requests: fetchMock.requests }, 'instagramMedia.paging');
    });

    test('stops after ten pages even when more are offered', async () => {
        let counter = 0;
        fetchMock = installFetch(() => {
            counter++;
            return reply({ data: [{ id: `p${counter}`, media_type: 'IMAGE' }], paging: { next: 'https://next', cursors: { after: `c${counter}` } } });
        });
        const media = await fetchInstagramMedia('17841', 'TOKEN');
        assertGolden({ ids: media.map(item => item.id), requestCount: fetchMock.requests.length }, 'instagramMedia.pageCap');
    });
});
