import { buildGraphUrl, igFetch, igPost } from './instagramApi.ts';
import { UpstreamError, isAbortError } from '../../lib/errors.ts';
import { redactUrls } from '../../lib/redact.ts';
import { FOLLOW_CHECK_TIMEOUT_MS, SEND_TIMEOUT_MS, classifySendError } from '../../lib/automationDelivery.ts';
import type { FollowCheck, SendResult } from '../../lib/automationDelivery.ts';
import type { ConversationMessage } from '../../lib/automationReview.ts';
import type { InstagramApiErrorBody } from './instagramApi.ts';

// the Workers runtime refuses a fetch past the run's subrequest allowance before anything leaves
const SUBREQUEST_LIMIT = /too many subrequests/i;

// a private reply names the comment; a message inside the 24 hour window names the person
export type MessageRecipient = { comment_id: string } | { id: string };

// the webhook fields the automation can ask for; Instagram sends only the fields the app selected in the Meta dashboard
export type WebhookField = 'comments' | 'messages';

interface SendBody extends InstagramApiErrorBody {
    recipient_id?: string;
    message_id?: string;
}

interface SubscribeBody {
    success?: boolean;
}

interface FollowStatusBody extends InstagramApiErrorBody {
    is_user_follow_business?: boolean;
}

interface ConversationListBody {
    data?: { id?: string }[];
}

interface ConversationBody {
    messages?: { data?: { id?: string; created_time?: string; from?: { id?: string }; message?: string }[] };
}

// answers instead of throwing, because each failure needs its code to decide between retrying, waiting and stopping;
// the request is never repeated here, since a repeat after a lost answer could message the person twice. Only its own
// timeout can cut it off: the caller starts a send only with that much time left, so a run's deadline never makes one ambiguous
export async function sendMessage(igUserId: string, accessToken: string, recipient: MessageRecipient, text: string): Promise<SendResult> {
    let response: Response;
    try {
        response = await fetch(buildGraphUrl(`/${igUserId}/messages`).toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ recipient, message: { text } }),
            signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
    } catch (err) {
        if (SUBREQUEST_LIMIT.test((err as Error).message ?? '')) return { kind: 'not_sent', message: 'this run reached its request limit' };
        return { kind: 'ambiguous', message: isAbortError(err) ? 'the request timed out' : 'the connection failed' };
    }

    const usageHeader = response.headers.get('x-business-use-case-usage');
    let body: SendBody;
    try {
        body = await response.json() as SendBody;
    } catch {
        // an accepted request whose answer cannot be read may still have delivered the message
        if (response.ok) return { kind: 'ambiguous', message: 'its answer could not be read' };
        return { kind: 'error', httpStatus: response.status, message: `HTTP ${response.status}`, usageHeader };
    }

    if (response.ok && !body.error) return { kind: 'accepted', messageId: body.message_id ?? null, recipientId: body.recipient_id ?? null };
    const error = body.error ?? {};
    return {
        kind: 'error',
        code: error.code,
        subcode: error.error_subcode,
        httpStatus: response.status,
        message: redactUrls(error.message || body.error_message || `HTTP ${response.status}`),
        usageHeader,
    };
}

// one private reply to a comment; Instagram allows one per comment, within 7 days of it
export function sendPrivateReply(igUserId: string, accessToken: string, commentId: string, text: string): Promise<SendResult> {
    return sendMessage(igUserId, accessToken, { comment_id: commentId }, text);
}

// Instagram reports whether a person follows the account only after they have messaged it (User Profile API consent),
// so this is asked when they answer a followers-only reply; a read, so asking again is always safe
export async function readFollowStatus(igsid: string, accessToken: string): Promise<FollowCheck> {
    let response: Response;
    try {
        response = await fetch(buildGraphUrl(`/${igsid}`, { fields: 'is_user_follow_business' }).toString(), {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(FOLLOW_CHECK_TIMEOUT_MS),
        });
    } catch (err) {
        return { kind: 'retry', message: isAbortError(err) ? 'the request timed out' : 'the connection failed' };
    }
    let body: FollowStatusBody;
    try {
        body = await response.json() as FollowStatusBody;
    } catch {
        return { kind: 'retry', message: `HTTP ${response.status}` };
    }
    if (response.ok && !body.error) {
        if (typeof body.is_user_follow_business === 'boolean') return { kind: body.is_user_follow_business ? 'following' : 'not_following' };
        return { kind: 'unverifiable', message: 'its answer had no follow status' };
    }
    const error = body.error ?? {};
    const message = redactUrls(error.message || body.error_message || `HTTP ${response.status}`);
    const kind = classifySendError({ code: error.code, subcode: error.error_subcode, httpStatus: response.status, message });
    if (kind === 'rate_limited' || kind === 'blocked' || kind === 'transient') return { kind: 'retry', message };
    if (kind === 'not_authorized') return { kind: 'not_authorized', message };
    return { kind: 'unverifiable', message };
}

// the account's latest messages with one person, newest first; Instagram returns the details of the 20 most recent
export async function listConversationMessages(igUserId: string, accessToken: string, igsid: string, signal?: AbortSignal): Promise<ConversationMessage[]> {
    const conversations = await igFetch<ConversationListBody>(`/${igUserId}/conversations`, { platform: 'instagram', user_id: igsid, access_token: accessToken }, 0, signal);
    const conversationId = conversations.data?.[0]?.id;
    if (!conversationId) return [];
    const conversation = await igFetch<ConversationBody>(`/${conversationId}`, { fields: 'messages{id,created_time,from,message}', access_token: accessToken }, 0, signal);
    return (conversation.messages?.data ?? [])
        .filter(message => message.id && message.created_time)
        .map(message => ({ id: message.id!, createdTime: message.created_time!, fromId: message.from?.id ?? null, text: message.message ?? null }));
}

// asks Instagram to send this account's events to the app's webhook; the list replaces what was asked before
export async function subscribeToWebhooks(igUserId: string, accessToken: string, fields: WebhookField[], signal?: AbortSignal): Promise<void> {
    const result = await igPost<SubscribeBody>(`/${igUserId}/subscribed_apps`, { subscribed_fields: fields.join(','), access_token: accessToken }, signal);
    if (result.success !== true) throw new UpstreamError('Instagram did not confirm the webhook subscription for this account. Try again in a moment.');
}
