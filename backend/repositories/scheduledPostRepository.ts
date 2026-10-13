import { execute, maybeRow, rows } from './query.ts';
import type { SupabaseClient } from '../types/app.ts';
import type { PostStatus, ScheduledPost } from '../../shared/types/domain.ts';

interface ScheduledPostRow {
    id: string;
    account_id: string;
    status: PostStatus;
    scheduled_at: string;
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

const COLUMNS = 'id, account_id, status, scheduled_at, data';

function toPost(row: ScheduledPostRow): ScheduledPost {
    return {
        id: row.id,
        accountId: row.account_id,
        status: row.status,
        scheduledAt: row.scheduled_at,
        ...(row.data || {}),
    };
}

// methods named ...ForUser filter by the verified user id; listDue, claim and updateById serve the schedulers across all users
export interface ScheduledPostRepository {
    listForUser(userId: string): Promise<ScheduledPost[]>;
    findForUser(id: string, userId: string): Promise<ScheduledPost | null>;
    listDue(): Promise<ScheduledPost[]>;
    claim(id: string): Promise<boolean>;
    create(post: ScheduledPost, userId: string): Promise<void>;
    updateForUser(id: string, updates: Partial<ScheduledPost>, userId: string): Promise<void>;
    updateById(id: string, updates: Partial<ScheduledPost>): Promise<void>;
    deleteForUser(id: string, userId: string): Promise<void>;
    deleteAllForUser(userId: string): Promise<DeleteAllResult>;
}

export function createScheduledPostRepository(db: SupabaseClient): ScheduledPostRepository {
    // status and scheduledAt are columns; every other field is merged into data
    async function update(id: string, updates: Partial<ScheduledPost>, userId: string | null): Promise<void> {
        const { status, scheduledAt, accountId: _accountId, ...dataUpdates } = updates;
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

        await execute('scheduledPosts.update', () => {
            const query = db.from('scheduled_posts').update(columns).eq('id', id);
            return userId ? query.eq('user_id', userId) : query;
        });
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

        // atomic pending to publishing; false means the other scheduler claimed it first
        async claim(id) {
            const claimed = await rows<{ id: string }>('scheduledPosts.claim', () => db
                .from('scheduled_posts')
                .update({ status: 'publishing' })
                .eq('id', id)
                .eq('status', 'pending')
                .select('id'));
            return claimed.length > 0;
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

        updateForUser: (id, updates, userId) => update(id, updates, userId),

        updateById: (id, updates) => update(id, updates, null),

        async deleteForUser(id, userId) {
            await execute('scheduledPosts.delete', () => db.from('scheduled_posts').delete().eq('id', id).eq('user_id', userId));
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
