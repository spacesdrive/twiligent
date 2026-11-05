import { execute, maybeRow, rows } from './query.ts';
import { newRowId } from '../lib/ids.ts';
import { isUniqueViolation } from '../lib/errors.ts';
import type { SupabaseClient } from '../types/app.ts';
import type { YouTubePrivacy, YouTubeUploadState, YouTubeUploadSummary } from '../../shared/types/youtubePublishing.ts';

interface UploadRow {
    id: string;
    user_id: string;
    connection_id: string;
    source_url: string;
    source_bytes: number | string;
    content_type: string;
    thumbnail_url: string | null;
    is_short: boolean;
    title: string;
    description: string;
    tags: string[];
    category_id: string;
    privacy: YouTubePrivacy;
    publish_at: string | null;
    made_for_kids: boolean;
    synthetic_media: boolean;
    notify_subscribers: boolean;
    state: YouTubeUploadState;
    session_uri: string | null;
    bytes_confirmed: number | string;
    video_id: string | null;
    attempts: number;
    next_attempt_at: string;
    lease_owner: string | null;
    last_error: string | null;
    created_at: string;
    updated_at: string;
}

// the job as the runner sees it: the source address and session never leave the Worker
export interface StoredYouTubeUpload extends YouTubeUploadSummary {
    userId: string;
    sourceUrl: string;
    contentType: string;
    thumbnailUrl: string | null;
    sessionUri: string | null;
}

export interface NewYouTubeUpload {
    connectionId: string;
    sourceUrl: string;
    sourceBytes: number;
    contentType: string;
    thumbnailUrl: string | null;
    isShort: boolean;
    title: string;
    description: string;
    tags: string[];
    categoryId: string;
    privacy: YouTubePrivacy;
    publishAt: string | null;
    madeForKids: boolean;
    syntheticMedia: boolean;
    notifySubscribers: boolean;
    clientRequestId: string | null;
}

// what the runner may change on a job it holds
export interface UploadProgress {
    state?: YouTubeUploadState;
    sessionUri?: string | null;
    bytesConfirmed?: number;
    videoId?: string;
    attempts?: number;
    nextAttemptAt?: string;
    lastError?: string | null;
}

// the metadata a person may change before the upload starts
export type UploadEdit = Partial<Pick<NewYouTubeUpload, 'title' | 'description' | 'tags' | 'categoryId' | 'privacy' | 'publishAt' | 'madeForKids' | 'syntheticMedia' | 'notifySubscribers'>>;

const COLUMNS = 'id, user_id, connection_id, source_url, source_bytes, content_type, thumbnail_url, is_short, title, description, tags, category_id, privacy, publish_at, made_for_kids, synthetic_media, notify_subscribers, state, session_uri, bytes_confirmed, video_id, attempts, next_attempt_at, lease_owner, last_error, created_at, updated_at';

function toUpload(row: UploadRow): StoredYouTubeUpload {
    return {
        id: row.id,
        userId: row.user_id,
        connectionId: row.connection_id,
        title: row.title,
        description: row.description,
        tags: row.tags ?? [],
        categoryId: row.category_id,
        privacy: row.privacy,
        publishAt: row.publish_at,
        madeForKids: row.made_for_kids,
        syntheticMedia: row.synthetic_media,
        notifySubscribers: row.notify_subscribers,
        isShort: row.is_short,
        hasThumbnail: row.thumbnail_url !== null,
        state: row.state,
        bytesConfirmed: Number(row.bytes_confirmed),
        sourceBytes: Number(row.source_bytes),
        videoId: row.video_id,
        attempts: row.attempts,
        nextAttemptAt: row.next_attempt_at,
        lastError: row.last_error,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        sourceUrl: row.source_url,
        contentType: row.content_type,
        thumbnailUrl: row.thumbnail_url,
        sessionUri: row.session_uri,
    };
}

export function uploadSummary(upload: StoredYouTubeUpload): YouTubeUploadSummary {
    const { userId: _userId, sourceUrl: _sourceUrl, contentType: _contentType, thumbnailUrl: _thumbnailUrl, sessionUri: _sessionUri, ...summary } = upload;
    return summary;
}

function editColumns(edit: UploadEdit): Record<string, unknown> {
    const columns: Record<string, unknown> = {};
    if (edit.title !== undefined) columns.title = edit.title;
    if (edit.description !== undefined) columns.description = edit.description;
    if (edit.tags !== undefined) columns.tags = edit.tags;
    if (edit.categoryId !== undefined) columns.category_id = edit.categoryId;
    if (edit.privacy !== undefined) columns.privacy = edit.privacy;
    if (edit.publishAt !== undefined) columns.publish_at = edit.publishAt;
    if (edit.madeForKids !== undefined) columns.made_for_kids = edit.madeForKids;
    if (edit.syntheticMedia !== undefined) columns.synthetic_media = edit.syntheticMedia;
    if (edit.notifySubscribers !== undefined) columns.notify_subscribers = edit.notifySubscribers;
    return columns;
}

function progressColumns(progress: UploadProgress): Record<string, unknown> {
    const columns: Record<string, unknown> = {};
    if (progress.state !== undefined) columns.state = progress.state;
    if (progress.sessionUri !== undefined) columns.session_uri = progress.sessionUri;
    if (progress.bytesConfirmed !== undefined) columns.bytes_confirmed = progress.bytesConfirmed;
    if (progress.videoId !== undefined) columns.video_id = progress.videoId;
    if (progress.attempts !== undefined) columns.attempts = progress.attempts;
    if (progress.nextAttemptAt !== undefined) columns.next_attempt_at = progress.nextAttemptAt;
    if (progress.lastError !== undefined) columns.last_error = progress.lastError;
    return columns;
}

// ...ForUser methods filter by the verified user; claim, saveLeased, releaseLeased and parkForConnection serve the runner
export interface YouTubeUploadRepository {
    createForUser(userId: string, upload: NewYouTubeUpload): Promise<{ upload: StoredYouTubeUpload; existing: boolean }>;
    listForUser(userId: string): Promise<StoredYouTubeUpload[]>;
    findForUser(id: string, userId: string): Promise<StoredYouTubeUpload | null>;
    // only a queued job that has not opened an upload session can change; null when it is gone or already started
    editQueuedForUser(id: string, userId: string, edit: UploadEdit): Promise<StoredYouTubeUpload | null>;
    // moves a job between states only from the ones listed, so a running job is never pulled from under a run
    setStateForUser(id: string, userId: string, from: YouTubeUploadState[], to: YouTubeUploadState, extra?: UploadProgress): Promise<StoredYouTubeUpload | null>;
    claim(owner: string, leaseSeconds: number): Promise<StoredYouTubeUpload | null>;
    // false when the lease was lost to another run; the caller then stops touching the job
    saveLeased(id: string, owner: string, progress: UploadProgress): Promise<boolean>;
    releaseLeased(id: string, owner: string, progress: UploadProgress): Promise<void>;
    parkForConnection(connectionId: string, lastError: string): Promise<void>;
}

const RUNNABLE: YouTubeUploadState[] = ['queued', 'uploading', 'processing', 'finalizing', 'waiting_quota'];

export function createYouTubeUploadRepository(db: SupabaseClient): YouTubeUploadRepository {
    async function findByRequestForUser(clientRequestId: string, userId: string): Promise<StoredYouTubeUpload | null> {
        const row = await maybeRow<UploadRow>('youtubeUploads.findByRequest', () => db
            .from('youtube_uploads').select(COLUMNS).eq('client_request_id', clientRequestId).eq('user_id', userId).maybeSingle());
        return row ? toUpload(row) : null;
    }

    return {
        async createForUser(userId, upload) {
            try {
                const created = await rows<UploadRow>('youtubeUploads.create', () => db.from('youtube_uploads').insert({
                    id: newRowId(),
                    user_id: userId,
                    connection_id: upload.connectionId,
                    source_url: upload.sourceUrl,
                    source_bytes: upload.sourceBytes,
                    content_type: upload.contentType,
                    thumbnail_url: upload.thumbnailUrl,
                    is_short: upload.isShort,
                    title: upload.title,
                    description: upload.description,
                    tags: upload.tags,
                    category_id: upload.categoryId,
                    privacy: upload.privacy,
                    publish_at: upload.publishAt,
                    made_for_kids: upload.madeForKids,
                    synthetic_media: upload.syntheticMedia,
                    notify_subscribers: upload.notifySubscribers,
                    client_request_id: upload.clientRequestId,
                }).select(COLUMNS));
                return { upload: toUpload(created[0]), existing: false };
            } catch (err) {
                // the same request sent twice: the first job stands
                const existing = upload.clientRequestId && isUniqueViolation(err) ? await findByRequestForUser(upload.clientRequestId, userId) : null;
                if (!existing) throw err;
                return { upload: existing, existing: true };
            }
        },

        async listForUser(userId) {
            const found = await rows<UploadRow>('youtubeUploads.listForUser', () => db
                .from('youtube_uploads').select(COLUMNS).eq('user_id', userId).order('created_at', { ascending: false }).limit(200));
            return found.map(toUpload);
        },

        async findForUser(id, userId) {
            const row = await maybeRow<UploadRow>('youtubeUploads.findForUser', () => db
                .from('youtube_uploads').select(COLUMNS).eq('id', id).eq('user_id', userId).maybeSingle());
            return row ? toUpload(row) : null;
        },

        async editQueuedForUser(id, userId, edit) {
            const updated = await rows<UploadRow>('youtubeUploads.editQueued', () => db
                .from('youtube_uploads').update(editColumns(edit))
                .eq('id', id).eq('user_id', userId).eq('state', 'queued').is('session_uri', null).is('lease_owner', null)
                .select(COLUMNS));
            return updated[0] ? toUpload(updated[0]) : null;
        },

        async setStateForUser(id, userId, from, to, extra = {}) {
            const updated = await rows<UploadRow>('youtubeUploads.setState', () => db
                .from('youtube_uploads').update({ ...progressColumns(extra), state: to })
                .eq('id', id).eq('user_id', userId).in('state', from).is('lease_owner', null)
                .select(COLUMNS));
            return updated[0] ? toUpload(updated[0]) : null;
        },

        async claim(owner, leaseSeconds) {
            const { data } = await execute('youtubeUploads.claim', () => db.rpc('claim_youtube_upload', { p_owner: owner, p_lease_seconds: leaseSeconds }));
            const claimed = (data as UploadRow[] | null) ?? [];
            return claimed[0] ? toUpload(claimed[0]) : null;
        },

        async saveLeased(id, owner, progress) {
            const updated = await rows<{ id: string }>('youtubeUploads.saveLeased', () => db
                .from('youtube_uploads').update(progressColumns(progress)).eq('id', id).eq('lease_owner', owner).select('id'));
            return updated.length > 0;
        },

        async releaseLeased(id, owner, progress) {
            await execute('youtubeUploads.releaseLeased', () => db
                .from('youtube_uploads').update({ ...progressColumns(progress), lease_owner: null, lease_until: null }).eq('id', id).eq('lease_owner', owner));
        },

        // a connection that needs a new sign-in holds its jobs without spending their attempts
        async parkForConnection(connectionId, lastError) {
            await execute('youtubeUploads.parkForConnection', () => db
                .from('youtube_uploads').update({ state: 'needs_reconnect', last_error: lastError })
                .eq('connection_id', connectionId).in('state', RUNNABLE).is('lease_owner', null));
        },
    };
}
