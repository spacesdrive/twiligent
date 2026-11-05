import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    ANALYTICS_TOOLS, compareYouTubeChannels, getInstagramAccountAnalytics, listAccounts, listInstagramMedia, listYouTubeVideos,
} from '../../mcp/tools/analyticsTools.ts';
import { NotFoundError, ValidationError } from '../../lib/errors.ts';
import type { Services } from '../../container.ts';
import type { ToolContext } from '../../mcp/tool.ts';
import type { AccountService } from '../../services/accountService.ts';
import type { InstagramAnalyticsService, InstagramAccountAnalytics } from '../../services/instagramAnalyticsService.ts';
import type { YouTubeAnalyticsService } from '../../services/youtubeAnalyticsService.ts';
import type { Account } from '../../../shared/types/domain.ts';
import type { InstagramMedia } from '../../../shared/types/instagram.ts';
import type { YouTubeVideo } from '../../../shared/types/youtube.ts';

const OWNER = 'user-1';

function video(videoId: string, publishedAt: string, viewCount: number): YouTubeVideo {
    return { videoId, title: `Video ${videoId}`, publishedAt, viewCount, likeCount: 1, commentCount: 0, duration: 'PT1M', privacyStatus: 'public' } as YouTubeVideo;
}

function media(id: string, timestamp: string, caption = 'Short caption'): InstagramMedia {
    return {
        id, caption, contentType: 'reel', mediaType: 'VIDEO', mediaUrl: 'https://cdn.example/m.mp4', thumbnailUrl: '', permalink: `https://instagram.com/p/${id}`,
        timestamp, likeCount: 3, commentsCount: 1, viewCount: 10,
    } as InstagramMedia;
}

const ACCOUNTS: Account[] = [
    { id: 'yt-1', platform: 'youtube', title: 'Cooking', customUrl: '@cooking', subscriberCount: 1200, viewCount: 50_000, videoCount: 40 },
    { id: 'ig-1', platform: 'instagram', title: 'Bakery', username: 'bakery', followersCount: 900, mediaCount: 120, accessToken: 'secret-ig-token' },
];

function context(userId = OWNER): ToolContext {
    const owns = (id: string) => userId === OWNER && ACCOUNTS.some(account => account.id === id);
    const accounts: Pick<AccountService, 'list'> = {
        // the real service strips the token; the fake leaves it in so the tool's own summary is what is tested
        list: async id => (id === OWNER ? ACCOUNTS : []),
    };
    const youtubeAnalytics: Pick<YouTubeAnalyticsService, 'channelVideos' | 'comparison'> = {
        async channelVideos(_user, accountId) {
            if (!owns(accountId)) throw new NotFoundError('YouTube channel not found');
            return { videos: [video('old', '2025-01-01T00:00:00Z', 900), video('new', '2026-10-01T00:00:00Z', 50), video('mid', '2026-01-01T00:00:00Z', 300)], fetchedAt: '2026-11-05T00:00:00Z' };
        },
        comparison: async id => (id === OWNER
            ? { rankings: {} as never, totals: { subscribers: 1200, views: 50_000, videos: 40 }, accountCount: 1, bestBySubscribers: ACCOUNTS[0], bestByViews: ACCOUNTS[0], bestByVideos: ACCOUNTS[0] }
            : null),
    };
    const instagramAnalytics: Pick<InstagramAnalyticsService, 'media' | 'analytics'> = {
        async media(_user, accountId) {
            if (!owns(accountId)) throw new NotFoundError('Instagram account not found');
            return { media: [media('a', '2026-10-01T00:00:00Z', 'x'.repeat(1000)), media('b', '2026-11-01T00:00:00Z')], fetchedAt: '2026-11-05T00:00:00Z' };
        },
        async analytics(_user, accountId) {
            if (!owns(accountId)) throw new NotFoundError('Instagram account not found');
            return {
                profile: { username: 'bakery', name: 'Bakery', followersCount: 900, followsCount: 10, mediaCount: 120 },
                account: ACCOUNTS[1],
                analytics: { fetchedPosts: 2, avgLikes: 3, bestByLikes: media('b', '2026-11-01T00:00:00Z'), bestByComments: null, worstByLikes: null, contentTypeStats: {}, postFrequency: {} },
                mediaCount: 120,
            } as unknown as InstagramAccountAnalytics;
        },
    };
    return {
        services: { accounts, youtubeAnalytics, instagramAnalytics } as unknown as Services,
        principal: { userId, permission: 'read', via: 'token:t1' },
    };
}

test('every analytics tool only reads', () => {
    for (const tool of ANALYTICS_TOOLS) {
        assert.equal(tool.permission, 'read', tool.name);
        assert.equal(tool.annotations.readOnlyHint, true, tool.name);
    }
});

test('listing accounts gives headline figures and never an access token', async () => {
    const result = await listAccounts.run({}, context()) as { accounts: { id: string; platform: string }[] };
    assert.deepEqual(result.accounts.map(account => account.id), ['yt-1', 'ig-1']);
    assert.ok(!JSON.stringify(result).includes('secret-ig-token'));
    const other = await listAccounts.run({}, context('user-2')) as { accounts: unknown[] };
    assert.deepEqual(other.accounts, []);
});

test('videos are sorted newest or most viewed first and paged', async () => {
    const recent = await listYouTubeVideos.run(listYouTubeVideos.parse({ accountId: 'yt-1', limit: 2 }), context()) as { videos: { videoId: string }[]; nextCursor: string; total: number };
    assert.deepEqual(recent.videos.map(item => item.videoId), ['new', 'mid']);
    assert.equal(recent.nextCursor, '2');
    assert.equal(recent.total, 3);
    const popular = await listYouTubeVideos.run(listYouTubeVideos.parse({ accountId: 'yt-1', sort: 'views' }), context()) as { videos: { videoId: string }[] };
    assert.deepEqual(popular.videos.map(item => item.videoId), ['old', 'mid', 'new']);
    assert.throws(() => listYouTubeVideos.parse({ accountId: 'yt-1', sort: 'likes' }), ValidationError);
    assert.throws(() => listYouTubeVideos.parse({}), ValidationError);
});

test('another person\'s channel or account is not found', async () => {
    await assert.rejects(listYouTubeVideos.run(listYouTubeVideos.parse({ accountId: 'yt-1' }), context('user-2')), NotFoundError);
    await assert.rejects(getInstagramAccountAnalytics.run({ accountId: 'ig-1' }, context('user-2')), NotFoundError);
});

test('Instagram posts come newest first with long captions cut short', async () => {
    const result = await listInstagramMedia.run(listInstagramMedia.parse({ accountId: 'ig-1' }), context()) as { posts: { id: string; caption: string }[] };
    assert.deepEqual(result.posts.map(item => item.id), ['b', 'a']);
    assert.equal(result.posts[1].caption.length, 303);
    assert.ok(result.posts[1].caption.endsWith('...'));
});

test('comparing channels names the leaders, and says so when there are none', async () => {
    const result = await compareYouTubeChannels.run({}, context()) as { channels: number; leaders: { views: { id: string } } };
    assert.equal(result.channels, 1);
    assert.equal(result.leaders.views.id, 'yt-1');
    const none = await compareYouTubeChannels.run({}, context('user-2')) as { channels: number; message: string };
    assert.equal(none.channels, 0);
});
