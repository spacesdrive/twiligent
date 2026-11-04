import { execute, maybeRow, rows } from './query.ts';
import { NotFoundError } from '../lib/errors.ts';
import type { SupabaseClient } from '../types/app.ts';
import type { TrackedPost } from '../../shared/types/domain.ts';

interface TrackedPostRow {
    id: string;
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
    url: string;
    label?: string;
    category?: string;
    data?: Record<string, unknown>;
}

export interface TrackedPostUpdates {
    label?: string;
    category?: string;
    data?: Record<string, unknown>;
}

const COLUMNS = 'id, url, label, category, content_type, created_at, updated_at, data';

// rows of a platform Twiligent no longer tracks stay in the table until they are cleaned up, so reads leave them out
const CONTENT_TYPE = 'youtube';

function toTrackedPost(row: TrackedPostRow): TrackedPost {
    return {
        id: row.id,
        url: row.url,
        label: row.label || '',
        category: row.category || '',
        contentType: row.content_type || CONTENT_TYPE,
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
                .eq('content_type', CONTENT_TYPE)
                .order('created_at', { ascending: false }));
            return found.map(toTrackedPost);
        },

        async findForUser(id, userId) {
            const row = await maybeRow<TrackedPostRow>('trackedPosts.findForUser', () => db
                .from('tracked_posts')
                .select(COLUMNS)
                .eq('id', id)
                .eq('user_id', userId)
                .eq('content_type', CONTENT_TYPE)
                .maybeSingle());
            return row ? toTrackedPost(row) : null;
        },

        async create(post, userId) {
            const { id, url, label, category, data } = post;
            await execute('trackedPosts.create', () => db.from('tracked_posts').insert({
                id,
                user_id: userId,
                url,
                label: label || '',
                category: category || '',
                content_type: CONTENT_TYPE,
                data: data ?? null,
            }));
        },

        // the database trigger keeps updated_at
        async updateForUser(id, updates, userId) {
            const columns: TrackedPostUpdates = {};
            if (updates.label    !== undefined) columns.label    = updates.label;
            if (updates.category !== undefined) columns.category = updates.category;
            if (updates.data     !== undefined) columns.data     = updates.data;
            await execute('trackedPosts.update', () => db.from('tracked_posts').update(columns).eq('id', id).eq('user_id', userId));
        },

        // one atomic merge in the database, so stored fields a refresh does not return are kept
        async patchDataForUser(id, patch, userId) {
            const { data } = await execute('trackedPosts.patchData', () => db.rpc('merge_tracked_post_data', { p_id: id, p_user_id: userId, p_patch: patch }));
            if (!data) throw new NotFoundError('Tracked content not found');
        },

        async deleteForUser(id, userId) {
            await execute('trackedPosts.delete', () => db.from('tracked_posts').delete().eq('id', id).eq('user_id', userId));
        },
    };
}
