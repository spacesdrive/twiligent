import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEDIA_TOOLS, deleteMedia, importMediaFromUrl, listMedia, registerMedia, startMediaUpload, updateMedia } from '../../mcp/tools/mediaTools.ts';
import { ValidationError } from '../../lib/errors.ts';
import type { Services } from '../../container.ts';
import type { ToolContext } from '../../mcp/tool.ts';
import type { MediaService } from '../../services/mediaService.ts';
import type { MediaAsset } from '../../../shared/types/media.ts';
import type { MediaRegistration } from '../../validators/mediaValidators.ts';

function asset(id: string): MediaAsset {
    return { id, resourceType: 'image', url: `https://res.cloudinary.com/demo/image/upload/${id}.jpg`, format: 'jpg', bytes: 1, width: 1, height: 1, durationSeconds: null, label: '', createdAt: '2026-11-05T00:00:00Z' };
}

function context(canDelete: boolean): ToolContext & { removed: string[] } {
    const removed: string[] = [];
    const media: Pick<MediaService, 'list' | 'remove'> = {
        list: async userId => (userId === 'user-1' ? [asset('a'), asset('b'), asset('c')] : []),
        async remove(_userId, id) {
            removed.push(id);
            return { removedFromCloudinary: canDelete, fileKept: canDelete ? null : 'no_api_secret' };
        },
    };
    return { services: { media } as unknown as Services, principal: { userId: 'user-1', permission: 'write', via: 'token:t1' }, removed };
}

test('only listing is a read tool, and only deleting asks for a confirmation', () => {
    assert.deepEqual(MEDIA_TOOLS.map(tool => [tool.name, tool.permission]), [
        ['list_media', 'read'], ['import_media_from_url', 'write'], ['start_media_upload', 'write'], ['register_media', 'write'],
        ['update_media', 'write'], ['delete_media', 'write'],
    ]);
    assert.equal(startMediaUpload.needsConfirmation, undefined);
    assert.equal(registerMedia.needsConfirmation, undefined);
    assert.equal(deleteMedia.needsConfirmation?.({ mediaId: 'a' }), true);
    assert.equal(importMediaFromUrl.needsConfirmation, undefined);
    assert.equal(updateMedia.annotations.destructiveHint, false);
});

test('an upload from the computer goes to this instance\'s cloud with its upload preset, then joins the caller\'s media', async () => {
    const registered: [string, MediaRegistration][] = [];
    const services = {
        publishing: { cloudinaryConfig: () => ({ cloudName: 'demo', uploadPreset: 'twiligent' }) },
        media: {
            async registerUpload(userId: string, upload: MediaRegistration) {
                registered.push([userId, upload]);
                return { ...asset('v'), resourceType: 'video' };
            },
        },
    } as unknown as Services;
    const ctx: ToolContext = { services, principal: { userId: 'user-1', permission: 'write', via: 'token:t1' } };
    const target = await startMediaUpload.run(startMediaUpload.parse({ resourceType: 'video' }), ctx);
    assert.deepEqual(target, {
        uploadUrl: 'https://api.cloudinary.com/v1_1/demo/video/upload', fileField: 'file', fields: { upload_preset: 'twiligent' },
        next: 'Call register_media with resourceType and Cloudinary\'s public_id, secure_url, format, width, height and duration.',
    });
    assert.throws(() => startMediaUpload.parse({ resourceType: 'raw' }), ValidationError);

    const url = 'https://res.cloudinary.com/demo/video/upload/v1/clip.mp4';
    await registerMedia.run(registerMedia.parse({ publicId: 'clip', url, resourceType: 'video', format: 'mp4', width: 1080, height: 1920, durationSeconds: 30, label: 'Reel 1' }), ctx);
    assert.deepEqual(registered[0][0], 'user-1');
    assert.deepEqual(registered[0][1], { url, publicId: 'clip', resourceType: 'video', format: 'mp4', width: 1080, height: 1920, durationSeconds: 30, label: 'Reel 1' });
    assert.throws(() => registerMedia.parse({ url, resourceType: 'video' }), /publicId is required/);
});

test('listing pages through the caller\'s media', async () => {
    const page = await listMedia.run(listMedia.parse({ limit: 2 }), context(false)) as { media: MediaAsset[]; nextCursor: string; total: number };
    assert.deepEqual(page.media.map(item => item.id), ['a', 'b']);
    assert.equal(page.nextCursor, '2');
    assert.equal(page.total, 3);
});

test('a delete without the Cloudinary secret says the file is still on Cloudinary', async () => {
    const ctx = context(false);
    const result = await deleteMedia.run({ mediaId: 'a' }, ctx) as { removedFromCloudinary: boolean; note?: string };
    assert.deepEqual(ctx.removed, ['a']);
    assert.equal(result.removedFromCloudinary, false);
    assert.match(result.note ?? '', /still on Cloudinary/);
    const full = await deleteMedia.run({ mediaId: 'b' }, context(true)) as { note?: string };
    assert.equal(full.note, undefined);
});

test('imports refuse anything but a public https address before calling the service', () => {
    assert.throws(() => importMediaFromUrl.parse({ url: 'http://example.com/a.jpg', resourceType: 'image' }), ValidationError);
    assert.throws(() => updateMedia.parse({ label: 'x' }), ValidationError);
});
