import { pickRule } from '../lib/automationMatching.ts';
import { DUE_NOW_SKEW_MS, expiresAtFor } from '../lib/automationDelivery.ts';
import { pickPublicReplyText } from '../lib/automationPublicReply.ts';
import { ForbiddenError, NotConfiguredError } from '../lib/errors.ts';
import { newRowId } from '../lib/ids.ts';
import { verifyTokenMatches } from '../lib/metaWebhookSignature.ts';
import type { InstagramCommentEvent, InstagramWebhook } from '../validators/instagramWebhookValidators.ts';
import type { WebhookVerification } from '../validators/automationValidators.ts';
import type { AutomationConfig } from '../lib/config.ts';
import type { AutomationRuleRepository, WebhookRule } from '../repositories/automationRuleRepository.ts';
import type { AutomationCommentRepository, NewAutomationComment } from '../repositories/automationCommentRepository.ts';
import type { AutomationFollowupRepository } from '../repositories/automationFollowupRepository.ts';
import type { InstagramMessageEvent } from '../validators/instagramWebhookValidators.ts';
import type { RequestContext } from '../types/context.ts';

export interface AutomationWebhookDeps {
    rules: AutomationRuleRepository;
    comments: AutomationCommentRepository;
    followups: AutomationFollowupRepository;
    automation: AutomationConfig;
    context: RequestContext;
}

export interface IngestResult {
    stored: number;
    duplicates: number;
    // the new comments that matched a rule, for the request to start sending right away
    queuedIds: string[];
    // the public replies queued under new comments, or under earlier copies that were missing one
    publicReplyIds: string[];
    // follow-ups for people who answered a followers-only reply
    followupIds: string[];
    // database calls the intake made, which count against the request's subrequests
    subrequests: number;
}

export interface AutomationWebhookService {
    challengeAnswer(verification: WebhookVerification): Promise<string>;
    ingest(webhook: InstagramWebhook): Promise<IngestResult>;
}

// Instagram comments are at most 2,200 characters; the column has the same limit
const MAX_TEXT = 2200;

type CommentFields = Pick<NewAutomationComment, 'ruleId' | 'status' | 'statusReason'> & Partial<Pick<NewAutomationComment, 'publicReply'>>;

function newComment(event: InstagramCommentEvent, owner: WebhookRule, fields: CommentFields): NewAutomationComment {
    const matched = fields.ruleId !== null;
    const queued = fields.status === 'queued';
    return {
        id: newRowId(),
        userId: owner.userId,
        accountId: owner.accountId,
        igUserId: event.igUserId,
        commentId: event.commentId,
        mediaId: event.mediaId,
        fromId: event.fromId,
        // the words and the author are kept only for comments a rule answers
        fromUsername: matched ? event.fromUsername : null,
        text: matched ? event.text?.slice(0, MAX_TEXT) ?? null : null,
        nextAttemptAt: queued ? new Date(Date.now() - DUE_NOW_SKEW_MS).toISOString() : null,
        notifiedAt: new Date(event.notifiedAt).toISOString(),
        expiresAt: expiresAtFor(new Date(event.notifiedAt)),
        publicReply: null,
        ...fields,
    };
}

// the first rule of the oldest connected account owns a comment no rule answers, so it is still counted once. The
// account's own comments are never answered, which also keeps its public replies from answering themselves
function classify(event: InstagramCommentEvent, rules: WebhookRule[]): NewAutomationComment {
    const owner = rules[0];
    if (event.fromId !== null && event.fromId === event.igUserId) return newComment(event, owner, { ruleId: null, status: 'ignored', statusReason: 'own_comment' });
    if (!event.text) return newComment(event, owner, { ruleId: null, status: 'ignored', statusReason: 'no_text' });
    const match = pickRule(rules, event.text, event.mediaId);
    if (!match) return newComment(event, owner, { ruleId: null, status: 'ignored', statusReason: 'no_match' });
    const { rule } = match;
    const publicReply = rule.publicReplyEnabled && rule.publicReplyTexts.length > 0
        ? { id: newRowId(), text: pickPublicReplyText(rule.publicReplyTexts, event.commentId) }
        : null;
    if (!rule.privateReplyEnabled) return newComment(event, rule, { ruleId: rule.id, status: 'skipped', statusReason: 'private_reply_off', publicReply });
    return newComment(event, rule, { ruleId: rule.id, status: 'queued', statusReason: null, publicReply });
}

// stores what a webhook delivered before it is acknowledged; comments for accounts without an enabled rule are not kept
export function createAutomationWebhookService({ rules, comments, followups, automation, context }: AutomationWebhookDeps): AutomationWebhookService {
    return {
        // Meta checks the callback by sending the Verify Token from its dashboard and expects the challenge back
        async challengeAnswer({ mode, verifyToken, challenge }) {
            if (!automation.verifyToken) {
                throw new NotConfiguredError('Instagram webhooks are not set up: the INSTAGRAM_WEBHOOK_VERIFY_TOKEN Worker secret is missing');
            }
            if (mode !== 'subscribe' || !challenge || !verifyToken || !await verifyTokenMatches(automation.verifyToken, verifyToken)) {
                throw new ForbiddenError('The verify token does not match the one set on this server');
            }
            return challenge;
        },

        async ingest(webhook) {
            const byAccount = new Map<string, InstagramCommentEvent[]>();
            for (const event of webhook.comments) byAccount.set(event.igUserId, [...(byAccount.get(event.igUserId) ?? []), event]);
            const messagesByAccount = new Map<string, InstagramMessageEvent[]>();
            for (const event of webhook.messages) messagesByAccount.set(event.igUserId, [...(messagesByAccount.get(event.igUserId) ?? []), event]);

            const rows: NewAutomationComment[] = [];
            let subrequests = 0;
            for (const [igUserId, events] of byAccount) {
                const accountRules = await rules.listEnabledForInstagramUser(igUserId);
                subrequests++;
                if (accountRules.length === 0) continue;
                // one notification can repeat a comment; the first copy is the one kept
                const seen = new Set<string>();
                for (const event of events) {
                    if (seen.has(event.commentId)) continue;
                    seen.add(event.commentId);
                    rows.push(classify(event, accountRules));
                }
            }

            const { inserted, publicReplyIds } = await comments.store(rows);
            const queuedIds = inserted.filter(row => row.status === 'queued').map(row => row.id);
            if (rows.length > 0) subrequests++;

            // a message only matters when its sender is waiting on a followers-only reply; the database decides that in
            // one call per account, and messages delivered again insert nothing
            const followupIds: string[] = [];
            for (const [igUserId, events] of messagesByAccount) {
                const incoming = events.map(event => ({ id: newRowId(), senderId: event.senderId, messageId: event.messageId, sentAt: new Date(event.sentAt).toISOString() }));
                followupIds.push(...await followups.insertForMessages(igUserId, incoming));
                subrequests++;
            }

            const result = { stored: inserted.length, duplicates: rows.length - inserted.length, queuedIds, publicReplyIds, followupIds, subrequests };
            context.log.info('instagram webhook stored', {
                comments: webhook.comments.length,
                messages: webhook.messages.length,
                unsupported: webhook.unsupported,
                stored: result.stored,
                duplicates: result.duplicates,
                queued: queuedIds.length,
                publicReplies: publicReplyIds.length,
                followups: followupIds.length,
            });
            return result;
        },
    };
}
