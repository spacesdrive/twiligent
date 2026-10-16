import { pickRule } from '../lib/automationMatching.ts';
import { expiresAtFor } from '../lib/automationDelivery.ts';
import { ForbiddenError, NotConfiguredError } from '../lib/errors.ts';
import { newRowId } from '../lib/ids.ts';
import { verifyTokenMatches } from '../lib/metaWebhookSignature.ts';
import type { InstagramCommentEvent, InstagramWebhook } from '../validators/instagramWebhookValidators.ts';
import type { WebhookVerification } from '../validators/automationValidators.ts';
import type { AutomationConfig } from '../lib/config.ts';
import type { AutomationRuleRepository, WebhookRule } from '../repositories/automationRuleRepository.ts';
import type { AutomationCommentRepository, NewAutomationComment } from '../repositories/automationCommentRepository.ts';
import type { RequestContext } from '../types/context.ts';

export interface AutomationWebhookDeps {
    rules: AutomationRuleRepository;
    comments: AutomationCommentRepository;
    automation: AutomationConfig;
    context: RequestContext;
}

export interface IngestResult {
    stored: number;
    duplicates: number;
    // the new comments that matched a rule, for the request to start sending right away
    queuedIds: string[];
}

export interface AutomationWebhookService {
    challengeAnswer(verification: WebhookVerification): Promise<string>;
    ingest(webhook: InstagramWebhook): Promise<IngestResult>;
}

// Instagram comments are at most 2,200 characters; the column has the same limit
const MAX_TEXT = 2200;

function newComment(event: InstagramCommentEvent, owner: WebhookRule, fields: Pick<NewAutomationComment, 'ruleId' | 'status' | 'statusReason'>): NewAutomationComment {
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
        fromUsername: queued ? event.fromUsername : null,
        text: queued ? event.text?.slice(0, MAX_TEXT) ?? null : null,
        nextAttemptAt: queued ? new Date().toISOString() : null,
        notifiedAt: new Date(event.notifiedAt).toISOString(),
        expiresAt: expiresAtFor(new Date(event.notifiedAt)),
        ...fields,
    };
}

// the first rule of the oldest connected account owns a comment no rule answers, so it is still counted once
function classify(event: InstagramCommentEvent, rules: WebhookRule[]): NewAutomationComment {
    const owner = rules[0];
    if (event.fromId !== null && event.fromId === event.igUserId) return newComment(event, owner, { ruleId: null, status: 'ignored', statusReason: 'own_comment' });
    if (!event.text) return newComment(event, owner, { ruleId: null, status: 'ignored', statusReason: 'no_text' });
    const match = pickRule(rules, event.text, event.mediaId);
    if (!match) return newComment(event, owner, { ruleId: null, status: 'ignored', statusReason: 'no_match' });
    return newComment(event, match.rule, { ruleId: match.rule.id, status: 'queued', statusReason: null });
}

// stores what a webhook delivered before it is acknowledged; comments for accounts without an enabled rule are not kept
export function createAutomationWebhookService({ rules, comments, automation, context }: AutomationWebhookDeps): AutomationWebhookService {
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

            const rows: NewAutomationComment[] = [];
            for (const [igUserId, events] of byAccount) {
                const accountRules = await rules.listEnabledForInstagramUser(igUserId);
                if (accountRules.length === 0) continue;
                // one notification can repeat a comment; the first copy is the one kept
                const seen = new Set<string>();
                for (const event of events) {
                    if (seen.has(event.commentId)) continue;
                    seen.add(event.commentId);
                    rows.push(classify(event, accountRules));
                }
            }

            const inserted = await comments.insertMany(rows);
            const queuedIds = inserted.filter(row => row.status === 'queued').map(row => row.id);
            const result = { stored: inserted.length, duplicates: rows.length - inserted.length, queuedIds };
            context.log.info('instagram webhook stored', {
                comments: webhook.comments.length,
                unsupported: webhook.unsupported,
                stored: result.stored,
                duplicates: result.duplicates,
                queued: queuedIds.length,
            });
            return result;
        },
    };
}
