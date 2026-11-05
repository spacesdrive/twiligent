import { ValidationError } from '../lib/errors.ts';
import { optionalBoolean, optionalString, requiredString } from './fields.ts';
import type { Fields } from './fields.ts';
import type {
    YouTubeConnectCompleteRequest, YouTubePrivacy, YouTubeUploadRequest, YouTubeUploadUpdateRequest,
} from '../../shared/types/youtubePublishing.ts';

const PRIVACY: YouTubePrivacy[] = ['private', 'unlisted', 'public'];
const MAX_ID = 100;
const MAX_TAGS = 50;
// YouTube's category ids are small numbers; 22 is People and Blogs, its own default
const CATEGORY = /^\d{1,3}$/;

function id(fields: Fields, name: string, what: string): string {
    const value = requiredString(fields, name, `${name} is required: the ${what} id`).trim();
    if (value.length > MAX_ID) throw new ValidationError(`${name} must be a ${what} id`);
    return value;
}

function privacy(value: unknown): YouTubePrivacy {
    if (PRIVACY.includes(value as YouTubePrivacy)) return value as YouTubePrivacy;
    throw new ValidationError('privacy must be private, unlisted or public');
}

function tags(value: unknown): string[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > MAX_TAGS || value.some(tag => typeof tag !== 'string')) {
        throw new ValidationError(`tags must be a list of at most ${MAX_TAGS} words or phrases`);
    }
    return value.map(tag => (tag as string).trim()).filter(Boolean);
}

// a publish time is an exact moment in the future; YouTube only schedules private videos
function publishAt(value: unknown, chosenPrivacy: YouTubePrivacy | undefined): string | null {
    if (value === undefined || value === null || value === '') return null;
    const when = new Date(String(value));
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) throw new ValidationError('publishAt must be a date and time in the future');
    if (chosenPrivacy !== undefined && chosenPrivacy !== 'private') throw new ValidationError('A scheduled video must be private until it publishes; choose private');
    return when.toISOString();
}

function category(value: unknown): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !CATEGORY.test(value)) throw new ValidationError('categoryId must be a YouTube category number, such as 22');
    return value;
}

export function parseYouTubeUpload(body: Fields): YouTubeUploadRequest {
    const chosen = privacy(body.privacy);
    const madeForKids = optionalBoolean(body, 'madeForKids');
    // the law asks every uploader to say whether a video is made for children, so there is no default
    if (madeForKids === undefined) throw new ValidationError('Say whether the video is made for kids (madeForKids true or false)');
    const clientRequestId = optionalString(body, 'clientRequestId')?.trim();
    if (clientRequestId && clientRequestId.length > MAX_ID) throw new ValidationError('clientRequestId must be at most 100 characters');
    return {
        connectionId: id(body, 'connectionId', 'YouTube channel connection'),
        mediaId: id(body, 'mediaId', 'video'),
        thumbnailMediaId: optionalString(body, 'thumbnailMediaId')?.trim() || null,
        title: requiredString(body, 'title', 'Give the video a title').trim(),
        description: optionalString(body, 'description') ?? '',
        tags: tags(body.tags),
        categoryId: category(body.categoryId) ?? '22',
        privacy: chosen,
        publishAt: publishAt(body.publishAt, chosen),
        madeForKids,
        syntheticMedia: optionalBoolean(body, 'syntheticMedia') ?? false,
        notifySubscribers: optionalBoolean(body, 'notifySubscribers') ?? true,
        clientRequestId: clientRequestId || undefined,
    };
}

export function parseYouTubeUploadUpdate(body: Fields): YouTubeUploadUpdateRequest {
    const edit: YouTubeUploadUpdateRequest = {};
    if (body.title !== undefined) edit.title = requiredString(body, 'title', 'Give the video a title').trim();
    if (body.description !== undefined) edit.description = optionalString(body, 'description') ?? '';
    if (body.tags !== undefined) edit.tags = tags(body.tags);
    if (body.categoryId !== undefined) edit.categoryId = category(body.categoryId);
    if (body.privacy !== undefined) edit.privacy = privacy(body.privacy);
    if (body.publishAt !== undefined) edit.publishAt = publishAt(body.publishAt, edit.privacy);
    for (const flag of ['madeForKids', 'syntheticMedia', 'notifySubscribers'] as const) {
        const value = optionalBoolean(body, flag);
        if (value !== undefined) edit[flag] = value;
    }
    if (Object.keys(edit).length === 0) throw new ValidationError('Name at least one detail to change, such as title or privacy');
    return edit;
}

export function parseYouTubeComplete(body: Fields): YouTubeConnectCompleteRequest {
    return {
        code: requiredString(body, 'code', 'The Google sign-in code is missing. Start connecting again.'),
        state: requiredString(body, 'state', 'The Google sign-in state is missing. Start connecting again.'),
    };
}
