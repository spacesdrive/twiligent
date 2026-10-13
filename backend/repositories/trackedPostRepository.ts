import { execute, maybeRow, rows } from './query.ts';
import { NotFoundError } from '../lib/errors.ts';
import type { SupabaseClient } from '../types/app.ts';
import type { TrackedPost } from '../../shared/types/domain.ts';

interface TrackedPostRow {
    id: string;
    account_id: string | null;
    url: string;
    label: string | null;
    category: string | null;
    content_type: string | null;
    created_at: string;
    updated_at: string;
    data: Record<string, unknown> | null;
}

export interface NewTrackedPost {
    id: string;
    accountId?: string | null;
    url: string;
    label?: string;
    category?: string;
    contentType?: string;
}

export interface TrackedPostUpdates {
    label?: string;
    category?: string;
    accountId?: string | null;
    data?: Record<string, unknown>;
}

interface TrackedPostColumnUpdates {
    updated_at: string;
    label?: string;
    category?: string;
    account_id?: string | null;
    data?: Record<string, unknown>;
}

const COLUMNS = 'id, account_id, url, label, category, content_type, created_at, updated_at, data';

function toTrackedPost(row: TrackedPostRow): TrackedPost {
    return {
        id: row.id,
        accountId: row.account_id,
        url: row.url,
        label: row.label || '',
        category: row.category || '',
        contentType: row.content_type || 'reddit',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ...(row.data || {}),
    };
}

// every method is scoped to the verified user
export interface TrackedPostRepository {
    listForUser(userId: string): Promise<TrackedPost[]>;
    findForUser(id: string, userId: string): Promise<TrackedPost | null>;
    create(post: NewTrackedPost, userId: string): Promise<void>;
    updateForUser(id: string, updates: TrackedPostUpdates, userId: string): Promise<void>;
    patchDataForUser(id: string, patch: Record<string, unknown>, userId: string): Promise<void>;
    deleteForUser(id: string, userId: string): Promise<void>;
}

export function createTrackedPostRepository(db: SupabaseClient): TrackedPostRepository {
    return {
        async listForUser(userId) {
            const found = await rows<TrackedPostRow>('trackedPosts.listForUser', () => db
                .from('tracked_posts')
                .select(COLUMNS)
                .eq('user_id', userId)
                .order('created_at', { ascending: false }));
            return found.map(toTrackedPost);
        },

        async findForUser(id, userId) {
            const row = await maybeRow<TrackedPostRow>('trackedPosts.findForUser', () => db
                .from('tracked_posts')
                .select(COLUMNS)
                .eq('id', id)
                .eq('user_id', userId)
                .maybeSingle());
            return row ? toTrackedPost(row) : null;
        },

        async create(post, userId) {
            const { id, accountId, url, label, category, contentType } = post;
            await execute('trackedPosts.create', () => db.from('tracked_posts').insert({
                id,
                user_id: userId,
                account_id: accountId || null,
                url,
                label: label || '',
                category: category || '',
                content_type: contentType || 'reddit',
            }));
        },

        async updateForUser(id, updates, userId) {
            const columns: TrackedPostColumnUpdates = { updated_at: new Date().toISOString() };
            if (updates.label     !== undefined) columns.label      = updates.label;
            if (updates.category  !== undefined) columns.category   = updates.category;
            if (updates.accountId !== undefined) columns.account_id = updates.accountId || null;
            if (updates.data      !== undefined) columns.data       = updates.data;
            await execute('trackedPosts.update', () => db.from('tracked_posts').update(columns).eq('id', id).eq('user_id', userId));
        },

        // merges into data so manual fields and live refresh fields survive each other
        async patchDataForUser(id, patch, userId) {
            const row = await maybeRow<Pick<TrackedPostRow, 'data'>>('trackedPosts.readData', () => db
                .from('tracked_posts')
                .select('data')
                .eq('id', id)
                .eq('user_id', userId)
                .maybeSingle());
            if (!row) throw new NotFoundError('Tracked content not found');
            await execute('trackedPosts.patchData', () => db
                .from('tracked_posts')
                .update({ data: { ...(row.data || {}), ...patch }, updated_at: new Date().toISOString() })
                .eq('id', id)
                .eq('user_id', userId));
        },

        async deleteForUser(id, userId) {
            await execute('trackedPosts.delete', () => db.from('tracked_posts').delete().eq('id', id).eq('user_id', userId));
        },
    };
}
