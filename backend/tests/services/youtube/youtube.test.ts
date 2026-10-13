import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveChannelId } from '../../../services/youtube/youtubeChannels.ts';
import { fetchTrackedYouTubeData } from '../../../services/youtube/youtubeTracked.ts';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function lookupName({ pathname, searchParams }: URL) {
    if (searchParams.get('forHandle')) return 'forHandle';
    if (searchParams.get('forUsername')) return 'forUsername';
    return pathname.split('/').pop();
}

// answers each youtube endpoint from a table and records the calls
function fakeYouTube(responses: Record<string, unknown>) {
    const calls: (string | undefined)[] = [];
    globalThis.fetch = async (url: unknown): Promise<Response> => {
        const lookup = lookupName(new URL(url as string));
        calls.push(lookup);
        const body = responses[lookup as string] ?? { items: [] };
        if (body instanceof Error) throw body;
        return { json: async () => body } as unknown as Response;
    };
    return calls;
}

test('a channel id is returned without calling the api', async () => {
    const calls = fakeYouTube({});
    assert.equal(await resolveChannelId('UCabcdefghijklmnopqrstuv', 'key'), 'UCabcdefghijklmnopqrstuv');
    assert.deepEqual(calls, []);
});

test('a handle resolves through forHandle first', async () => {
    const calls = fakeYouTube({ forHandle: { items: [{ id: 'UC_handle' }] } });
    assert.equal(await resolveChannelId('https://youtube.com/@creator', 'key'), 'UC_handle');
    assert.deepEqual(calls, ['forHandle']);
});

test('lookups fall through in order when earlier ones find nothing or fail', async () => {
    const calls = fakeYouTube({
        forHandle: new Error('network down'),
        forUsername: { error: { message: 'quota exceeded' } },
        search: { items: [{ snippet: { channelId: 'UC_search' } }] },
    });
    assert.equal(await resolveChannelId('creator', 'key'), 'UC_search');
    assert.deepEqual(calls, ['forHandle', 'forUsername', 'search']);
});

test('a search result without a snippet counts as not found', async () => {
    fakeYouTube({ search: { items: [{}] } });
    await assert.rejects(resolveChannelId('creator', 'key'), /Could not resolve channel/);
});

test('an unparseable video link is rejected before any api call', async () => {
    const calls = fakeYouTube({});
    await assert.rejects(fetchTrackedYouTubeData('not a url', 'key'), /could not extract video ID/);
    await assert.rejects(fetchTrackedYouTubeData('https://example.com/watch?v=abc', 'key'), /could not extract video ID/);
    assert.deepEqual(calls, []);
});

test('watch, short, embed and youtu.be links all reach the api with the video id', async () => {
    const ids: (string | null)[] = [];
    globalThis.fetch = async (url: unknown): Promise<Response> => {
        ids.push(new URL(url as string).searchParams.get('id'));
        return { json: async () => ({ items: [] }) } as unknown as Response;
    };
    const links = [
        'https://www.youtube.com/watch?v=aaa',
        'https://youtube.com/shorts/bbb',
        'https://www.youtube.com/embed/ccc',
        'https://youtu.be/ddd?t=10',
    ];
    for (const link of links) {
        await assert.rejects(fetchTrackedYouTubeData(link, 'key'), /video not found/);
    }
    assert.deepEqual(ids, ['aaa', 'bbb', 'ccc', 'ddd']);
});
