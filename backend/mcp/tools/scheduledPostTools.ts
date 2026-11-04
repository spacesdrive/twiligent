import { READ_ONLY, defineTool } from '../tool.ts';
import { idProperty, objectSchema, pageOf, pageProperties, parsePage, requiredId, withConfirmation } from '../schemas.ts';
import { parseScheduledPost, parseScheduledPostUpdate } from '../../validators/scheduledPostValidators.ts';
import { ValidationError, NotFoundError } from '../../lib/errors.ts';
import type { JsonSchema } from '../tool.ts';
import type { Page } from '../schemas.ts';
import type { PostStatus, ScheduledPost, ScheduledPostRequest, ScheduledPostUpdateRequest } from '../../../shared/types/domain.ts';

const STATUSES: PostStatus[] = ['pending', 'publishing', 'published', 'failed'];

// the fields a person recognises a post by; claim bookkeeping and container ids stay out
function summary(post: ScheduledPost) {
    return {
        id: post.id,
        accountId: post.accountId,
        status: post.status,
        scheduledAt: post.scheduledAt,
        mediaType: post.mediaType ?? null,
        mediaUrl: post.mediaUrl ?? null,
        caption: post.caption ?? '',
        publishedAt: post.publishedAt ?? null,
        error: post.error ?? null,
    };
}

const postFields: Record<string, JsonSchema> = {
    caption: { type: 'string', maxLength: 2200, description: 'The caption, up to 2200 characters' },
    scheduledAt: { type: 'string', format: 'date-time', description: 'When to publish, an ISO 8601 date and time in the future' },
    shareToFeed: { type: 'boolean', description: 'Reels only: also show the reel in the main feed' },
    collaborators: { type: 'array', items: { type: 'string' }, maxItems: 3, description: 'Instagram usernames to invite as collaborators' },
    altText: { type: 'string', maxLength: 1000, description: 'Image description for people using screen readers' },
    locationId: { type: 'string', description: 'A Facebook place id' },
};

export const listScheduledPosts = defineTool<{ status: PostStatus | undefined; page: Page }>({
    name: 'list_scheduled_posts',
    title: 'List scheduled posts',
    description: 'Lists the Instagram posts scheduled in Twiligent, soonest first, with their status (pending, publishing, published, failed) and any error.',
    inputSchema: objectSchema({ status: { type: 'string', enum: STATUSES, description: 'Only posts with this status' }, ...pageProperties }),
    annotations: READ_ONLY,
    permission: 'read',
    parse(args) {
        const status = args.status;
        if (status !== undefined && !STATUSES.includes(status as PostStatus)) throw new ValidationError(`status must be one of ${STATUSES.join(', ')}`);
        return { status: status as PostStatus | undefined, page: parsePage(args) };
    },
    async run({ status, page }, { services, principal }) {
        const posts = (await services.scheduledPosts.list(principal.userId)).filter(post => !status || post.status === status);
        const { items, nextCursor, total } = pageOf(posts, page);
        return { posts: items.map(summary), nextCursor, total };
    },
});

export const getScheduledPost = defineTool<{ postId: string }>({
    name: 'get_scheduled_post',
    title: 'Get a scheduled post',
    description: 'Gets one scheduled Instagram post with its status, publish time and any publishing error.',
    inputSchema: objectSchema({ postId: idProperty('scheduled post') }, ['postId']),
    annotations: READ_ONLY,
    permission: 'read',
    parse: args => ({ postId: requiredId(args, 'postId', 'scheduled post') }),
    async run({ postId }, { services, principal }) {
        const post = (await services.scheduledPosts.list(principal.userId)).find(candidate => candidate.id === postId);
        if (!post) throw new NotFoundError('No scheduled post with that id. List the scheduled posts to find it.');
        return { post: summary(post) };
    },
});

export const scheduleInstagramPost = defineTool<ScheduledPostRequest>({
    name: 'schedule_instagram_post',
    title: 'Schedule an Instagram post',
    description: 'Schedules an image, video, reel or story on a connected Instagram account. Twiligent publishes it at scheduledAt. The media must already be at a public https URL, such as one returned by the media tools. Asks for a confirmation first, because the post goes public. Scheduling the same media for the same account and time twice returns the existing post.',
    inputSchema: withConfirmation(objectSchema({
        accountId: idProperty('Instagram account'),
        mediaUrl: { type: 'string', format: 'uri', description: 'Public https URL of the image or video' },
        mediaType: { type: 'string', enum: ['IMAGE', 'VIDEO', 'REELS', 'STORIES'], description: 'What kind of post; IMAGE when left out' },
        ...postFields,
    }, ['accountId', 'mediaUrl', 'scheduledAt'])),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    permission: 'write',
    needsConfirmation: () => true,
    describe: input => `Publish a ${input.mediaType ?? 'IMAGE'} post on Instagram account ${input.accountId} at ${input.scheduledAt}${input.caption ? ` with the caption "${input.caption.slice(0, 120)}"` : ''}.`,
    parse(args) {
        const request = parseScheduledPost(args);
        if (request.mediaType === 'CAROUSEL') throw new ValidationError('Carousels can be scheduled from the Publish page; this tool takes one image or video.');
        return request;
    },
    async run(request, { services, principal }) {
        const existing = (await services.scheduledPosts.list(principal.userId)).find(post => post.status === 'pending'
            && post.accountId === request.accountId && post.mediaUrl === request.mediaUrl
            && Date.parse(post.scheduledAt) === Date.parse(request.scheduledAt));
        if (existing) return { post: summary(existing), alreadyScheduled: true };
        return { post: summary(await services.scheduledPosts.create(principal.userId, request)), alreadyScheduled: false };
    },
});

export const updateScheduledPost = defineTool<{ postId: string; changes: ScheduledPostUpdateRequest }>({
    name: 'update_scheduled_post',
    title: 'Change a scheduled post',
    description: 'Changes the caption, time or other details of an Instagram post that has not started publishing. Fields left out stay as they are.',
    inputSchema: objectSchema({ postId: idProperty('scheduled post'), ...postFields }, ['postId']),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    permission: 'write',
    parse(args) {
        const changes = parseScheduledPostUpdate(args);
        if (Object.keys(changes).length === 0) throw new ValidationError('Name at least one field to change, such as caption or scheduledAt.');
        return { postId: requiredId(args, 'postId', 'scheduled post'), changes };
    },
    async run({ postId, changes }, { services, principal }) {
        const post = await services.scheduledPosts.update(principal.userId, postId, changes);
        return { post: post && summary(post) };
    },
});

export const cancelScheduledPost = defineTool<{ postId: string }>({
    name: 'cancel_scheduled_post',
    title: 'Cancel a scheduled post',
    description: 'Deletes a scheduled Instagram post that has not started publishing, so it is never published. It cannot be undone. Asks for a confirmation first.',
    inputSchema: withConfirmation(objectSchema({ postId: idProperty('scheduled post') }, ['postId'])),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    permission: 'write',
    needsConfirmation: () => true,
    describe: ({ postId }) => `Delete scheduled post ${postId} so it is never published.`,
    parse: args => ({ postId: requiredId(args, 'postId', 'scheduled post') }),
    async run({ postId }, { services, principal }) {
        await services.scheduledPosts.remove(principal.userId, postId);
        return { cancelled: postId };
    },
});

export const SCHEDULED_POST_TOOLS = [listScheduledPosts, getScheduledPost, scheduleInstagramPost, updateScheduledPost, cancelScheduledPost];
