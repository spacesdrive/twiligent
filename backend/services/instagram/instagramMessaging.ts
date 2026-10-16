import { buildGraphUrl, igPost } from './instagramApi.ts';
import { UpstreamError, isAbortError } from '../../lib/errors.ts';
import { redactUrls } from '../../lib/redact.ts';
import { SEND_TIMEOUT_MS } from '../../lib/automationDelivery.ts';
import type { SendResult } from '../../lib/automationDelivery.ts';
import type { InstagramApiErrorBody } from './instagramApi.ts';

// the Workers runtime refuses a fetch past the run's subrequest allowance before anything leaves
const SUBREQUEST_LIMIT = /too many subrequests/i;
// the webhook fields the automation needs; Instagram sends every field the app subscribes to in the Meta dashboard
const SUBSCRIBED_FIELDS = 'comments';

interface PrivateReplyBody extends InstagramApiErrorBody {
    recipient_id?: string;
    message_id?: string;
}

interface SubscribeBody {
    success?: boolean;
}

// answers instead of throwing, because each failure needs its code to decide between retrying, waiting and stopping;
// the request is never repeated here, since a repeat after a lost answer could message the person twice. Only its own
// timeout can cut it off: the caller starts a send only with that much time left, so a run's deadline never makes one ambiguous
export async function sendPrivateReply(igUserId: string, accessToken: string, commentId: string, text: string): Promise<SendResult> {
    let response: Response;
    try {
        response = await fetch(buildGraphUrl(`/${igUserId}/messages`).toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
            signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
    } catch (err) {
        if (SUBREQUEST_LIMIT.test((err as Error).message ?? '')) return { kind: 'not_sent', message: 'this run reached its request limit' };
        return { kind: 'ambiguous', message: isAbortError(err) ? 'the request timed out' : 'the connection failed' };
    }

    const usageHeader = response.headers.get('x-business-use-case-usage');
    let body: PrivateReplyBody;
    try {
        body = await response.json() as PrivateReplyBody;
    } catch {
        // an accepted request whose answer cannot be read may still have delivered the message
        if (response.ok) return { kind: 'ambiguous', message: 'its answer could not be read' };
        return { kind: 'error', httpStatus: response.status, message: `HTTP ${response.status}`, usageHeader };
    }

    if (response.ok && !body.error) return { kind: 'accepted', messageId: body.message_id ?? null };
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

// asks Instagram to send this account's comments to the app's webhook
export async function subscribeToComments(igUserId: string, accessToken: string, signal?: AbortSignal): Promise<void> {
    const result = await igPost<SubscribeBody>(`/${igUserId}/subscribed_apps`, { subscribed_fields: SUBSCRIBED_FIELDS, access_token: accessToken }, signal);
    if (result.success !== true) throw new UpstreamError('Instagram did not confirm the webhook subscription for this account. Try again in a moment.');
}
