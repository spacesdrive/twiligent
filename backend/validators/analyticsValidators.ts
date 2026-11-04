import { ValidationError } from '../lib/errors.ts';
import { optionalString } from './fields.ts';
import type { Fields } from './fields.ts';
import type { VideoLibraryQuery } from '../services/youtubeAnalyticsService.ts';

const SORT_ORDERS = ['asc', 'desc'];

function optionalCount(query: Fields, name: string): string | undefined {
    const value = optionalString(query, name);
    if (value && !/^\d+$/.test(value)) throw new ValidationError(`${name} must be a whole number`);
    return value || undefined;
}

export interface FreshQuery {
    fresh: boolean;
}

// ?fresh=1 on a cached read (reddit-analytics, videos, ig-media) skips the cache, for a person's explicit refresh
export function parseFreshQuery(query: Fields): FreshQuery {
    const fresh = optionalString(query, 'fresh');
    if (fresh && fresh !== '1') throw new ValidationError('fresh must be 1 when given');
    return { fresh: fresh === '1' };
}

// GET /api/videos/all?channelId=&search=&minViews=&maxViews=&sort=&order=
export function parseVideoLibraryQuery(query: Fields): VideoLibraryQuery {
    const order = optionalString(query, 'order');
    if (order && !SORT_ORDERS.includes(order)) throw new ValidationError('order must be asc or desc');
    return {
        channelId: optionalString(query, 'channelId') || undefined,
        search: optionalString(query, 'search') || undefined,
        minViews: optionalCount(query, 'minViews'),
        maxViews: optionalCount(query, 'maxViews'),
        sort: optionalString(query, 'sort') || undefined,
        order: order || undefined,
    };
}
