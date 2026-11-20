import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YOUTUBE_TOOLS, cancelYouTubeUpload, createYouTubeUpload, updateYouTubeUpload } from '../../mcp/tools/youtubeTools.ts';
import { ValidationError } from '../../lib/errors.ts';
import type { YouTubeUploadRequest, YouTubeUploadUpdateRequest } from '../../../shared/types/youtubePublishing.ts';

const BASE = { connectionId: 'conn-1', mediaId: 'm-1', title: 'Launch', privacy: 'private', madeForKids: false };

test('reading tools only read, and every tool that changes something needs write permission', () => {
    for (const tool of YOUTUBE_TOOLS) {
        const reads = tool.name.startsWith('list_') || tool.name.startsWith('get_');
        assert.equal(tool.permission, reads ? 'read' : 'write', tool.name);
    }
});

test('a private upload with no publish time needs no confirmation; anything that will show on the channel does', () => {
    assert.equal(createYouTubeUpload.needsConfirmation?.(createYouTubeUpload.parse(BASE)), false);
    for (const extra of [{ privacy: 'public' }, { privacy: 'unlisted' }, { publishAt: '2099-01-01T00:00:00Z' }]) {
        const input = createYouTubeUpload.parse({ ...BASE, ...extra });
        assert.equal(createYouTubeUpload.needsConfirmation?.(input), true, JSON.stringify(extra));
    }
    const shown = createYouTubeUpload.describe?.(createYouTubeUpload.parse({ ...BASE, privacy: 'public', description: 'Full text' })) ?? '';
    assert.match(shown, /Visibility: public\./);
    assert.match(shown, /Description: "Full text"\./);
    assert.equal(updateYouTubeUpload.needsConfirmation?.(updateYouTubeUpload.parse({ uploadId: 'u1', privacy: 'public' })), true);
    assert.equal(updateYouTubeUpload.needsConfirmation?.(updateYouTubeUpload.parse({ uploadId: 'u1', title: 'New' })), false);
    assert.equal(cancelYouTubeUpload.needsConfirmation?.({ uploadId: 'u1' }), true);
});

test('YouTube\'s required choices and limits are checked before anything is queued', () => {
    assert.throws(() => createYouTubeUpload.parse({ ...BASE, madeForKids: undefined }), /made for kids/);
    assert.throws(() => createYouTubeUpload.parse({ ...BASE, privacy: 'public', publishAt: '2099-01-01T00:00:00Z' }), /must be private/);
    assert.throws(() => createYouTubeUpload.parse({ ...BASE, sourceUrl: 'https://evil.example/x.mp4' }), ValidationError);
    assert.throws(() => updateYouTubeUpload.parse({ uploadId: 'u1' }), /at least one detail/);
});

test('the language of a video is a language tag, kept as given, and named in the confirmation', () => {
    const input = createYouTubeUpload.parse({ ...BASE, privacy: 'private', publishAt: '2099-01-01T00:00:00Z', language: 'en-US', syntheticMedia: false }) as YouTubeUploadRequest;
    assert.equal(input.language, 'en-US');
    assert.match(createYouTubeUpload.describe!(input), /Made or changed with AI: no\. Language: en-US\./);
    assert.equal((createYouTubeUpload.parse(BASE) as YouTubeUploadRequest).language, null);
    assert.throws(() => createYouTubeUpload.parse({ ...BASE, language: 'English (US)' }), /language tag/);
    assert.equal((updateYouTubeUpload.parse({ uploadId: 'u1', language: 'en-GB' }) as { changes: YouTubeUploadUpdateRequest }).changes.language, 'en-GB');
});
