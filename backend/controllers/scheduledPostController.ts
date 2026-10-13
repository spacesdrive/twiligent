import { controller, pathParam, servicesFor } from './http.ts';
import { jsonBody } from '../middleware/validate.ts';
import { parseScheduledPost, parseScheduledPostUpdate } from '../validators/scheduledPostValidators.ts';
import type {
    ScheduledPostDeleteAllResponse, ScheduledPostListResponse, ScheduledPostResponse, ScheduledPostUpdateResponse,
    ScheduledPublishRunResponse, SuccessMessageResponse,
} from '../../shared/types/domain.ts';

export const listScheduledPosts = controller.createHandlers(async c => {
    const posts = await servicesFor(c).scheduledPosts.list(c.get('userId'));
    return c.json({ success: true, posts } satisfies ScheduledPostListResponse);
});

export const createScheduledPost = controller.createHandlers(jsonBody(parseScheduledPost), async c => {
    const post = await servicesFor(c).scheduledPosts.create(c.get('userId'), c.req.valid('json'));
    return c.json({ success: true, post } satisfies ScheduledPostResponse);
});

export const updateScheduledPost = controller.createHandlers(jsonBody(parseScheduledPostUpdate), async c => {
    const post = await servicesFor(c).scheduledPosts.update(c.get('userId'), pathParam(c, 'id'), c.req.valid('json'));
    return c.json({ success: true, post } satisfies ScheduledPostUpdateResponse);
});

export const deleteAllScheduledPosts = controller.createHandlers(async c => {
    const { deleted, kept } = await servicesFor(c).scheduledPosts.removeAll(c.get('userId'));
    return c.json({ success: true, deleted, kept } satisfies ScheduledPostDeleteAllResponse);
});

export const deleteScheduledPost = controller.createHandlers(async c => {
    await servicesFor(c).scheduledPosts.remove(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true, message: 'Scheduled post deleted' } satisfies SuccessMessageResponse);
});

export const publishDuePosts = controller.createHandlers(async c => {
    const result = await servicesFor(c).scheduledPosts.publishDueNow();
    return c.json({ success: true, ...result, timestamp: new Date().toISOString() } satisfies ScheduledPublishRunResponse);
});
