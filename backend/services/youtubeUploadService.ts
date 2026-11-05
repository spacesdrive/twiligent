import { isShort, metadataProblem } from '../lib/youtubeUpload.ts';
import { NotConfiguredError, NotFoundError, ValidationError } from '../lib/errors.ts';
import { uploadSummary } from '../repositories/youtubeUploadRepository.ts';
import type { StoredYouTubeUpload, UploadEdit, YouTubeUploadRepository } from '../repositories/youtubeUploadRepository.ts';
import type { YouTubeConnectionRepository } from '../repositories/youtubeConnectionRepository.ts';
import type { MediaAssetRepository } from '../repositories/mediaAssetRepository.ts';
import type { AuditRepository } from '../repositories/auditRepository.ts';
import type { AppConfig } from '../lib/config.ts';
import type { YouTubeUploadRequest, YouTubeUploadState, YouTubeUploadSummary, YouTubeUploadUpdateRequest } from '../../shared/types/youtubePublishing.ts';

export interface YouTubeUploadDeps {
    uploads: YouTubeUploadRepository;
    connections: YouTubeConnectionRepository;
    media: MediaAssetRepository;
    audit: AuditRepository;
    config: AppConfig;
}

export interface YouTubeUploadService {
    list(userId: string): Promise<YouTubeUploadSummary[]>;
    get(userId: string, id: string): Promise<YouTubeUploadSummary>;
    create(userId: string, request: YouTubeUploadRequest): Promise<{ upload: YouTubeUploadSummary; existing: boolean }>;
    update(userId: string, id: string, edit: YouTubeUploadUpdateRequest): Promise<YouTubeUploadSummary>;
    cancel(userId: string, id: string): Promise<YouTubeUploadSummary>;
    retry(userId: string, id: string): Promise<YouTubeUploadSummary>;
}

// a job can be stopped until YouTube holds a finished video; after that the video is on the channel and is managed there
const CANCELLABLE: YouTubeUploadState[] = ['queued', 'uploading', 'waiting_quota', 'needs_reconnect', 'failed', 'needs_review'];
const RETRYABLE: YouTubeUploadState[] = ['failed', 'needs_review'];
// YouTube takes custom thumbnails as JPEG or PNG up to 2 MB
const THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024;
const NOT_FOUND = 'No YouTube upload with that id.';

function contentTypeOf(format: string | null): string {
    const known: Record<string, string> = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', avi: 'video/x-msvideo', mkv: 'video/x-matroska' };
    return (format && known[format.toLowerCase()]) || 'application/octet-stream';
}

export function createYouTubeUploadService({ uploads, connections, media, audit, config }: YouTubeUploadDeps): YouTubeUploadService {
    async function findOwned(userId: string, id: string): Promise<StoredYouTubeUpload> {
        const upload = await uploads.findForUser(id, userId);
        if (!upload) throw new NotFoundError(NOT_FOUND);
        return upload;
    }

    return {
        list: async userId => (await uploads.listForUser(userId)).map(uploadSummary),
        get: async (userId, id) => uploadSummary(await findOwned(userId, id)),

        async create(userId, request) {
            if (!config.youtubeOAuth) throw new NotConfiguredError('YouTube publishing is not set up on this server.');
            const problem = metadataProblem({ title: request.title, description: request.description ?? '', tags: request.tags ?? [] });
            if (problem) throw new ValidationError(problem);
            const connection = await connections.findForUser(request.connectionId, userId);
            if (!connection) throw new NotFoundError('No YouTube channel verified for publishing with that id. Verify the channel on the Accounts page first.');
            const video = await media.findForUser(request.mediaId, userId);
            if (!video || video.resourceType !== 'video') throw new NotFoundError('No video with that id in your media.');
            if (!video.bytes) throw new ValidationError('The size of this video is unknown, so it cannot be uploaded in parts. Upload it again.');
            let thumbnailUrl: string | null = null;
            if (request.thumbnailMediaId) {
                const image = await media.findForUser(request.thumbnailMediaId, userId);
                if (!image || image.resourceType !== 'image') throw new NotFoundError('No image with that id in your media for the thumbnail.');
                if (image.bytes && image.bytes > THUMBNAIL_MAX_BYTES) throw new ValidationError('A YouTube thumbnail can be at most 2 MB.');
                thumbnailUrl = image.url;
            }
            const created = await uploads.createForUser(userId, {
                connectionId: connection.id,
                sourceUrl: video.url,
                sourceBytes: video.bytes,
                contentType: contentTypeOf(video.format),
                thumbnailUrl,
                isShort: isShort(video.width, video.height, video.durationSeconds),
                title: request.title,
                description: request.description ?? '',
                tags: request.tags ?? [],
                categoryId: request.categoryId ?? '22',
                privacy: request.privacy,
                publishAt: request.publishAt ?? null,
                madeForKids: request.madeForKids,
                syntheticMedia: request.syntheticMedia ?? false,
                notifySubscribers: request.notifySubscribers ?? true,
                clientRequestId: request.clientRequestId ?? null,
            });
            if (!created.existing) {
                await audit.recordForUser(userId, { action: 'youtube_upload.created', subjectType: 'youtube_upload', subjectId: created.upload.id, details: { privacy: request.privacy } });
            }
            return { upload: uploadSummary(created.upload), existing: created.existing };
        },

        async update(userId, id, edit) {
            const current = await findOwned(userId, id);
            const merged = { title: edit.title ?? current.title, description: edit.description ?? current.description, tags: edit.tags ?? current.tags };
            const problem = metadataProblem(merged);
            if (problem) throw new ValidationError(problem);
            const privacy = edit.privacy ?? current.privacy;
            const publishAt = edit.publishAt !== undefined ? edit.publishAt : current.publishAt;
            if (publishAt && privacy !== 'private') throw new ValidationError('A scheduled video must be private until it publishes. Choose private, or remove the publish time.');
            const updated = await uploads.editQueuedForUser(id, userId, edit as UploadEdit);
            if (!updated) throw new ValidationError('This upload has started, so its details can no longer change. Change them on YouTube Studio once it is done.');
            return uploadSummary(updated);
        },

        // an upload YouTube never finished leaves no video behind, so stopping it is clean
        async cancel(userId, id) {
            await findOwned(userId, id);
            const cancelled = await uploads.setStateForUser(id, userId, CANCELLABLE, 'cancelled');
            if (!cancelled) throw new ValidationError('This upload cannot be cancelled now: it is being worked on, or YouTube already has the video.');
            await audit.recordForUser(userId, { action: 'youtube_upload.cancelled', subjectType: 'youtube_upload', subjectId: id });
            return uploadSummary(cancelled);
        },

        async retry(userId, id) {
            await findOwned(userId, id);
            // a fresh session from byte 0: the old one is gone or ended in an error YouTube will not take back
            const queued = await uploads.setStateForUser(id, userId, RETRYABLE, 'queued', {
                attempts: 0, nextAttemptAt: new Date().toISOString(), lastError: null, sessionUri: null, bytesConfirmed: 0,
            });
            if (!queued) throw new ValidationError('Only a failed upload, or one waiting for your check, can be tried again.');
            return uploadSummary(queued);
        },
    };
}
