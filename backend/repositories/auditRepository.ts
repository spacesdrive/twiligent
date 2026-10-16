import { execute, rows } from './query.ts';
import { newRowId } from '../lib/ids.ts';
import type { SupabaseClient } from '../types/app.ts';

export type AuditSubjectType = 'account' | 'automation_rule' | 'automation_account' | 'automation_comment';

// action is "<subject>.<verb>", such as account.removed or automation_rule.updated
export interface AuditEvent {
    action: string;
    subjectType: AuditSubjectType;
    subjectId: string | null;
    details?: Record<string, unknown>;
}

// recordForUser keeps who did what; deleteCreatedBefore is the daily retention across all users
export interface AuditRepository {
    recordForUser(userId: string, event: AuditEvent): Promise<void>;
    deleteCreatedBefore(cutoff: string): Promise<number>;
}

export function createAuditRepository(db: SupabaseClient): AuditRepository {
    return {
        async recordForUser(userId, { action, subjectType, subjectId, details = {} }) {
            await execute('auditEvents.record', () => db.from('audit_events').insert({
                id: newRowId(),
                user_id: userId,
                action,
                subject_type: subjectType,
                subject_id: subjectId,
                details,
            }));
        },

        async deleteCreatedBefore(cutoff) {
            const deleted = await rows<{ id: string }>('auditEvents.deleteOld', () => db
                .from('audit_events')
                .delete()
                .lt('created_at', cutoff)
                .select('id'));
            return deleted.length;
        },
    };
}
