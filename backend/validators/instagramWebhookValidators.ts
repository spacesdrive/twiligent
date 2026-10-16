import { ValidationError } from '../lib/errors.ts';
import { isObject } from './fields.ts';
import type { Fields } from './fields.ts';

// one comment on a post or reel of a connected professional account, as Meta's comments webhook describes it
export interface InstagramCommentEvent {
    // the professional account the comment was made on (the entry id)
    igUserId: string;
    commentId: string;
    text: string | null;
    fromId: string | null;
    fromUsername: string | null;
    mediaId: string | null;
    mediaProductType: string | null;
    parentId: string | null;
    // when Meta sent the notification, in milliseconds
    notifiedAt: number;
}

export interface InstagramWebhook {
    comments: InstagramCommentEvent[];
    // changes for other fields, or comments missing their id, which are acknowledged and dropped
    unsupported: number;
}

function text(value: unknown): string | null {
    return typeof value === 'string' && value !== '' ? value : null;
}

// Meta's ids are numeric strings, but a number is read the same way rather than dropped
function id(value: unknown): string | null {
    if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
    return typeof value === 'string' && /^[0-9A-Za-z_-]{1,64}$/.test(value) ? value : null;
}

function comment(entryId: string, notifiedAt: number, value: Fields): InstagramCommentEvent | null {
    // Meta's examples name the comment id both id and comment_id
    const commentId = id(value.id) ?? id(value.comment_id);
    if (!commentId) return null;
    const from = isObject(value.from) ? value.from : {};
    const media = isObject(value.media) ? value.media : {};
    return {
        igUserId: entryId,
        commentId,
        text: text(value.text),
        fromId: id(from.id),
        fromUsername: text(from.username),
        mediaId: id(media.id),
        mediaProductType: text(media.media_product_type),
        parentId: id(value.parent_id),
        notifiedAt,
    };
}

// a body that is not an Instagram notification at all is refused; inside one, anything but a comment is skipped
export function parseInstagramWebhook(body: Fields, now = Date.now()): InstagramWebhook {
    if (body.object !== 'instagram') throw new ValidationError('Only Instagram webhook notifications are accepted here');
    if (!Array.isArray(body.entry)) throw new ValidationError('The notification has no entry list');

    const comments: InstagramCommentEvent[] = [];
    let unsupported = 0;
    for (const entry of body.entry) {
        const entryId = isObject(entry) ? id(entry.id) : null;
        if (!isObject(entry) || !entryId) {
            unsupported++;
            continue;
        }
        // time is in seconds; a missing or odd value falls back to now, and a reply sent after Instagram's window is refused there
        const sentAt = typeof entry.time === 'number' && entry.time > 0 ? Math.min(entry.time * 1000, now) : now;
        const changes = Array.isArray(entry.changes) ? entry.changes : [];
        if (changes.length === 0) unsupported++;
        for (const change of changes) {
            const parsed = isObject(change) && change.field === 'comments' && isObject(change.value)
                ? comment(entryId, sentAt, change.value)
                : null;
            if (parsed) comments.push(parsed);
            else unsupported++;
        }
    }
    return { comments, unsupported };
}
