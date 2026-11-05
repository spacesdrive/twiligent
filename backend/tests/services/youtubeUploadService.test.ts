import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createYouTubeUploadService } from '../../services/youtubeUploadService.ts';
import { NotFoundError, ValidationError } from '../../lib/errors.ts';
import { readConfig } from '../../lib/config.ts';
import type { NewYouTubeUpload, StoredYouTubeUpload, UploadEdit, UploadProgress, YouTubeUploadRepository } from '../../repositories/youtubeUploadRepository.ts';
import type { YouTubeConnectionRepository } from '../../repositories/youtubeConnectionRepository.ts';
import type { MediaAssetRepository, StoredMediaAsset } from '../../repositories/mediaAssetRepository.ts';
import type { AuditRepository } from '../../repositories/auditRepository.ts';
import type { YouTubeUploadRequest, YouTubeUploadState } from '../../../shared/types/youtubePublishing.ts';
import type { Env } from '../../types/env.ts';

const ENV = { GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'secret', TOKEN_ENCRYPTION_KEY: 'k'.repeat(48) } as Env;

const VIDEO: StoredMediaAsset = {
    id: 'm-video', publicId: 'v', resourceType: 'video', url: 'https://res.cloudinary.com/demo/video/upload/v.mp4', format: 'mp4',
    bytes: 1000, width: 1080, height: 1920, durationSeconds: 45, label: '', createdAt: '',
};
const IMAGE: StoredMediaAsset = { ...VIDEO, id: 'm-image', resourceType: 'image', url: 'https://res.cloudinary.com/demo/image/upload/t.jpg', format: 'jpg', bytes: 5000 };

function memory() {
    const rows: (StoredYouTubeUpload & { clientRequestId: string | null; lease: boolean })[] = [];
    const uploads = {
        async createForUser(userId: string, upload: NewYouTubeUpload) {
            const existing = rows.find(row => row.userId === userId && upload.clientRequestId && row.clientRequestId === upload.clientRequestId);
            if (existing) return { upload: existing, existing: true };
            const row = {
                ...upload, id: `u${rows.length + 1}`, userId, hasThumbnail: upload.thumbnailUrl !== null, state: 'queued' as YouTubeUploadState,
                bytesConfirmed: 0, videoId: null, attempts: 0, nextAttemptAt: '', lastError: null, createdAt: '', updatedAt: '', sessionUri: null, lease: false,
            };
            rows.push(row);
            return { upload: row, existing: false };
        },
        listForUser: async (userId: string) => rows.filter(row => row.userId === userId),
        findForUser: async (id: string, userId: string) => rows.find(row => row.id === id && row.userId === userId) ?? null,
        async editQueuedForUser(id: string, userId: string, edit: UploadEdit) {
            const row = rows.find(item => item.id === id && item.userId === userId && item.state === 'queued' && item.sessionUri === null && !item.lease);
            if (row) Object.assign(row, edit);
            return row ?? null;
        },
        async setStateForUser(id: string, userId: string, from: YouTubeUploadState[], to: YouTubeUploadState, extra: UploadProgress = {}) {
            const row = rows.find(item => item.id === id && item.userId === userId && from.includes(item.state) && !item.lease);
            if (row) Object.assign(row, extra, { state: to });
            return row ?? null;
        },
    } as unknown as YouTubeUploadRepository;
    const connections = { findForUser: async (id: string, userId: string) => (id === 'conn-1' && userId === 'user-1' ? { id: 'conn-1' } : null) } as unknown as YouTubeConnectionRepository;
    const media = { findForUser: async (id: string, userId: string) => (userId !== 'user-1' ? null : id === VIDEO.id ? VIDEO : id === IMAGE.id ? IMAGE : null) } as unknown as MediaAssetRepository;
    const audit = { recordForUser: async () => undefined } as unknown as AuditRepository;
    return { rows, service: createYouTubeUploadService({ uploads, connections, media, audit, config: readConfig(ENV) }) };
}

const REQUEST: YouTubeUploadRequest = { connectionId: 'conn-1', mediaId: 'm-video', title: 'Launch day', privacy: 'private', madeForKids: false };

test('a queued upload takes its source from the person\'s own media and knows a vertical clip is a Short', async () => {
    const { service } = memory();
    const { upload, existing } = await service.create('user-1', { ...REQUEST, thumbnailMediaId: 'm-image' });
    assert.equal(existing, false);
    assert.equal(upload.isShort, true);
    assert.equal(upload.hasThumbnail, true);
    assert.equal(upload.sourceBytes, 1000);
    assert.equal('sourceUrl' in upload, false);
    assert.equal('sessionUri' in upload, false);
});

test('another person\'s channel or media is not found, and metadata outside YouTube\'s limits is refused', async () => {
    const { service } = memory();
    await assert.rejects(service.create('user-2', REQUEST), NotFoundError);
    await assert.rejects(service.create('user-1', { ...REQUEST, mediaId: 'm-image' }), NotFoundError);
    await assert.rejects(service.create('user-1', { ...REQUEST, title: 'x'.repeat(101) }), ValidationError);
});

test('the same request id twice queues the video once', async () => {
    const { rows, service } = memory();
    const first = await service.create('user-1', { ...REQUEST, clientRequestId: 'req-1' });
    const second = await service.create('user-1', { ...REQUEST, clientRequestId: 'req-1' });
    assert.equal(second.existing, true);
    assert.equal(second.upload.id, first.upload.id);
    assert.equal(rows.length, 1);
});

test('details change only before the upload starts, and a publish time needs a private video', async () => {
    const { rows, service } = memory();
    const { upload } = await service.create('user-1', REQUEST);
    assert.equal((await service.update('user-1', upload.id, { title: 'Better title' })).title, 'Better title');
    await assert.rejects(service.update('user-1', upload.id, { privacy: 'public', publishAt: '2030-01-01T00:00:00Z' }), /must be private/);
    rows[0].sessionUri = 'https://upload.example/session';
    await assert.rejects(service.update('user-1', upload.id, { title: 'Too late' }), /has started/);
});

test('a job can be cancelled until YouTube has the video, and only a failed one is retried, from a fresh session', async () => {
    const { rows, service } = memory();
    const { upload } = await service.create('user-1', REQUEST);
    rows[0].state = 'processing';
    await assert.rejects(service.cancel('user-1', upload.id), /cannot be cancelled now/);
    rows[0].state = 'failed';
    rows[0].sessionUri = 'https://upload.example/old';
    const retried = await service.retry('user-1', upload.id);
    assert.equal(retried.state, 'queued');
    assert.equal(rows[0].sessionUri, null);
    assert.equal(rows[0].attempts, 0);
    assert.equal((await service.cancel('user-1', upload.id)).state, 'cancelled');
    await assert.rejects(service.retry('user-1', upload.id), /Only a failed upload/);
});
