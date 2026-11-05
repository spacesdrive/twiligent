import { maybeRow, rows } from './query.ts';
import { newRowId } from '../lib/ids.ts';
import type { SupabaseClient } from '../types/app.ts';
import type { MediaAsset } from '../../shared/types/media.ts';

interface MediaRow {
    id: string;
    public_id: string;
    resource_type: MediaAsset['resourceType'];
    url: string;
    format: string | null;
    bytes: number | null;
    width: number | null;
    height: number | null;
    duration_seconds: number | null;
    label: string;
    created_at: string;
}

export interface NewMediaAsset {
    publicId: string;
    resourceType: MediaAsset['resourceType'];
    url: string;
    format: string | null;
    bytes: number | null;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
    label: string;
}

// the Cloudinary id stays inside the Worker: it is what deleting needs, and a caller never sends one
export type StoredMediaAsset = MediaAsset & { publicId: string };

const COLUMNS = 'id, public_id, resource_type, url, format, bytes, width, height, duration_seconds, label, created_at';

function toAsset(row: MediaRow): StoredMediaAsset {
    return {
        id: row.id,
        publicId: row.public_id,
        resourceType: row.resource_type,
        url: row.url,
        format: row.format,
        bytes: row.bytes === null ? null : Number(row.bytes),
        width: row.width,
        height: row.height,
        durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
        label: row.label,
        createdAt: row.created_at,
    };
}

// every method is scoped to the verified user: a file on the shared Cloudinary account belongs to the person whose row names it
export interface MediaAssetRepository {
    createForUser(userId: string, asset: NewMediaAsset): Promise<StoredMediaAsset>;
    listForUser(userId: string): Promise<StoredMediaAsset[]>;
    findForUser(id: string, userId: string): Promise<StoredMediaAsset | null>;
    findByPublicIdForUser(publicId: string, userId: string): Promise<StoredMediaAsset | null>;
    updateLabelForUser(id: string, userId: string, label: string): Promise<StoredMediaAsset | null>;
    deleteForUser(id: string, userId: string): Promise<boolean>;
}

export function createMediaAssetRepository(db: SupabaseClient): MediaAssetRepository {
    return {
        async createForUser(userId, asset) {
            const created = await rows<MediaRow>('mediaAssets.create', () => db.from('media_assets').insert({
                id: newRowId(),
                user_id: userId,
                public_id: asset.publicId,
                resource_type: asset.resourceType,
                url: asset.url,
                format: asset.format,
                bytes: asset.bytes,
                width: asset.width,
                height: asset.height,
                duration_seconds: asset.durationSeconds,
                label: asset.label,
            }).select(COLUMNS));
            return toAsset(created[0]);
        },

        async listForUser(userId) {
            const found = await rows<MediaRow>('mediaAssets.listForUser', () => db
                .from('media_assets')
                .select(COLUMNS)
                .eq('user_id', userId)
                .order('created_at', { ascending: false }));
            return found.map(toAsset);
        },

        async findForUser(id, userId) {
            const row = await maybeRow<MediaRow>('mediaAssets.findForUser', () => db
                .from('media_assets')
                .select(COLUMNS)
                .eq('id', id)
                .eq('user_id', userId)
                .maybeSingle());
            return row ? toAsset(row) : null;
        },

        async findByPublicIdForUser(publicId, userId) {
            const row = await maybeRow<MediaRow>('mediaAssets.findByPublicIdForUser', () => db
                .from('media_assets')
                .select(COLUMNS)
                .eq('public_id', publicId)
                .eq('user_id', userId)
                .maybeSingle());
            return row ? toAsset(row) : null;
        },

        async updateLabelForUser(id, userId, label) {
            const updated = await rows<MediaRow>('mediaAssets.updateLabelForUser', () => db
                .from('media_assets')
                .update({ label })
                .eq('id', id)
                .eq('user_id', userId)
                .select(COLUMNS));
            return updated[0] ? toAsset(updated[0]) : null;
        },

        async deleteForUser(id, userId) {
            const deleted = await rows<{ id: string }>('mediaAssets.deleteForUser', () => db
                .from('media_assets')
                .delete()
                .eq('id', id)
                .eq('user_id', userId)
                .select('id'));
            return deleted.length > 0;
        },
    };
}
