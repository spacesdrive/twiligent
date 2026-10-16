import { igFetch } from './instagramApi.ts';
import { postOnce } from './instagramMessaging.ts';
import { MAX_REPLY_PAGES } from '../../lib/automationPublicReply.ts';
import type { SendResult } from '../../lib/automationDelivery.ts';
import type { ConversationMessage } from '../../lib/automationReview.ts';
import type { InstagramApiErrorBody } from './instagramApi.ts';

interface ReplyBody extends InstagramApiErrorBody {
    id?: string;
}

interface RepliesBody {
    data?: { id?: string; text?: string; timestamp?: string; from?: { id?: string } }[];
    paging?: { next?: string; cursors?: { after?: string } };
}

// the replies under one comment as far as they were read; complete is false when more pages were left unread
export interface CommentReplies {
    replies: ConversationMessage[];
    complete: boolean;
}

// Instagram returns at most this many replies a page
const REPLIES_PAGE = 50;

// one public reply under a comment; a reply to a reply lands in the top-level comment's thread. Accepted only when
// Instagram answers with the new reply's id, since nothing else shows the reply is there
export function replyToComment(commentId: string, accessToken: string, text: string): Promise<SendResult> {
    return postOnce<ReplyBody>(`/${commentId}/replies`, accessToken, { message: text }, body => (body.id
        ? { kind: 'accepted', messageId: body.id, recipientId: null }
        : { kind: 'ambiguous', message: 'its answer had no reply id' }));
}

// the replies under a comment, to find a public reply whose answer was lost; a read, so asking again is always safe
export async function listCommentReplies(commentId: string, accessToken: string, signal?: AbortSignal): Promise<CommentReplies> {
    const replies: ConversationMessage[] = [];
    let after: string | undefined;
    for (let page = 0; page < MAX_REPLY_PAGES; page++) {
        const params: Record<string, string> = { fields: 'id,text,timestamp,from', limit: String(REPLIES_PAGE), access_token: accessToken };
        if (after) params.after = after;
        const body = await igFetch<RepliesBody>(`/${commentId}/replies`, params, 0, signal);
        for (const reply of body.data ?? []) {
            if (reply.id && reply.timestamp) replies.push({ id: reply.id, createdTime: reply.timestamp, fromId: reply.from?.id ?? null, text: reply.text ?? null });
        }
        after = body.paging?.next ? body.paging.cursors?.after : undefined;
        if (!after) return { replies, complete: true };
    }
    return { replies, complete: false };
}
