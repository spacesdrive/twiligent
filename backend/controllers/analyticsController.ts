import { controller, pathParam, servicesFor } from './http.ts';
import { queryParams } from '../middleware/validate.ts';
import { parseVideoLibraryQuery } from '../validators/analyticsValidators.ts';
import type {
    YouTubeAnalyticsPayload, YouTubeComparisonResponse, YouTubeLibraryResponse, YouTubeVideosResponse,
} from '../../shared/types/youtube.ts';
import type { InstagramAnalyticsResponse, InstagramMediaResponse } from '../../shared/types/instagram.ts';

export const getChannelAnalytics = controller.createHandlers(async c => {
    const result = await servicesFor(c).youtubeAnalytics.channelAnalytics(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true, ...result } satisfies YouTubeAnalyticsPayload);
});

export const getChannelVideos = controller.createHandlers(async c => {
    const result = await servicesFor(c).youtubeAnalytics.channelVideos(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true, ...result } satisfies YouTubeVideosResponse);
});

export const getComparison = controller.createHandlers(async c => {
    const comparison = await servicesFor(c).youtubeAnalytics.comparison(c.get('userId'));
    return c.json({ success: true, comparison } satisfies YouTubeComparisonResponse);
});

export const getVideoLibrary = controller.createHandlers(queryParams(parseVideoLibraryQuery), async c => {
    const { videos, channels } = await servicesFor(c).youtubeAnalytics.videoLibrary(c.get('userId'), c.req.valid('query'));
    return c.json({ success: true, videos, total: videos.length, channels } satisfies YouTubeLibraryResponse);
});

export const getInstagramAnalytics = controller.createHandlers(async c => {
    const result = await servicesFor(c).instagramAnalytics.analytics(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true, ...result } satisfies InstagramAnalyticsResponse);
});

export const getInstagramMedia = controller.createHandlers(async c => {
    const result = await servicesFor(c).instagramAnalytics.media(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true, ...result } satisfies InstagramMediaResponse);
});
