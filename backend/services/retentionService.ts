import type { AutomationCommentRepository } from '../repositories/automationCommentRepository.ts';
import type { AuditRepository } from '../repositories/auditRepository.ts';
import type { RequestContext } from '../types/context.ts';

export interface RetentionDeps {
    comments: AutomationCommentRepository;
    audit: AuditRepository;
    context: RequestContext;
}

export interface RetentionRun {
    comments: number;
    auditEvents: number;
    // more old comments are left for the next day's run
    commentsLeft: boolean;
}

export interface RetentionOptions {
    // database calls the run may make for comments, after the token refresh took its share
    commentBatches?: number;
}

export interface RetentionService {
    purge(now?: number, options?: RetentionOptions): Promise<RetentionRun>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// received comments and their reply attempts are kept 90 days: long enough to answer "did they get it?", short for personal data
export const COMMENT_RETENTION_DAYS = 90;
// who connected, removed or changed what is kept a year
export const AUDIT_RETENTION_DAYS = 365;
// one delete stays short however much built up; twenty batches clear 20,000 comments a day
export const COMMENT_PURGE_BATCH = 1000;
const DEFAULT_COMMENT_BATCHES = 20;

// the daily cron's deletes across all users; a comment's attempts and follow-ups go with it through the foreign keys
export function createRetentionService({ comments, audit, context }: RetentionDeps): RetentionService {
    return {
        async purge(now = Date.now(), { commentBatches = DEFAULT_COMMENT_BATCHES } = {}) {
            const cutoff = new Date(now - COMMENT_RETENTION_DAYS * DAY_MS).toISOString();
            let deleted = 0;
            let commentsLeft = false;
            for (let batch = 0; batch < commentBatches; batch++) {
                const count = await comments.purgeCreatedBefore(cutoff, COMMENT_PURGE_BATCH);
                deleted += count;
                commentsLeft = count === COMMENT_PURGE_BATCH;
                if (!commentsLeft || context.signal.aborted) break;
            }
            const run = {
                comments: deleted,
                auditEvents: await audit.deleteCreatedBefore(new Date(now - AUDIT_RETENTION_DAYS * DAY_MS).toISOString()),
                commentsLeft,
            };
            context.log.info('retention purge', { ...run });
            return run;
        },
    };
}
