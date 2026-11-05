import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createMediaService } from '../../services/mediaService.ts';
import { NotConfiguredError, NotFoundError, UpstreamError, ValidationError } from '../../lib/errors.ts';
import { readConfig } from '../../lib/config.ts';
import { createLogger } from '../../lib/logger.ts';
import type { AuditRepository } from '../../repositories/auditRepository.ts';
import type { MediaAssetRepository, NewMediaAsset, StoredMediaAsset } from '../../repositories/mediaAssetRepository.ts';
import type { Env } from '../../types/env.ts';

const CONTEXT = { requestId: 'req-test', signal: new AbortController().signal, log: createLogger() };
const WITH_CLOUDINARY = { CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_UPLOAD_PRESET: 'unsigned' } as Env;
const WITH_SECRET = { ...WITH_CLOUDINARY, CLOUDINARY_API_KEY: 'KEY', CLOUDINARY_API_SECRET: 'SECRET' } as Env;
const UPLOADED = 'https://res.cloudinary.com/demo/video/upload/v1730000000/folder/clip-abc.mp4';

// an in-memory table with the same ownership rule as the repository: every lookup needs the user id
function memory() {
    const rows: (StoredMediaAsset & { userId: string })[] = [];
    const audits: string[] = [];
    const media: MediaAssetRepository = {
        async createForUser(userId, asset: NewMediaAsset) {
            const row = { ...asset, id: `m${rows.length + 1}`, createdAt: '2026-11-05T00:00:00Z', userId };
            rows.push(row);
            return row;
        },
        listForUser: async userId => rows.filter(row => row.userId === userId),
        findForUser: async (id, userId) => rows.find(row => row.id === id && row.userId === userId) ?? null,
        findByPublicIdForUser: async (publicId, userId) => rows.find(row => row.publicId === publicId && row.userId === userId) ?? null,
        async updateLabelForUser(id, userId, label) {
            const row = rows.find(item => item.id === id && item.userId === userId);
            if (row) row.label = label;
            return row ?? null;
        },
        async deleteForUser(id, userId) {
            const index = rows.findIndex(row => row.id === id && row.userId === userId);
            if (index >= 0) rows.splice(index, 1);
            return index >= 0;
        },
    };
    const audit = { recordForUser: async (_userId: string, event: { action: string }) => { audits.push(event.action); } } as unknown as AuditRepository;
    return { rows, audits, media, audit };
}

function cloudinaryAnswers(t: { after(fn: () => void): void }, ...answers: unknown[]) {
    const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json(answers.shift()));
    t.after(() => fetchMock.mock.restore());
    return fetchMock;
}

test('an import keeps Cloudinary\'s details for the caller and never shows the Cloudinary id', async t => {
    cloudinaryAnswers(t, {
        public_id: 'cld-1', secure_url: 'https://res.cloudinary.com/demo/video/upload/cld-1.mp4', resource_type: 'video',
        format: 'mp4', bytes: 2048, width: 1080, height: 1920, duration: 12.5,
    });
    const { media, audit, audits } = memory();
    const service = createMediaService({ media, audit, config: readConfig(WITH_CLOUDINARY), context: CONTEXT });
    const imported = await service.importFromUrl('user-1', { url: 'https://example.com/clip.mp4', resourceType: 'video', label: 'Clip' });
    assert.equal(imported.url, 'https://res.cloudinary.com/demo/video/upload/cld-1.mp4');
    assert.equal(imported.durationSeconds, 12.5);
    assert.equal('publicId' in imported, false);
    assert.deepEqual(audits, ['media_asset.imported']);
    assert.equal((await service.list('user-2')).length, 0);
    await assert.rejects(service.updateLabel('user-2', imported.id, 'Mine now'), NotFoundError);
});

test('a file Cloudinary stored as another type is refused, and an instance without Cloudinary says so', async t => {
    cloudinaryAnswers(t, { public_id: 'x', secure_url: 'https://res.cloudinary.com/x', resource_type: 'raw' });
    const { media, audit } = memory();
    const service = createMediaService({ media, audit, config: readConfig(WITH_CLOUDINARY), context: CONTEXT });
    await assert.rejects(service.importFromUrl('user-1', { url: 'https://example.com/a.jpg', resourceType: 'image', label: '' }), UpstreamError);
    const unset = createMediaService({ media, audit, config: readConfig({} as Env), context: CONTEXT });
    await assert.rejects(unset.importFromUrl('user-1', { url: 'https://example.com/a.jpg', resourceType: 'image', label: '' }), NotConfiguredError);
});

test('without the API secret a delete removes only the record and says so; with it the file goes from Cloudinary first', async t => {
    const fetchMock = cloudinaryAnswers(t,
        { public_id: 'a', secure_url: 'https://res.cloudinary.com/demo/image/upload/a.jpg', resource_type: 'image' },
        { public_id: 'b', secure_url: 'https://res.cloudinary.com/demo/image/upload/b.jpg', resource_type: 'image' },
        { result: 'ok' });
    const { media, audit, rows } = memory();
    const plain = createMediaService({ media, audit, config: readConfig(WITH_CLOUDINARY), context: CONTEXT });
    const first = await plain.importFromUrl('user-1', { url: 'https://example.com/a.jpg', resourceType: 'image', label: '' });
    const second = await plain.importFromUrl('user-1', { url: 'https://example.com/b.jpg', resourceType: 'image', label: '' });
    assert.deepEqual(await plain.remove('user-1', first.id), { removedFromCloudinary: false, fileKept: 'no_api_secret' });
    assert.equal(fetchMock.mock.callCount(), 2);
    const admin = createMediaService({ media, audit, config: readConfig(WITH_SECRET), context: CONTEXT });
    await assert.rejects(admin.remove('user-2', second.id), NotFoundError);
    assert.deepEqual(await admin.remove('user-1', second.id), { removedFromCloudinary: true, fileKept: null });
    assert.match(String(fetchMock.mock.calls[2].arguments[0]), /\/demo\/image\/destroy$/);
    assert.equal(rows.length, 0);
});

test('a browser upload is added only at the exact address Cloudinary gives its id, and deleting it never deletes the file', async t => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => new Response(null, { status: 200, headers: { 'Content-Length': '4096' } }));
    t.after(() => fetchMock.mock.restore());
    const { media, audit } = memory();
    const service = createMediaService({ media, audit, config: readConfig(WITH_SECRET), context: CONTEXT });
    const upload = { url: UPLOADED, publicId: 'folder/clip-abc', resourceType: 'video' as const, format: 'mp4', width: 1080, height: 1920, durationSeconds: 9, label: '' };
    for (const publicId of ['clip-abc', 'folder/clip', 'folder']) {
        await assert.rejects(service.registerUpload('user-2', { ...upload, publicId }), ValidationError);
    }
    await assert.rejects(service.registerUpload('user-2', { ...upload, url: 'https://res.cloudinary.com/other/video/upload/v1/folder/clip-abc.mp4' }), ValidationError);
    assert.equal(fetchMock.mock.callCount(), 0);
    const registered = await service.registerUpload('user-2', upload);
    assert.equal(registered.bytes, 4096);
    assert.deepEqual(await service.remove('user-2', registered.id), { removedFromCloudinary: false, fileKept: 'not_created_by_twiligent' });
    assert.equal(fetchMock.mock.callCount(), 1);
});

test('an import that landed on a file Cloudinary already had is never deleted from Cloudinary', async t => {
    const fetchMock = cloudinaryAnswers(t, { public_id: 'shared', secure_url: 'https://res.cloudinary.com/demo/image/upload/shared.jpg', resource_type: 'image', existing: true });
    const { media, audit } = memory();
    const service = createMediaService({ media, audit, config: readConfig(WITH_SECRET), context: CONTEXT });
    const imported = await service.importFromUrl('user-1', { url: 'https://example.com/shared.jpg', resourceType: 'image', label: '' });
    assert.deepEqual(await service.remove('user-1', imported.id), { removedFromCloudinary: false, fileKept: 'not_created_by_twiligent' });
    assert.equal(fetchMock.mock.callCount(), 1);
});
