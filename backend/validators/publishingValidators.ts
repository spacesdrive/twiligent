import { ValidationError } from '../lib/errors.ts';
import { isObject, isString, optionalArray, optionalBoolean, optionalNumber, optionalString, requiredString } from './fields.ts';
import type { Fields } from './fields.ts';
import type { UserTag } from '../../shared/types/domain.ts';
import type { InstagramPublishMediaType, InstagramPublishRequest } from '../../shared/types/instagram.ts';

const PUBLISH_MEDIA_TYPES: InstagramPublishMediaType[] = ['IMAGE', 'VIDEO', 'REELS', 'STORIES', 'CAROUSEL', 'CAROUSEL_ITEM_IMAGE', 'CAROUSEL_ITEM_VIDEO'];

export interface ContainerInput {
    containerId: string;
}

export interface ContainerStatusQuery {
    accountId: string;
}

export function mediaType<T extends string>(fields: Fields, allowed: T[]): T | undefined {
    const value = optionalString(fields, 'mediaType');
    if (!value) return undefined;
    if (!allowed.includes(value as T)) throw new ValidationError(`mediaType must be one of ${allowed.join(', ')}`);
    return value as T;
}

function isUserTag(item: unknown): item is UserTag {
    return isObject(item) && typeof item.username === 'string';
}

export function userTags(fields: Fields): UserTag[] | undefined {
    return optionalArray(fields, 'userTags', isUserTag, 'tags with a username');
}

// the fields every Instagram post can carry, shared by publishing now and scheduling for later
export function postDetails(fields: Fields): Omit<InstagramPublishRequest, 'mediaType' | 'children'> {
    const coverUrl = fields.coverUrl === null ? null : optionalString(fields, 'coverUrl');
    const thumbOffset = fields.thumbOffset === null ? null : optionalNumber(fields, 'thumbOffset');
    return {
        mediaUrl: optionalString(fields, 'mediaUrl'),
        caption: optionalString(fields, 'caption'),
        coverUrl,
        shareToFeed: optionalBoolean(fields, 'shareToFeed'),
        collaborators: optionalArray(fields, 'collaborators', isString, 'usernames'),
        audioName: optionalString(fields, 'audioName'),
        thumbOffset,
        locationId: optionalString(fields, 'locationId'),
        userTags: userTags(fields),
        altText: optionalString(fields, 'altText'),
    };
}

// leaves out fields the client did not send, so buildMediaParams only sees real values
function withoutUndefined<T extends object>(value: T): T {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

export function parsePublishRequest(body: Fields): InstagramPublishRequest {
    return withoutUndefined({
        mediaType: mediaType(body, PUBLISH_MEDIA_TYPES),
        ...postDetails(body),
        children: optionalArray(body, 'children', isString, 'container ids'),
    });
}

export function parseContainerInput(body: Fields): ContainerInput {
    return { containerId: requiredString(body, 'containerId', 'containerId is required') };
}

export function parseContainerStatusQuery(query: Fields): ContainerStatusQuery {
    return { accountId: requiredString(query, 'accountId', 'accountId is required') };
}
