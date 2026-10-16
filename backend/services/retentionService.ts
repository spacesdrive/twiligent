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
}

export interface RetentionService {
    purge(now?: number): Promise<RetentionRun>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// received comments and their reply attempts are kept 90 days: long enough to answer "did they get it?", short for personal data
export const COMMENT_RETENTION_DAYS = 90;
// who connected, removed or changed what is kept a year
export const AUDIT_RETENTION_DAYS = 365;

// the daily cron's deletes across all users; a comment's attempts go with it through the foreign key
export function createRetentionService({ comments, audit, context }: RetentionDeps): RetentionService {
    return {
        async purge(now = Date.now()) {
            const run = {
                comments: await comments.deleteCreatedBefore(new Date(now - COMMENT_RETENTION_DAYS * DAY_MS).toISOString()),
                auditEvents: await audit.deleteCreatedBefore(new Date(now - AUDIT_RETENTION_DAYS * DAY_MS).toISOString()),
            };
            context.log.info('retention purge', { ...run });
            return run;
        },
    };
}
