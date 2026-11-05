import { ValidationError } from '../lib/errors.ts';
import { optionalString, requiredString } from './fields.ts';
import type { Fields } from './fields.ts';
import type { MediaImport } from '../services/mediaService.ts';

const MAX_URL_LENGTH = 2048;
export const MAX_MEDIA_LABEL_LENGTH = 200;
const RESOURCE_TYPES = ['image', 'video'] as const;

// Cloudinary fetches the file, not the Worker, but an address on a private network is never a public file anyone meant
// to share, so it is refused before any request goes out
const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/i;

export function parseMediaUrl(value: string): string {
    let parsed: URL;
    try {
        parsed = new URL(value.trim());
    } catch {
        throw new ValidationError('url must be a full https address of an image or video');
    }
    if (parsed.protocol !== 'https:') throw new ValidationError('url must start with https://');
    if (parsed.username || parsed.password) throw new ValidationError('url must not contain a user name or password');
    if (PRIVATE_HOST.test(parsed.hostname)) throw new ValidationError('url must be a public address on the internet');
    const url = parsed.toString();
    if (url.length > MAX_URL_LENGTH) throw new ValidationError(`url must be at most ${MAX_URL_LENGTH} characters`);
    return url;
}

export function parseMediaLabel(fields: Fields): string {
    const label = (optionalString(fields, 'label') ?? '').trim();
    if (label.length > MAX_MEDIA_LABEL_LENGTH) throw new ValidationError(`label must be at most ${MAX_MEDIA_LABEL_LENGTH} characters`);
    return label;
}

export function parseMediaImport(fields: Fields): MediaImport {
    const resourceType = fields.resourceType;
    if (!RESOURCE_TYPES.includes(resourceType as typeof RESOURCE_TYPES[number])) throw new ValidationError('resourceType must be image or video');
    return {
        url: parseMediaUrl(requiredString(fields, 'url', 'url is required: the https address of the image or video')),
        resourceType: resourceType as MediaImport['resourceType'],
        label: parseMediaLabel(fields),
    };
}
