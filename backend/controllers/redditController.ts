import { controller, pathParam, servicesFor } from './http.ts';
import type { RedditCacheData, RedditPost } from '../../shared/types/reddit.ts';

export const getRedditAnalytics = controller.createHandlers(async c => {
    const result = await servicesFor(c).redditAnalytics.analytics(c.get('userId'), pathParam(c, 'id'));
    return c.json(result satisfies RedditCacheData);
});

export const getRedditPosts = controller.createHandlers(async c => {
    const posts = await servicesFor(c).redditAnalytics.posts(c.get('userId'), pathParam(c, 'id'));
    return c.json(posts satisfies RedditPost[]);
});
