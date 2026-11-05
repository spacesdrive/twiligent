import { AppError, DatabaseError, UpstreamError } from '../lib/errors.ts';
import { errorFields } from '../lib/logger.ts';
import type { AutomationService } from './automationService.ts';
import type { AutomationRuleRepository } from '../repositories/automationRuleRepository.ts';
import type { PostAwaitingAutomation, ScheduledPostRepository } from '../repositories/scheduledPostRepository.ts';
import type { RequestContext } from '../types/context.ts';
import type { ScheduledPost } from '../../shared/types/domain.ts';

export interface PostAutomationDeps {
    posts: ScheduledPostRepository;
    rules: AutomationRuleRepository;
    automations: Pick<AutomationService, 'createRule'>;
    context: RequestContext;
}

export interface PostAutomationRun {
    created: number;
    failed: number;
}

export interface PostAutomationService {
    // turns the automation of each newly published post into a rule that answers any comment on that post
    attachPublished(limit: number): Promise<PostAutomationRun>;
}

const MAX_RULE_NAME = 80;
const NO_MEDIA_ID = 'The post was published without an Instagram post id, so no comment rule could be made for it.';

// the rule's name says which post it answers, so the Instagram automation page lists it beside hand-made rules
export function postRuleName(post: ScheduledPost): string {
    const firstLine = (post.caption ?? '').split('\n').map(line => line.trim()).find(Boolean) ?? '';
    const name = `Post ${post.scheduledAt.slice(0, 10)}${firstLine ? `: ${firstLine}` : ''}`;
    return name.length > MAX_RULE_NAME ? `${name.slice(0, MAX_RULE_NAME - 3).trimEnd()}...` : name;
}

// a database or Instagram failure may pass, so the post is tried again next run; any other failure is kept on the post
function passing(err: unknown): boolean {
    return err instanceof DatabaseError || err instanceof UpstreamError || !(err instanceof AppError);
}

export function createPostAutomationService({ posts, rules, automations, context }: PostAutomationDeps): PostAutomationService {
    const { log } = context;

    // a rule saved by an earlier run whose post was not marked yet is reused, so a post never gets two rules
    async function existingRule(userId: string, post: ScheduledPost, mediaId: string, name: string): Promise<string | null> {
        const found = (await rules.listForUser(userId)).find(rule => rule.accountId === post.accountId && rule.name === name
            && rule.mediaIds.length === 1 && rule.mediaIds[0] === mediaId);
        return found?.id ?? null;
    }

    async function attach({ post, userId }: PostAwaitingAutomation): Promise<boolean> {
        const automation = post.automation;
        const mediaId = post.publishedMediaId;
        if (!automation) return false;
        if (!mediaId) {
            await posts.updateById(post.id, { automationError: NO_MEDIA_ID });
            return false;
        }
        const name = postRuleName(post);
        const ruleId = await existingRule(userId, post, mediaId, name) ?? (await automations.createRule(userId, {
            accountId: post.accountId,
            name,
            keywords: [],
            matchMode: 'any',
            mediaIds: [mediaId],
            privateReplyEnabled: true,
            replyText: automation.replyText,
            publicReplyEnabled: automation.publicReplyTexts.length > 0,
            publicReplyTexts: automation.publicReplyTexts,
            enabled: true,
        })).id;
        await posts.updateById(post.id, { automationRuleId: ruleId });
        return true;
    }

    return {
        async attachPublished(limit) {
            const waiting = await posts.listAwaitingAutomation(limit);
            const run: PostAutomationRun = { created: 0, failed: 0 };
            for (const item of waiting) {
                try {
                    if (await attach(item)) run.created++;
                    else run.failed++;
                } catch (err) {
                    run.failed++;
                    log.warn('post automation not attached', { postId: item.post.id, ...errorFields(err) });
                    if (!passing(err)) await posts.updateById(item.post.id, { automationError: (err as Error).message });
                }
            }
            if (waiting.length > 0) log.info('post automation run', { ...run });
            return run;
        },
    };
}
