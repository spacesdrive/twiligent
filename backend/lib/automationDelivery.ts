import type {
    AutomationAttemptOutcome, AutomationCommentStatus, AutomationFollowupKind, AutomationGateStatus,
} from '../../shared/types/automation.ts';

// Instagram refuses message text longer than 1,000 bytes
export const MAX_MESSAGE_BYTES = 1000;

// Instagram accepts a private reply for 7 days after the comment
export const REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// a run holding a job longer than this has stopped: a sweep ends within 15 minutes and a webhook's work within 30 seconds
export const CLAIM_LEASE_SECONDS = 20 * 60;

// five tries over about half an hour give a passing Instagram problem time to clear without retrying forever
export const MAX_SEND_ATTEMPTS = 5;

// a webhook's background work has 30 seconds in all, so one send may take a third of it
export const SEND_TIMEOUT_MS = 10_000;

// the Workers Free plan allows 50 subrequests per invocation; a run that hits the cap cannot even record what happened
export const FREE_PLAN_SUBREQUESTS = 50;
// a request's own middleware and queries (authentication, rate limits, its writes) stay under this before background work starts
export const REQUEST_SUBREQUESTS = 10;
// reserve, send and finish; a reply stopped before sending costs one release instead
export const SUBREQUESTS_PER_REPLY = 3;
// background work after a response gets 25 seconds; a send starts only with its whole timeout and a margin left
export const BACKGROUND_RUN_MS = 20_000;

// new and retried jobs are due a little in the past, so a database clock slightly behind the Worker's still sees them as due
export const DUE_NOW_SKEW_MS = 30_000;

// a follow-up costs the follow check as well as reserve, send and finish
export const SUBREQUESTS_PER_FOLLOWUP = 4;
// the follow check is a read and safe to ask again, so it gets less time than a send: both fit a webhook's 20 seconds
export const FOLLOW_CHECK_TIMEOUT_MS = 5_000;

// a person who does not follow yet is reminded at most twice, then the wait ends
export const MAX_FOLLOW_REMINDERS = 2;

// a follow check Instagram could not answer now is asked again on a later run
const FOLLOW_CHECK_RETRY_MS = 5 * 60 * 1000;

// a reply held by a pause is looked at again on a later sweep, not every five minutes for a week
const HOLD_RECHECK_MS = 15 * 60 * 1000;

// backoff: 1, 2, 4, 8 minutes, then at most an hour, plus up to 30 seconds so retries of one burst spread out
const BACKOFF_BASE_MS = 60 * 1000;
const BACKOFF_MAX_MS = 60 * 60 * 1000;
const BACKOFF_JITTER_MS = 30 * 1000;

// the next sweep, when a run could not start the request
const NOT_SENT_RETRY_MS = 5 * 60 * 1000;
// used when Instagram limits the account without saying for how long
const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000;
// code 368 is a temporary block for activity Instagram considers abusive, so the account rests for a day
const BLOCKED_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Graph API codes Meta documents for throttling: app, user, page and business use case limits
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80002, 80006]);
// unknown and service errors that Meta says to retry later
const TRANSIENT_CODES = new Set([1, 2]);
// the comment is deleted, too old, or its author does not accept messages
const NOT_ELIGIBLE_CODES = new Set([551, 10903]);
const NOT_ELIGIBLE_SUBCODES = new Set([2534014, 2534022, 2534025, 2018001]);
// a second private reply to one comment
const ALREADY_REPLIED_CODE = 10900;
const ALREADY_REPLIED_SUBCODE = 2534023;
// the token is invalid, or the account does not grant or allow messaging
const NOT_AUTHORIZED_CODES = new Set([3, 190, 200]);
const NOT_AUTHORIZED_SUBCODES = new Set([2534041]);

export type SendErrorKind = 'rate_limited' | 'blocked' | 'transient' | 'already_replied' | 'not_authorized' | 'not_eligible' | 'refused';

export interface GraphSendError {
    code?: number;
    subcode?: number;
    httpStatus: number;
    message: string;
}

// what one request to Instagram's messages endpoint came back as; ambiguous means it may have been delivered,
// not_sent that the Worker refused to start the request
export type SendResult =
    | { kind: 'accepted'; messageId: string | null; recipientId: string | null }
    | ({ kind: 'error'; usageHeader: string | null } & GraphSendError)
    | { kind: 'ambiguous'; message: string }
    | { kind: 'not_sent'; message: string };

// a claimed job, as the delivery rules need it; attempts already counts the send being settled
export interface DeliveryJob {
    attempts: number;
    expiresAt: string;
    // who the reply goes to when Instagram does not name them, and whether it starts a followers-only wait
    fromId?: string | null;
    awaitsReply?: boolean;
    // a follow-up's window is Instagram's 24 hours, not the 7 days of a private reply
    expiredMessage?: string;
}

// what Instagram said about whether the person follows the account; retry means it could not answer now
export type FollowCheck =
    | { kind: 'following' }
    | { kind: 'not_following' }
    | { kind: 'unverifiable'; message: string }
    | { kind: 'not_authorized'; message: string }
    | { kind: 'retry'; message: string };

// a claimed follow-up, as the follow-up rules need it
export interface FollowupJob {
    attempts: number;
    windowExpiresAt: string;
    ruleEnabled: boolean;
    requireFollow: boolean;
    gateStatus: AutomationGateStatus | null;
    gatePrompts: number;
    replyText: string | null;
    linkUrl: string | null;
    notFollowingText: string | null;
    accessToken: string | null;
}

// the message a follow check leads to, and what its acceptance does to the comment's wait
export interface FollowupMessage {
    kind: AutomationFollowupKind;
    text: string;
    gateStatus: AutomationGateStatus | null;
    countReminder: boolean;
}

// one finish_automation_send or finish_automation_followup call
export interface FinishPlan {
    status: AutomationCommentStatus;
    outcome: AutomationAttemptOutcome;
    reason: string | null;
    errorMessage: string | null;
    messageId: string | null;
    errorCode: number | null;
    errorSubcode: number | null;
    httpStatus: number | null;
    nextAttemptAt: string | null;
    cooldownUntil: string | null;
    cooldownReason: string | null;
    pauseReason: string | null;
    // who Instagram says received an accepted reply, and the followers-only wait it starts or ends
    recipientId: string | null;
    gateStatus: AutomationGateStatus | null;
}

// a job given back without sending: where it goes and why
export interface ReleasePlan {
    status: AutomationCommentStatus;
    reason: string;
    errorMessage: string | null;
    nextAttemptAt: string | null;
}

export type ReserveOutcome =
    | 'ok' | 'gone' | 'paused' | 'cooldown' | 'recipient_limit'
    | 'rule_limit' | 'account_limit' | 'user_limit' | 'global_limit';

export const SEND_ERROR_MESSAGES: Record<SendErrorKind, string> = {
    rate_limited: 'Instagram is limiting replies from this account for now. The reply goes out after the cooldown.',
    blocked: 'Instagram has temporarily blocked private replies from this account. Replies wait a day; check the account in the Instagram app.',
    transient: 'Instagram had a temporary problem. The reply is tried again.',
    already_replied: 'Instagram says this comment already has a private reply, so a second one was not sent.',
    not_authorized: 'Instagram refused this account\'s permission to send messages. Replies are held: reconnect the account on the Accounts page, check that it allows access to messages in the Instagram app, then resume it.',
    not_eligible: 'Instagram does not allow a private reply to this comment: it may be deleted or older than 7 days, or its author does not accept messages.',
    refused: 'Instagram refused the reply.',
};

const LIMIT_MESSAGES: Record<Exclude<ReserveOutcome, 'ok' | 'gone' | 'paused' | 'recipient_limit'>, string> = {
    cooldown: 'Waiting for Instagram\'s cooldown on this account to end.',
    rule_limit: 'Waiting: this rule reached its hourly reply limit.',
    account_limit: 'Waiting: this account reached its hourly reply limit.',
    user_limit: 'Waiting: your accounts reached their combined hourly reply limit.',
    global_limit: 'Waiting: this Twiligent instance reached its hourly reply limit.',
};

const EXPIRED_MESSAGE = 'The 7 days in which Instagram allows a private reply to this comment ran out.';
export const FOLLOWUP_EXPIRED_MESSAGE = 'The 24 hours in which Instagram allows a message after the person\'s reply ran out.';

export function composeReply(replyText: string, linkUrl: string | null): string {
    return linkUrl ? `${replyText}\n\n${linkUrl}` : replyText;
}

export function messageBytes(message: string): number {
    return new TextEncoder().encode(message).length;
}

export function expiresAtFor(notifiedAt: Date): string {
    return new Date(notifiedAt.getTime() + REPLY_WINDOW_MS).toISOString();
}

// sha-256 of the text sent, so a reply whose answer was lost can be recognised in the conversation later
export async function messageDigest(text: string): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

// the private reply a job sends: the request to follow and answer for a followers-only rule, the reply and link otherwise
export function replyMessage(job: { requireFollow: boolean; followPromptText: string | null; replyText: string; linkUrl: string | null }): string {
    return job.requireFollow && job.followPromptText ? job.followPromptText : composeReply(job.replyText, job.linkUrl);
}

export function classifySendError({ code, subcode, httpStatus }: GraphSendError): SendErrorKind {
    if (httpStatus === 429 || (code !== undefined && RATE_LIMIT_CODES.has(code))) return 'rate_limited';
    if (code === 368) return 'blocked';
    if (code === ALREADY_REPLIED_CODE || subcode === ALREADY_REPLIED_SUBCODE) return 'already_replied';
    if (subcode !== undefined && NOT_ELIGIBLE_SUBCODES.has(subcode)) return 'not_eligible';
    if (code !== undefined && NOT_ELIGIBLE_CODES.has(code)) return 'not_eligible';
    if (subcode !== undefined && NOT_AUTHORIZED_SUBCODES.has(subcode)) return 'not_authorized';
    // a bare code 10 is a missing permission; with a subcode it is about the recipient, handled above
    if ((code !== undefined && NOT_AUTHORIZED_CODES.has(code)) || (code === 10 && subcode === undefined)) return 'not_authorized';
    if ((code !== undefined && TRANSIENT_CODES.has(code)) || httpStatus >= 500) return 'transient';
    return 'refused';
}

// waits 1, 2, 4 and 8 minutes after the first four tries, never more than an hour
export function retryDelayMs(attempts: number, random: () => number = Math.random): number {
    const backoff = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1));
    return backoff + Math.floor(random() * BACKOFF_JITTER_MS);
}

// Meta's X-Business-Use-Case-Usage header says, per business, how many minutes until calls are allowed again
export function cooldownFromUsage(usageHeader: string | null): number {
    if (!usageHeader) return DEFAULT_COOLDOWN_MS;
    try {
        const usage = JSON.parse(usageHeader) as Record<string, { estimated_time_to_regain_access?: number }[]>;
        const minutes = Object.values(usage).flat().map(entry => entry.estimated_time_to_regain_access ?? 0);
        const longest = Math.max(0, ...minutes);
        return longest > 0 ? Math.min(BLOCKED_COOLDOWN_MS, longest * 60 * 1000) : DEFAULT_COOLDOWN_MS;
    } catch {
        // a header Meta changed is not a reason to stop; the default cooldown still protects the account
        return DEFAULT_COOLDOWN_MS;
    }
}

function emptyPlan(): Omit<FinishPlan, 'status' | 'outcome'> {
    return {
        reason: null, errorMessage: null, messageId: null, errorCode: null, errorSubcode: null, httpStatus: null,
        nextAttemptAt: null, cooldownUntil: null, cooldownReason: null, pauseReason: null, recipientId: null, gateStatus: null,
    };
}

// a wait that ends after Instagram's reply window would only fail, so the job expires instead
function waitUntil(at: number, job: DeliveryJob, reason: string, message: string): Pick<FinishPlan, 'status' | 'reason' | 'errorMessage' | 'nextAttemptAt'> {
    if (at >= Date.parse(job.expiresAt)) return { status: 'expired', reason: 'expired', errorMessage: job.expiredMessage ?? EXPIRED_MESSAGE, nextAttemptAt: null };
    return { status: 'retry_wait', reason, errorMessage: message, nextAttemptAt: new Date(at).toISOString() };
}

// what to record for the answer to one send
export function finishPlan(result: SendResult, job: DeliveryJob, now: number, random: () => number = Math.random): FinishPlan {
    if (result.kind === 'accepted') {
        return {
            ...emptyPlan(),
            status: 'accepted',
            outcome: 'accepted',
            messageId: result.messageId,
            recipientId: result.recipientId ?? job.fromId ?? null,
            gateStatus: job.awaitsReply ? 'awaiting_reply' : null,
        };
    }
    if (result.kind === 'not_sent') {
        return { ...emptyPlan(), ...waitUntil(now + NOT_SENT_RETRY_MS, job, 'not_sent', `The reply was not sent (${result.message}). It is tried again on the next run.`), outcome: 'rejected' };
    }
    if (result.kind === 'ambiguous') {
        return {
            ...emptyPlan(),
            status: 'needs_review',
            outcome: 'ambiguous',
            reason: 'no_answer',
            errorMessage: `Instagram did not answer (${result.message}), so the reply may or may not have been sent. Check the conversation on Instagram before you retry.`,
        };
    }

    const kind = classifySendError(result);
    const details = { ...emptyPlan(), errorCode: result.code ?? null, errorSubcode: result.subcode ?? null, httpStatus: result.httpStatus };
    const message = kind === 'refused' ? `${SEND_ERROR_MESSAGES.refused} ${result.message}`.trim() : SEND_ERROR_MESSAGES[kind];

    if (kind === 'rate_limited' || kind === 'blocked') {
        const until = now + (kind === 'blocked' ? BLOCKED_COOLDOWN_MS : cooldownFromUsage(result.usageHeader));
        const cooldownUntil = new Date(until).toISOString();
        return {
            ...details,
            ...waitUntil(until, job, kind, message),
            outcome: kind === 'rate_limited' ? 'rate_limited' : 'rejected',
            cooldownUntil,
            cooldownReason: SEND_ERROR_MESSAGES[kind],
        };
    }
    if (kind === 'transient' && job.attempts < MAX_SEND_ATTEMPTS) {
        return { ...details, ...waitUntil(now + retryDelayMs(job.attempts, random), job, kind, message), outcome: 'rejected' };
    }
    if (kind === 'already_replied') {
        return { ...details, status: 'skipped', outcome: 'rejected', reason: kind, errorMessage: message };
    }
    if (kind === 'not_authorized') {
        // the reply did not go out, so it waits with the account's other replies until the owner fixes the account
        return {
            ...details,
            status: 'queued',
            outcome: 'rejected',
            reason: 'paused',
            errorMessage: message,
            nextAttemptAt: new Date(now + HOLD_RECHECK_MS).toISOString(),
            pauseReason: SEND_ERROR_MESSAGES.not_authorized,
        };
    }
    const finalMessage = kind === 'transient' ? `${message.replace(/ The reply is tried again\.$/, '')} Sending stopped after ${MAX_SEND_ATTEMPTS} tries.` : message;
    return { ...details, status: 'failed', outcome: 'rejected', reason: kind, errorMessage: finalMessage };
}

// a claimed job that cannot be sent as it is, checked before any limit is spent; null means it may go ahead
export function readinessPlan(job: { ruleEnabled: boolean; accessToken: string | null; expiresAt: string }, now: number): ReleasePlan | null {
    if (now >= Date.parse(job.expiresAt)) return { status: 'expired', reason: 'expired', errorMessage: EXPIRED_MESSAGE, nextAttemptAt: null };
    if (!job.ruleEnabled) {
        return { status: 'skipped', reason: 'rule_disabled', errorMessage: 'The rule was turned off or removed before the reply was sent.', nextAttemptAt: null };
    }
    if (!job.accessToken) {
        return { status: 'failed', reason: 'not_connected', errorMessage: 'The Instagram account has no access token. Reconnect it on the Accounts page, then retry.', nextAttemptAt: null };
    }
    return null;
}

// where a job goes when the reservation says no; null when it was sent (ok) or is no longer this run's (gone)
export function releasePlan(outcome: ReserveOutcome, retryAt: string | null, job: DeliveryJob, now: number): ReleasePlan | null {
    if (outcome === 'ok' || outcome === 'gone') return null;
    if (outcome === 'paused') {
        return { status: 'queued', reason: 'paused', errorMessage: 'Held while automation for this account is paused.', nextAttemptAt: new Date(now + HOLD_RECHECK_MS).toISOString() };
    }
    if (outcome === 'recipient_limit') {
        return { status: 'skipped', reason: outcome, errorMessage: 'This person already received the most private replies allowed in a day, so no more were sent.', nextAttemptAt: null };
    }
    const at = retryAt ? Date.parse(retryAt) : now + DEFAULT_COOLDOWN_MS;
    const { status, reason, errorMessage, nextAttemptAt } = waitUntil(at, job, outcome, LIMIT_MESSAGES[outcome]);
    return { status, reason: reason ?? outcome, errorMessage, nextAttemptAt };
}

// a claimed follow-up that cannot go ahead, checked before Instagram is asked anything; null means it may
export function followupReadiness(job: FollowupJob, now: number): ReleasePlan | null {
    if (now >= Date.parse(job.windowExpiresAt)) return { status: 'expired', reason: 'expired', errorMessage: FOLLOWUP_EXPIRED_MESSAGE, nextAttemptAt: null };
    if (!job.ruleEnabled) {
        return { status: 'skipped', reason: 'rule_disabled', errorMessage: 'The rule was turned off or removed before the follow-up was sent.', nextAttemptAt: null };
    }
    if (!job.requireFollow) {
        return { status: 'skipped', reason: 'rule_changed', errorMessage: 'The rule no longer asks people to follow, so no follow-up was sent.', nextAttemptAt: null };
    }
    if (job.gateStatus !== 'awaiting_reply') {
        return { status: 'skipped', reason: 'answered', errorMessage: 'This person already got the link or every reminder.', nextAttemptAt: null };
    }
    if (!job.accessToken) {
        return { status: 'failed', reason: 'not_connected', errorMessage: 'The Instagram account has no access token. Reconnect it on the Accounts page, then retry.', nextAttemptAt: null };
    }
    return null;
}

// what the follow check leads to: a message to send, or why nothing is sent. Only a confirmed follow sends the link
export function followupMessage(check: FollowCheck, job: FollowupJob, now: number): { message: FollowupMessage } | { release: ReleasePlan } {
    if (check.kind === 'following') {
        return { message: { kind: 'link', text: composeReply(job.replyText ?? '', job.linkUrl), gateStatus: 'completed', countReminder: false } };
    }
    if (check.kind === 'not_following') {
        if (job.gatePrompts >= MAX_FOLLOW_REMINDERS || !job.notFollowingText) {
            return { release: { status: 'skipped', reason: 'reminders_used', errorMessage: 'This person does not follow the account and already got every reminder.', nextAttemptAt: null } };
        }
        const last = job.gatePrompts + 1 >= MAX_FOLLOW_REMINDERS;
        return { message: { kind: 'reminder', text: job.notFollowingText, gateStatus: last ? 'closed' : null, countReminder: true } };
    }
    if (check.kind === 'unverifiable') {
        return {
            release: {
                status: 'failed',
                reason: 'follow_unverifiable',
                errorMessage: `Instagram did not say whether this person follows the account (${check.message}), so the link was not sent.`.slice(0, 500),
                nextAttemptAt: null,
            },
        };
    }
    if (check.kind === 'not_authorized') {
        return {
            release: {
                status: 'failed',
                reason: 'not_authorized',
                errorMessage: 'Instagram refused this account\'s permission to check followers or send messages. Reconnect the account on the Accounts page, then retry.',
                nextAttemptAt: null,
            },
        };
    }
    const wait = waitUntil(now + FOLLOW_CHECK_RETRY_MS, { attempts: job.attempts, expiresAt: job.windowExpiresAt, expiredMessage: FOLLOWUP_EXPIRED_MESSAGE },
        'follow_check', `Instagram could not answer the follow check (${check.message}). It is asked again in a few minutes.`);
    return { release: { status: wait.status, reason: wait.reason ?? 'follow_check', errorMessage: wait.errorMessage, nextAttemptAt: wait.nextAttemptAt } };
}
