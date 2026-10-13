import { ValidationError } from '../lib/errors.ts';
import { mediaType, postDetails } from './publishingValidators.ts';
import { optionalString, presentField, requiredString } from './fields.ts';
import type { Fields } from './fields.ts';
import type { MediaType, Platform, ScheduledPostRequest, ScheduledPostUpdateRequest } from '../../shared/types/domain.ts';

const SCHEDULED_MEDIA_TYPES: MediaType[] = ['IMAGE', 'VIDEO', 'REELS', 'STORIES', 'CAROUSEL'];
const PLATFORMS: Platform[] = ['instagram'];

// the fields a pending post can change; anything else in the body is ignored
const EDITABLE_FIELDS = ['caption', 'scheduledAt', 'shareToFeed', 'collaborators', 'audioName', 'thumbOffset', 'locationId', 'userTags', 'altText', 'coverUrl'] as const;

function platform(fields: Fields): Platform | undefined {
    const value = optionalString(fields, 'platform');
    if (!value) return undefined;
    if (!PLATFORMS.includes(value as Platform)) throw new ValidationError('Only Instagram posts can be scheduled');
    return value as Platform;
}

export function parseScheduledPost(body: Fields): ScheduledPostRequest {
    const required = 'accountId, mediaUrl, and scheduledAt are required';
    return {
        ...postDetails(body),
        accountId: requiredString(body, 'accountId', required),
        mediaUrl: requiredString(body, 'mediaUrl', required),
        scheduledAt: requiredString(body, 'scheduledAt', required),
        platform: platform(body),
        mediaType: mediaType(body, SCHEDULED_MEDIA_TYPES),
    };
}

export function parseScheduledPostUpdate(body: Fields): ScheduledPostUpdateRequest {
    const details = postDetails(body);
    const all: ScheduledPostUpdateRequest = { ...details, scheduledAt: optionalString(body, 'scheduledAt') };
    if (all.scheduledAt && Number.isNaN(new Date(all.scheduledAt).getTime())) throw new ValidationError('scheduledAt must be a valid date');
    const changes: ScheduledPostUpdateRequest = {};
    for (const field of EDITABLE_FIELDS) {
        if (presentField(body, field)) Object.assign(changes, { [field]: all[field] });
    }
    return changes;
}
