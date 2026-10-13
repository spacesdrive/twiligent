// keeps node's experimental mock timer warning out of the captured console output
process.removeAllListeners('warning');

import { test, describe, before, after, beforeEach, afterEach, mock } from 'node:test';
import accountsRouter from '../../routes/accounts.ts';
import { assertGolden } from '../fixtures/golden.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import type { FetchMock, RecordedRequest } from '../fixtures/fakeFetch.ts';
import { fakeSupabase, accountRow } from '../fixtures/fakeSupabase.ts';
import type { SupabaseCall } from '../fixtures/fakeSupabase.ts';
import { mountWithContext, callRoute, fakeRedis } from '../fixtures/routeHarness.ts';
import type { RouteStep } from '../fixtures/routeHarness.ts';

// a byte order mark that pasted secrets sometimes start with
const BOM = String.fromCharCode(0xfeff);
const FIXED_NOW = Date.parse('2026-09-01T12:00:00Z');
const CHANNEL_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const CHANNEL_NEW = 'UCnnnnnnnnnnnnnnnnnnnnnn';
const ENV = { YOUTUBE_API_KEY: `${BOM} YTKEY \n`, INSTAGRAM_APP_SECRET: 'IGSECRET' };

const storedAccounts = [
    accountRow({ id: 'yt1', platform: 'youtube', channelId: CHANNEL_A, title: 'Old title', subscriberCount: 1 }),
    accountRow({ id: 'ig1', platform: 'instagram', igUserId: '1789', username: 'ribbon', accessToken: 'IGTOKEN', tokenExpiresAt: '2026-09-05T00:00:00.000Z', followersCount: 1 }),
    accountRow({ id: 'ig2', platform: 'instagram', igUserId: '2000', username: 'notoken' }),
    accountRow({ id: 'rd1', platform: 'reddit', username: 'ribbon_r', cookie: 'COOKIE', totalKarma: 1 }),
    accountRow({ id: 'rd2', platform: 'reddit', username: 'nocookie' }),
    accountRow({ id: 'yt2', platform: 'youtube', channelId: 'UCmissingmissingmissing0' }),
    accountRow({ id: 'other', platform: 'youtube', channelId: CHANNEL_NEW }, 'user-2'),
];

function channelBody(channelId: string) {
    if (channelId.startsWith('UCmissing')) return { items: [] };
    return {
        items: [{
            id: channelId,
            snippet: { title: `Channel ${channelId.slice(0, 4)}`, description: 'Desc', customUrl: '@chan', publishedAt: '2020-01-01T00:00:00Z', country: 'GB', thumbnails: { default: { url: 'd' }, medium: { url: 'm' }, high: { url: 'h' } } },
            statistics: { subscriberCount: '500', viewCount: '9000', videoCount: '12' },
            contentDetails: { relatedPlaylists: { uploads: `UU${channelId.slice(2)}` } },
            brandingSettings: { channel: { keywords: 'k' } },
            status: { madeForKids: false },
            topicDetails: { topicCategories: ['t'] },
        }],
    };
}

const instagramProfiles = {
    IGTOKEN: { user_id: '1789', username: 'ribbon', name: 'Ribbon', followers_count: 2500, follows_count: 10, media_count: 140, biography: 'Bio', website: 'https://r.example', profile_picture_url: 'https://p' },
    LONGTOKEN: { user_id: '3000', username: 'fresh', name: '', followers_count: 5, media_count: 1 },
    SHORTONLY: { user_id: '3001', username: 'shorty', name: 'Shorty' },
    NOID: { username: 'ghost' },
};

function instagramReply(url: URL) {
    const params = url.searchParams;
    const token = params.get('access_token');
    if (url.pathname === '/access_token') {
        if (token === 'SHORT') return reply({ access_token: 'LONGTOKEN', expires_in: 5000 });
        return reply({ error: { message: 'Invalid platform app' } });
    }
    if (url.pathname === '/refresh_access_token') {
        if (token === 'IGTOKEN') return reply({ access_token: 'IGTOKEN2', expires_in: 86400 });
        return reply({ error: { message: 'Token cannot be refreshed' } });
    }
    const profile = instagramProfiles[token as keyof typeof instagramProfiles];
    return profile ? reply(profile) : reply({ error: { message: 'Invalid OAuth access token' } });
}

function platformServer(request: RecordedRequest) {
    const url = new URL(request.url);
    if (url.hostname === 'graph.instagram.com') return instagramReply(url);
    if (url.hostname === 'www.reddit.com') {
        const username = url.pathname.split('/')[2];
        if (username === 'missing') return reply({}, 404, 'Not Found');
        return reply({ data: { name: username === 'ribbon_r' ? 'ribbon_r' : 'NewUser', total_karma: 70, link_karma: 50, comment_karma: 20, icon_img: 'https://i?a=1&amp;b=2', created_utc: 1600000000 } });
    }
    const params = url.searchParams;
    if (params.get('forHandle')) return reply({ items: [{ id: params.get('forHandle') === 'existing' ? CHANNEL_A : CHANNEL_NEW }] });
    if (params.get('forUsername') || params.get('q')) return reply({ items: [] });
    return reply(channelBody(params.get('id')!));
}

let fetchMock: FetchMock | null = null;
let logLines: unknown[][] = [];

before(() => mock.timers.enable({ apis: ['Date'], now: FIXED_NOW }));
after(() => mock.timers.reset());
beforeEach(() => {
    mock.method(Math, 'random', () => 0.123456789);
    logLines = [];
    mock.method(console, 'log', (...args: unknown[]) => logLines.push(['log', ...args]));
    mock.method(console, 'error', (...args: unknown[]) => logLines.push(['error', ...args]));
    fetchMock = installFetch(platformServer);
});
afterEach(() => {
    fetchMock!.restore();
    mock.restoreAll();
});

async function runScenario(steps: RouteStep[], options: { supabase?: { calls: SupabaseCall[] } } = {}) {
    const supabase = options.supabase ?? fakeSupabase(storedAccounts);
    const redis = fakeRedis();
    const app = mountWithContext(app => app.route('/', accountsRouter), { supabase, redis, userId: 'user-1' });
    const responses = [];
    for (const [method, path, json, env] of steps) {
        responses.push(await callRoute(app, method, path, { json, env: env ?? ENV }));
    }
    return { responses, requests: fetchMock!.requests, calls: supabase.calls, redis: redis.deleted, logs: logLines };
}

const brokenSupabase = { calls: [], from() { throw new Error('database unavailable'); } };

describe('accounts routes golden output', () => {
    test('lists accounts and resolves channels', async () => {
        assertGolden(await runScenario([
            ['GET', '/accounts'],
            ['POST', '/resolve-channel', { input: 'https://youtube.com/@creator' }],
            ['POST', '/resolve-channel', { input: 'UCmissingmissingmissing0' }],
            ['POST', '/resolve-channel', { input: 'x' }, {}],
            ['POST', '/resolve-channel', '{not json'],
        ]), 'accountsRoutes.listResolve');
    });

    test('adds YouTube channels and rejects duplicates', async () => {
        assertGolden(await runScenario([
            ['POST', '/accounts', { input: 'https://youtube.com/@creator' }],
            ['POST', '/accounts', { input: '@existing' }],
            ['POST', '/accounts', { input: 'https://youtube.com/@existing' }],
            ['POST', '/accounts', { input: '' }],
            ['POST', '/accounts', { input: 'x' }, { YOUTUBE_API_KEY: `${BOM}   ` }],
        ]), 'accountsRoutes.addYouTube');
    });

    test('adds Reddit accounts and rejects missing fields and duplicates', async () => {
        assertGolden(await runScenario([
            ['POST', '/accounts/reddit', { cookie: 'C' }],
            ['POST', '/accounts/reddit', { username: 'someone' }],
            ['POST', '/accounts/reddit', { username: 'U/NewUser ', cookie: 'NEWCOOKIE' }],
            ['POST', '/accounts/reddit', { username: 'ribbon_r', cookie: 'C2' }],
            ['POST', '/accounts/reddit', { username: 'missing', cookie: 'C3' }],
        ]), 'accountsRoutes.addReddit');
    });

    test('adds Instagram accounts with and without a long-lived exchange', async () => {
        assertGolden(await runScenario([
            ['POST', '/accounts/instagram', {}],
            ['POST', '/accounts/instagram', { accessToken: 'SHORT' }],
            ['POST', '/accounts/instagram', { accessToken: 'SHORTONLY' }],
            ['POST', '/accounts/instagram', { accessToken: 'SHORTONLY' }, {}],
            ['POST', '/accounts/instagram', { accessToken: 'IGTOKEN' }, {}],
            ['POST', '/accounts/instagram', { accessToken: 'NOID' }, {}],
            ['POST', '/accounts/instagram', { accessToken: 'BROKEN' }, {}],
        ]), 'accountsRoutes.addInstagram');
    });

    test('refreshes every account and reports each result', async () => {
        assertGolden(await runScenario([
            ['POST', '/accounts/refresh-all'],
            ['POST', '/accounts/refresh-all', undefined, {}],
            ['POST', '/accounts/refresh-all', undefined, { YOUTUBE_API_KEY: 'PLAINKEY' }],
        ]), 'accountsRoutes.refreshAll');
    });

    test('refreshes one account or one Instagram token', async () => {
        assertGolden(await runScenario([
            ['POST', '/accounts/nope/refresh'],
            ['POST', '/accounts/ig1/refresh'],
            ['POST', '/accounts/ig2/refresh'],
            ['POST', '/accounts/rd1/refresh'],
            ['POST', '/accounts/rd2/refresh'],
            ['POST', '/accounts/yt1/refresh'],
            ['POST', '/accounts/yt1/refresh', undefined, {}],
            ['POST', '/accounts/yt2/refresh'],
            ['POST', '/accounts/other/refresh'],
            ['POST', '/accounts/nope/refresh-ig-token'],
            ['POST', '/accounts/rd1/refresh-ig-token'],
            ['POST', '/accounts/ig2/refresh-ig-token'],
            ['POST', '/accounts/ig1/refresh-ig-token'],
            ['POST', '/accounts/ig1/refresh-ig-token'],
        ]), 'accountsRoutes.refreshOne');
    });

    test('deletes accounts and clears their caches', async () => {
        assertGolden(await runScenario([
            ['DELETE', '/accounts/nope'],
            ['DELETE', '/accounts/other'],
            ['DELETE', '/accounts/rd2'],
            ['GET', '/accounts'],
        ]), 'accountsRoutes.delete');
    });

    test('database failures surface as errors', async () => {
        assertGolden(await runScenario([
            ['GET', '/accounts'],
            ['POST', '/accounts', { input: '@creator' }],
            ['POST', '/accounts/reddit', { username: 'NewUser', cookie: 'C' }],
            ['POST', '/accounts/instagram', { accessToken: 'IGTOKEN' }, {}],
            ['POST', '/accounts/refresh-all'],
            ['POST', '/accounts/ig1/refresh'],
            ['POST', '/accounts/ig1/refresh-ig-token'],
            ['DELETE', '/accounts/ig1'],
        ], { supabase: brokenSupabase }), 'accountsRoutes.dbFailure');
    });
});
