import { controller, pathParam, servicesFor } from './http.ts';
import { queryParams } from '../middleware/validate.ts';
import { parseFreshQuery } from '../validators/analyticsValidators.ts';
import type { RedditCacheData, RedditPost } from '../../shared/types/reddit.ts';

export const getRedditAnalytics = controller.createHandlers(queryParams(parseFreshQuery), async c => {
    const result = await servicesFor(c).redditAnalytics.analytics(c.get('userId'), pathParam(c, 'id'), c.req.valid('query'));
    return c.json(result satisfies RedditCacheData);
});

export const getRedditPosts = controller.createHandlers(async c => {
    const posts = await servicesFor(c).redditAnalytics.posts(c.get('userId'), pathParam(c, 'id'));
    return c.json(posts satisfies RedditPost[]);
});
