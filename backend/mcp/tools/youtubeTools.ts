import { READ_ONLY, defineTool, noInput } from '../tool.ts';
import { idProperty, objectSchema, pageOf, pageProperties, parsePage, requiredId, withConfirmation } from '../schemas.ts';
import { parseYouTubeUpload, parseYouTubeUploadUpdate } from '../../validators/youtubeValidators.ts';
import { ValidationError } from '../../lib/errors.ts';
import type { JsonSchema } from '../tool.ts';
import type { Page } from '../schemas.ts';
import type { YouTubeUploadRequest, YouTubeUploadUpdateRequest } from '../../../shared/types/youtubePublishing.ts';

const metadataFields: Record<string, JsonSchema> = {
    title: { type: 'string', maxLength: 100, description: 'The video title, up to 100 characters, without < or >' },
    description: { type: 'string', maxLength: 5000, description: 'Up to 5000 bytes, without < or >' },
    tags: { type: 'array', items: { type: 'string' }, maxItems: 50, description: 'Up to 500 characters together' },
    categoryId: { type: 'string', pattern: '^\\d{1,3}$', description: 'A YouTube category number; 22 (People and Blogs) when left out' },
    privacy: { type: 'string', enum: ['private', 'unlisted', 'public'] },
    publishAt: { type: 'string', format: 'date-time', description: 'Publish at this time; the video must be private until then' },
    madeForKids: { type: 'boolean', description: 'Whether the video is made for children; required by law and by YouTube' },
    syntheticMedia: { type: 'boolean', description: 'Whether realistic content was made or changed with AI' },
    notifySubscribers: { type: 'boolean', description: 'Tell subscribers about the new video; true when left out' },
};

// anything other than a private video with no publish time becomes visible on the channel, so the person confirms it
function goesPublic(fields: { privacy?: string; publishAt?: string | null }): boolean {
    return fields.privacy === 'public' || fields.privacy === 'unlisted' || Boolean(fields.publishAt);
}

function describeVideo(fields: Partial<YouTubeUploadRequest>): string {
    return [
        fields.title !== undefined && `Title: "${fields.title}".`,
        fields.privacy && `Visibility: ${fields.privacy}.`,
        fields.publishAt && `Publishes at: ${fields.publishAt}.`,
        fields.madeForKids !== undefined && `Made for kids: ${fields.madeForKids ? 'yes' : 'no'}.`,
        fields.description !== undefined && `Description: "${fields.description}".`,
        fields.tags?.length && `Tags: ${fields.tags.join(', ')}.`,
    ].filter(Boolean).join(' ');
}

function refuseUnlisted(args: Record<string, unknown>, allowed: string[]): void {
    const unlisted = Object.keys(args).filter(name => name !== 'confirmationToken' && !allowed.includes(name));
    if (unlisted.length > 0) throw new ValidationError(`These fields cannot be set from Claude: ${unlisted.join(', ')}.`);
}

export const listYouTubeChannels = defineTool<Record<string, never>>({
    name: 'list_youtube_channels',
    title: 'List connected YouTube channels',
    description: 'Lists the YouTube channels connected for publishing, with their status. A channel that needs a new sign-in must be connected again on the Accounts page.',
    inputSchema: noInput(),
    annotations: READ_ONLY,
    permission: 'read',
    parse: () => ({}),
    async run(_input, { services, principal }) {
        return { channels: await services.youtubeConnect.list(principal.userId), configured: services.youtubeConnect.configured() };
    },
});

export const listYouTubeUploads = defineTool<{ page: Page }>({
    name: 'list_youtube_uploads',
    title: 'List YouTube uploads',
    description: 'Lists your YouTube upload jobs, newest first, with their state, progress in bytes, the video id once YouTube has it, and any error.',
    inputSchema: objectSchema({ ...pageProperties }),
    annotations: READ_ONLY,
    permission: 'read',
    parse: args => ({ page: parsePage(args) }),
    async run({ page }, { services, principal }) {
        const { items, nextCursor, total } = pageOf(await services.youtubeUploads.list(principal.userId), page);
        return { uploads: items, nextCursor, total };
    },
});

export const getYouTubeUpload = defineTool<{ uploadId: string }>({
    name: 'get_youtube_upload',
    title: 'Get a YouTube upload',
    description: 'Gets one YouTube upload job with its state, progress and any error.',
    inputSchema: objectSchema({ uploadId: idProperty('YouTube upload') }, ['uploadId']),
    annotations: READ_ONLY,
    permission: 'read',
    parse: args => ({ uploadId: requiredId(args, 'uploadId', 'YouTube upload') }),
    async run({ uploadId }, { services, principal }) {
        return { upload: await services.youtubeUploads.get(principal.userId, uploadId) };
    },
});

export const createYouTubeUpload = defineTool<YouTubeUploadRequest>({
    name: 'create_youtube_upload',
    title: 'Upload a video to YouTube',
    description: 'Queues a video from your media (see list_media and import_media_from_url) for upload to a connected YouTube channel. Twiligent uploads it in the background over the next runs and YouTube processes it; follow it with get_youtube_upload. Asks for a confirmation first when the video will be public, unlisted or scheduled. Sending the same clientRequestId again returns the first job.',
    inputSchema: withConfirmation(objectSchema({
        connectionId: idProperty('YouTube channel connection'),
        mediaId: idProperty('video in your media'),
        thumbnailMediaId: { ...idProperty('image in your media'), description: 'An image from your media for the thumbnail, JPEG or PNG up to 2 MB' },
        ...metadataFields,
        clientRequestId: { type: 'string', maxLength: 100, description: 'Any unique text; the same value twice uploads the video once' },
    }, ['connectionId', 'mediaId', 'title', 'privacy', 'madeForKids'])),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    permission: 'write',
    needsConfirmation: goesPublic,
    describe: input => `Upload media ${input.mediaId} to YouTube channel connection ${input.connectionId}. ${describeVideo(input)}`,
    parse(args) {
        refuseUnlisted(args, ['connectionId', 'mediaId', 'thumbnailMediaId', 'clientRequestId', ...Object.keys(metadataFields)]);
        return parseYouTubeUpload(args);
    },
    async run(request, { services, principal }) {
        const { upload, existing } = await services.youtubeUploads.create(principal.userId, request);
        return { upload, alreadyQueued: existing };
    },
});

export const updateYouTubeUpload = defineTool<{ uploadId: string; changes: YouTubeUploadUpdateRequest }>({
    name: 'update_youtube_upload',
    title: 'Change a queued YouTube upload',
    description: 'Changes the details of a YouTube upload that has not started. Once the upload starts, details are changed in YouTube Studio. Asks for a confirmation first when the change makes the video public, unlisted or scheduled.',
    inputSchema: withConfirmation(objectSchema({ uploadId: idProperty('YouTube upload'), ...metadataFields }, ['uploadId'])),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    permission: 'write',
    needsConfirmation: ({ changes }) => goesPublic(changes),
    describe: ({ uploadId, changes }) => `Change YouTube upload ${uploadId}. ${describeVideo(changes)}`,
    parse(args) {
        refuseUnlisted(args, ['uploadId', ...Object.keys(metadataFields)]);
        return { uploadId: requiredId(args, 'uploadId', 'YouTube upload'), changes: parseYouTubeUploadUpdate(args) };
    },
    async run({ uploadId, changes }, { services, principal }) {
        return { upload: await services.youtubeUploads.update(principal.userId, uploadId, changes) };
    },
});

export const retryYouTubeUpload = defineTool<{ uploadId: string }>({
    name: 'retry_youtube_upload',
    title: 'Try a YouTube upload again',
    description: 'Queues a failed upload again from the start. For an upload waiting for your check, look at the channel first: YouTube may already have the video.',
    inputSchema: objectSchema({ uploadId: idProperty('YouTube upload') }, ['uploadId']),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    permission: 'write',
    parse: args => ({ uploadId: requiredId(args, 'uploadId', 'YouTube upload') }),
    async run({ uploadId }, { services, principal }) {
        return { upload: await services.youtubeUploads.retry(principal.userId, uploadId) };
    },
});

export const cancelYouTubeUpload = defineTool<{ uploadId: string }>({
    name: 'cancel_youtube_upload',
    title: 'Cancel a YouTube upload',
    description: 'Stops an upload YouTube has not finished, so no video is created. A video YouTube already has stays on the channel. Asks for a confirmation first.',
    inputSchema: withConfirmation(objectSchema({ uploadId: idProperty('YouTube upload') }, ['uploadId'])),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    permission: 'write',
    needsConfirmation: () => true,
    describe: ({ uploadId }) => `Cancel YouTube upload ${uploadId}; the video will not be published.`,
    parse: args => ({ uploadId: requiredId(args, 'uploadId', 'YouTube upload') }),
    async run({ uploadId }, { services, principal }) {
        return { upload: await services.youtubeUploads.cancel(principal.userId, uploadId) };
    },
});

export const YOUTUBE_TOOLS = [listYouTubeChannels, listYouTubeUploads, getYouTubeUpload, createYouTubeUpload, updateYouTubeUpload, retryYouTubeUpload, cancelYouTubeUpload];
