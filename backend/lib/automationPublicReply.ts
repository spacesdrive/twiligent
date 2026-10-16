import {
    BLOCKED_COOLDOWN_MS, DEFAULT_COOLDOWN_MS, HOLD_RECHECK_MS, MAX_SEND_ATTEMPTS, NOT_SENT_RETRY_MS, classifySendError, cooldownFromUsage, retryDelayMs,
} from './automationDelivery.ts';
import type { ReleasePlan, ReserveOutcome, SendErrorKind, SendResult } from './automationDelivery.ts';
import type { AutomationAttemptOutcome, AutomationPublicReplyStatus } from '../../shared/types/automation.ts';

// the rules for a public reply under a comment; the private reply's rules are in automationDelivery.ts

// a rule rotates between at most five texts, so a busy post does not fill with the same words
export const MAX_PUBLIC_REPLY_TEXTS = 5;
// Instagram allows 2,200 characters in a comment; a short reply reads as a person's and is less likely to look like spam
export const MAX_PUBLIC_REPLY_CHARS = 300;
// Instagram's older API refused comments with more than 4 hashtags or more than 1 link; the same bounds keep replies safe
const MAX_PUBLIC_HASHTAGS = 4;
const MAX_PUBLIC_LINKS = 1;

// reserve, send and finish
export const SUBREQUESTS_PER_PUBLIC_REPLY = 3;

// a lost answer is looked for five minutes after the attempt, then every five minutes; the comment's replies show up
// within seconds, so two checks that miss it mean it never arrived
export const PUBLIC_REVIEW_SETTLE_SECONDS = 5 * 60;
export const PUBLIC_REVIEW_RECHECK_SECONDS = 5 * 60;
export const PUBLIC_REVIEW_MAX_CHECKS = 3;
const RESEND_AFTER_CHECKS = 2;
// a reply is sent again at most once after a lost answer; a second lost answer is left to a person
const MAX_LOST_ANSWERS_BEFORE_RESEND = 1;
// each check reads up to two pages of replies and records what it found
export const MAX_REPLY_PAGES = 2;
export const SUBREQUESTS_PER_PUBLIC_REVIEW = MAX_REPLY_PAGES + 1;
export const PUBLIC_REVIEW_BATCH = 5;

// Graph API code 100 with subcode 33: the comment no longer exists or cannot be seen, as for a deleted or hidden comment
const MISSING_OBJECT_CODE = 100;
const MISSING_OBJECT_SUBCODE = 33;

const HASHTAG = /(^|\s)#[\p{L}\p{N}_]+/gu;
const LINK = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;

// one claimed public reply, as the delivery rules need it; attempts already counts the send being settled
export interface PublicReplyJob {
    attempts: number;
    expiresAt: string;
}

// one finish_automation_public_reply call
export interface PublicFinishPlan {
    status: AutomationPublicReplyStatus;
    outcome: AutomationAttemptOutcome;
    reason: string | null;
    errorMessage: string | null;
    replyId: string | null;
    errorCode: number | null;
    errorSubcode: number | null;
    httpStatus: number | null;
    nextAttemptAt: string | null;
    cooldownUntil: string | null;
    cooldownReason: string | null;
    pauseReason: string | null;
}

export const PUBLIC_ERROR_MESSAGES: Record<SendErrorKind, string> = {
    rate_limited: 'Instagram is limiting this account\'s requests for now. The public reply goes out after the cooldown.',
    blocked: 'Instagram has temporarily blocked comments from this account. Public replies wait a day; check the account in the Instagram app. Private replies are not affected.',
    transient: 'Instagram had a temporary problem. The public reply is tried again.',
    already_replied: 'Instagram refused the public reply.',
    not_authorized: 'Instagram refused this account\'s permission to reply to comments. Replies are held: reconnect the account on the Accounts page, then resume it.',
    not_eligible: 'Instagram does not allow a public reply to this comment: it may be deleted or hidden, or on a live video.',
    refused: 'Instagram refused the public reply.',
};

const PUBLIC_LIMIT_MESSAGES: Partial<Record<ReserveOutcome, string>> = {
    cooldown: 'Waiting for Instagram\'s cooldown on this account\'s public replies to end.',
    account_limit: 'Waiting: this account reached its hourly limit for public replies.',
};

const PUBLIC_EXPIRED_MESSAGE = 'This public reply waited 7 days without going out, so Twiligent stopped trying.';

// what is wrong with one public reply text, or null when Instagram should take it
export function publicReplyTextProblem(text: string): string | null {
    if (text.length > MAX_PUBLIC_REPLY_CHARS) return `A public reply can be at most ${MAX_PUBLIC_REPLY_CHARS} characters`;
    if ((text.match(HASHTAG) ?? []).length > MAX_PUBLIC_HASHTAGS) return `A public reply can have at most ${MAX_PUBLIC_HASHTAGS} hashtags`;
    if ((text.match(LINK) ?? []).length > MAX_PUBLIC_LINKS) return `A public reply can have at most ${MAX_PUBLIC_LINKS} link; put the rest in the private reply`;
    return null;
}

// the same comment always gets the same text, so a redelivered notification and every check agree on the words;
// FNV-1a spreads neighbouring comment ids across the texts
export function pickPublicReplyText(texts: string[], commentId: string): string {
    let hash = 0x811c9dc5;
    for (let index = 0; index < commentId.length; index++) {
        hash ^= commentId.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return texts[hash % texts.length];
}

// a wait that ends after the reply's 7 days would only fail, so it expires instead
function waitUntil(at: number, job: PublicReplyJob, reason: string, message: string): Pick<PublicFinishPlan, 'status' | 'reason' | 'errorMessage' | 'nextAttemptAt'> {
    if (at >= Date.parse(job.expiresAt)) return { status: 'expired', reason: 'expired', errorMessage: PUBLIC_EXPIRED_MESSAGE, nextAttemptAt: null };
    return { status: 'retry_wait', reason, errorMessage: message, nextAttemptAt: new Date(at).toISOString() };
}

function emptyPlan(): Omit<PublicFinishPlan, 'status' | 'outcome'> {
    return {
        reason: null, errorMessage: null, replyId: null, errorCode: null, errorSubcode: null, httpStatus: null,
        nextAttemptAt: null, cooldownUntil: null, cooldownReason: null, pauseReason: null,
    };
}

// what to record for the answer to one public reply; accepted only when Instagram returned the new reply's id
export function publicFinishPlan(result: SendResult, job: PublicReplyJob, now: number, random: () => number = Math.random): PublicFinishPlan {
    if (result.kind === 'accepted') return { ...emptyPlan(), status: 'accepted', outcome: 'accepted', replyId: result.messageId };
    if (result.kind === 'not_sent') {
        return { ...emptyPlan(), ...waitUntil(now + NOT_SENT_RETRY_MS, job, 'not_sent', `The public reply was not sent (${result.message}). It is tried again on the next run.`), outcome: 'rejected' };
    }
    if (result.kind === 'ambiguous') {
        return {
            ...emptyPlan(),
            status: 'needs_review',
            outcome: 'ambiguous',
            reason: 'no_answer',
            errorMessage: `Instagram did not answer (${result.message}), so the public reply may or may not be there. Twiligent checks the comment's replies and sends it again only if it is not there.`,
        };
    }

    const details = { ...emptyPlan(), errorCode: result.code ?? null, errorSubcode: result.subcode ?? null, httpStatus: result.httpStatus };
    const kind: SendErrorKind = result.code === MISSING_OBJECT_CODE && result.subcode === MISSING_OBJECT_SUBCODE ? 'not_eligible' : classifySendError(result);
    const message = kind === 'refused' || kind === 'already_replied'
        ? `${PUBLIC_ERROR_MESSAGES.refused} ${result.message}`.trim().slice(0, 500)
        : PUBLIC_ERROR_MESSAGES[kind];

    if (kind === 'rate_limited' || kind === 'blocked') {
        const until = now + (kind === 'blocked' ? BLOCKED_COOLDOWN_MS : cooldownFromUsage(result.usageHeader));
        return {
            ...details,
            ...waitUntil(until, job, kind, message),
            outcome: kind === 'rate_limited' ? 'rate_limited' : 'rejected',
            cooldownUntil: new Date(until).toISOString(),
            cooldownReason: PUBLIC_ERROR_MESSAGES[kind],
        };
    }
    if (kind === 'transient' && job.attempts < MAX_SEND_ATTEMPTS) {
        return { ...details, ...waitUntil(now + retryDelayMs(job.attempts, random), job, kind, message), outcome: 'rejected' };
    }
    if (kind === 'not_eligible') return { ...details, status: 'skipped', outcome: 'rejected', reason: kind, errorMessage: message };
    if (kind === 'not_authorized') {
        // the token is the account's, so private replies are held too until the owner fixes the account
        return {
            ...details,
            status: 'queued',
            outcome: 'rejected',
            reason: 'paused',
            errorMessage: message,
            nextAttemptAt: new Date(now + HOLD_RECHECK_MS).toISOString(),
            pauseReason: PUBLIC_ERROR_MESSAGES.not_authorized,
        };
    }
    const finalMessage = kind === 'transient' ? `Instagram had a temporary problem. Sending stopped after ${MAX_SEND_ATTEMPTS} tries.` : message;
    return { ...details, status: 'failed', outcome: 'rejected', reason: kind, errorMessage: finalMessage };
}

// a claimed public reply that cannot go out as it is, checked before any limit is spent; null means it may go ahead
export function publicReadinessPlan(job: { ruleEnabled: boolean; accessToken: string | null; expiresAt: string }, now: number): ReleasePlan | null {
    if (now >= Date.parse(job.expiresAt)) return { status: 'expired', reason: 'expired', errorMessage: PUBLIC_EXPIRED_MESSAGE, nextAttemptAt: null };
    if (!job.ruleEnabled) {
        return { status: 'skipped', reason: 'rule_disabled', errorMessage: 'The rule, or its public reply, was turned off before the reply was sent.', nextAttemptAt: null };
    }
    if (!job.accessToken) {
        return { status: 'failed', reason: 'not_connected', errorMessage: 'The Instagram account has no access token. Reconnect it on the Accounts page, then retry.', nextAttemptAt: null };
    }
    return null;
}

// where a public reply goes when the reservation says no; null when it was sent (ok) or is no longer this run's (gone)
export function publicReleasePlan(outcome: ReserveOutcome, retryAt: string | null, job: PublicReplyJob, now: number): ReleasePlan | null {
    if (outcome === 'ok' || outcome === 'gone') return null;
    if (outcome === 'paused') {
        return { status: 'queued', reason: 'paused', errorMessage: 'Held while automation for this account is paused.', nextAttemptAt: new Date(now + HOLD_RECHECK_MS).toISOString() };
    }
    if (outcome === 'recipient_limit') {
        return { status: 'skipped', reason: outcome, errorMessage: 'This person already got a public reply on this post today, so no second one was sent.', nextAttemptAt: null };
    }
    const at = retryAt ? Date.parse(retryAt) : now + DEFAULT_COOLDOWN_MS;
    const message = PUBLIC_LIMIT_MESSAGES[outcome] ?? 'Waiting for a limit on public replies to free up.';
    const { status, reason, errorMessage, nextAttemptAt } = waitUntil(at, job, outcome, message);
    return { status, reason: reason ?? outcome, errorMessage, nextAttemptAt };
}

// whether a reply not found among the comment's replies goes out again: only when every reply was read, on enough
// checks minutes apart, and it was not already sent again once
export function shouldResend({ complete, checks, lostAnswers }: { complete: boolean; checks: number; lostAnswers: number }): boolean {
    return complete && checks >= RESEND_AFTER_CHECKS && lostAnswers <= MAX_LOST_ANSWERS_BEFORE_RESEND;
}

// what the person sees on a public reply that was looked for and not found, after this many checks
export function publicReviewNote({ complete, checks }: { complete: boolean; checks: number }): string {
    if (!complete) return 'Twiligent could not read every reply on this comment, so it does not send the public reply again. Check the comment on Instagram before you retry.';
    if (checks < PUBLIC_REVIEW_MAX_CHECKS) return 'Twiligent checked the comment\'s replies and did not find this public reply. It looks again in a few minutes.';
    return 'Twiligent checked the comment\'s replies several times and did not find this public reply. Check the comment on Instagram before you retry.';
}
