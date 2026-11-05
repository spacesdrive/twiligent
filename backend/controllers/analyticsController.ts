import { controller, pathParam, servicesFor } from './http.ts';
import { queryParams } from '../middleware/validate.ts';
import { parseFreshQuery } from '../validators/analyticsValidators.ts';
import type { YouTubeAnalyticsPayload, YouTubeVideosResponse } from '../../shared/types/youtube.ts';
import type { InstagramAnalyticsResponse, InstagramMediaResponse } from '../../shared/types/instagram.ts';

export const getChannelAnalytics = controller.createHandlers(async c => {
    const result = await servicesFor(c).youtubeAnalytics.channelAnalytics(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true, ...result } satisfies YouTubeAnalyticsPayload);
});

export const getChannelVideos = controller.createHandlers(queryParams(parseFreshQuery), async c => {
    const result = await servicesFor(c).youtubeAnalytics.channelVideos(c.get('userId'), pathParam(c, 'id'), c.req.valid('query'));
    return c.json({ success: true, ...result } satisfies YouTubeVideosResponse);
});

export const getInstagramAnalytics = controller.createHandlers(async c => {
    const result = await servicesFor(c).instagramAnalytics.analytics(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true, ...result } satisfies InstagramAnalyticsResponse);
});

export const getInstagramMedia = controller.createHandlers(queryParams(parseFreshQuery), async c => {
    const result = await servicesFor(c).instagramAnalytics.media(c.get('userId'), pathParam(c, 'id'), c.req.valid('query'));
    return c.json({ success: true, ...result } satisfies InstagramMediaResponse);
});
