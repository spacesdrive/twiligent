import { execute, maybeRow, rows } from './query.ts';
import type { SupabaseClient } from '../types/app.ts';
import type { PostStatus, ScheduledPost } from '../../shared/types/domain.ts';

interface ScheduledPostRow {
    id: string;
    account_id: string;
    status: PostStatus;
    scheduled_at: string;
    claimed_at: string | null;
    attempts: number | null;
    data: Partial<ScheduledPost> | null;
}

interface PostColumnUpdates {
    status?: PostStatus;
    scheduled_at?: string;
    data?: Partial<ScheduledPost>;
}

export interface DeleteAllResult {
    deleted: number;
    kept: number;
}

const COLUMNS = 'id, account_id, status, scheduled_at, claimed_at, attempts, data';

function toPost(row: ScheduledPostRow): ScheduledPost {
    return {
        id: row.id,
        accountId: row.account_id,
        status: row.status,
        scheduledAt: row.scheduled_at,
        ...(row.data || {}),
        claimedAt: row.claimed_at,
        attempts: row.attempts ?? 0,
    };
}

// methods named ...ForUser filter by the verified user id; listDue, listStale, claim and updateById serve the schedulers across all users
export interface ScheduledPostRepository {
    listForUser(userId: string): Promise<ScheduledPost[]>;
    findForUser(id: string, userId: string): Promise<ScheduledPost | null>;
    listDue(): Promise<ScheduledPost[]>;
    listStale(claimedBefore: string): Promise<ScheduledPost[]>;
    claim(post: ScheduledPost): Promise<ScheduledPost | null>;
    create(post: ScheduledPost, userId: string): Promise<void>;
    updatePendingForUser(id: string, updates: Partial<ScheduledPost>, userId: string): Promise<boolean>;
    updateById(id: string, updates: Partial<ScheduledPost>): Promise<void>;
    deleteForUser(id: string, userId: string): Promise<boolean>;
    deleteAllForUser(userId: string): Promise<DeleteAllResult>;
}

export function createScheduledPostRepository(db: SupabaseClient): ScheduledPostRepository {
    // status and scheduledAt are columns; every other field is merged into data; claimedAt and attempts change only in claim
    async function update(id: string, updates: Partial<ScheduledPost>, userId: string | null, onlyStatus?: PostStatus): Promise<boolean> {
        const { status, scheduledAt, accountId: _accountId, claimedAt: _claimedAt, attempts: _attempts, ...dataUpdates } = updates;
        const columns: PostColumnUpdates = {};
        if (status !== undefined) columns.status = status;
        if (scheduledAt !== undefined) columns.scheduled_at = scheduledAt;

        if (Object.keys(dataUpdates).length > 0) {
            const current = await rows<Pick<ScheduledPostRow, 'data'>>('scheduledPosts.readData', () => {
                const query = db.from('scheduled_posts').select('data').eq('id', id);
                return userId ? query.eq('user_id', userId) : query;
            });
            columns.data = { ...(current[0]?.data || {}), ...dataUpdates };
        }

        if (!onlyStatus) {
            await execute('scheduledPosts.update', () => {
                const query = db.from('scheduled_posts').update(columns).eq('id', id);
                return userId ? query.eq('user_id', userId) : query;
            });
            return true;
        }

        // the status check sits in the same statement, so a scheduler claiming the post in between makes this change nothing
        const changed = await rows<{ id: string }>('scheduledPosts.updateIfStatus', () => {
            const query = db.from('scheduled_posts').update(columns).eq('id', id).eq('status', onlyStatus);
            return (userId ? query.eq('user_id', userId) : query).select('id');
        });
        return changed.length > 0;
    }

    return {
        async listForUser(userId) {
            const found = await rows<ScheduledPostRow>('scheduledPosts.listForUser', () => db
                .from('scheduled_posts')
                .select(COLUMNS)
                .order('scheduled_at', { ascending: true })
                .eq('user_id', userId));
            return found.map(toPost);
        },

        async findForUser(id, userId) {
            const row = await maybeRow<ScheduledPostRow>('scheduledPosts.findForUser', () => db
                .from('scheduled_posts')
                .select(COLUMNS)
                .eq('id', id)
                .eq('user_id', userId)
                .maybeSingle());
            return row ? toPost(row) : null;
        },

        async listDue() {
            const found = await rows<ScheduledPostRow>('scheduledPosts.listDue', () => db
                .from('scheduled_posts')
                .select(COLUMNS)
                .eq('status', 'pending')
                .lte('scheduled_at', new Date().toISOString()));
            return found.map(toPost);
        },

        async listStale(claimedBefore) {
            const found = await rows<ScheduledPostRow>('scheduledPosts.listStale', () => db
                .from('scheduled_posts')
                .select(COLUMNS)
                .eq('status', 'publishing')
                .lt('claimed_at', claimedBefore));
            return found.map(toPost);
        },

        // matches only the post as it was listed (pending, or the same expired claim) with the same attempts; null means another run won
        async claim(post) {
            const claimed = await rows<ScheduledPostRow>('scheduledPosts.claim', () => {
                const query = db
                    .from('scheduled_posts')
                    .update({ status: 'publishing', claimed_at: new Date().toISOString(), attempts: (post.attempts ?? 0) + 1 })
                    .eq('id', post.id)
                    .eq('attempts', post.attempts ?? 0);
                const unchanged = post.status === 'publishing'
                    ? query.eq('status', 'publishing').eq('claimed_at', post.claimedAt)
                    : query.eq('status', 'pending');
                return unchanged.select(COLUMNS);
            });
            return claimed[0] ? toPost(claimed[0]) : null;
        },

        async create(post, userId) {
            const { id, accountId, status, scheduledAt, ...rest } = post;
            await execute('scheduledPosts.create', () => db.from('scheduled_posts').insert({
                id,
                user_id: userId,
                account_id: accountId,
                status: status || 'pending',
                scheduled_at: scheduledAt,
                data: rest,
            }));
        },

        updatePendingForUser: (id, updates, userId) => update(id, updates, userId, 'pending'),

        async updateById(id, updates) {
            await update(id, updates, null);
        },

        // a post being published is never deleted, checked in the delete itself so a claim in between cannot slip past
        async deleteForUser(id, userId) {
            const deleted = await rows<{ id: string }>('scheduledPosts.delete', () => db
                .from('scheduled_posts')
                .delete()
                .eq('id', id)
                .eq('user_id', userId)
                .neq('status', 'publishing')
                .select('id'));
            return deleted.length > 0;
        },

        // posts being published right now are kept, so a publish never loses its row
        async deleteAllForUser(userId) {
            const total = await execute('scheduledPosts.count', () => db
                .from('scheduled_posts').select('*', { count: 'exact', head: true }).eq('user_id', userId));
            const keeping = await execute('scheduledPosts.countPublishing', () => db
                .from('scheduled_posts').select('*', { count: 'exact', head: true }).eq('status', 'publishing').eq('user_id', userId));
            await execute('scheduledPosts.deleteAll', () => db.from('scheduled_posts').delete().neq('status', 'publishing').eq('user_id', userId));
            const kept = keeping.count || 0;
            return { deleted: (total.count || 0) - kept, kept };
        },
    };
}
