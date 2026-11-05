import { READ_ONLY, defineTool, noInput } from '../tool.ts';
import { idProperty, objectSchema, pageOf, pageProperties, parsePage, requiredId } from '../schemas.ts';
import { ValidationError } from '../../lib/errors.ts';
import type { Page } from '../schemas.ts';
import type { ToolAnnotations } from '../tool.ts';
import type { SafeAccount } from '../../../shared/types/domain.ts';
import type { InstagramMedia } from '../../../shared/types/instagram.ts';
import type { YouTubeVideo, YouTubeVideoSummary } from '../../../shared/types/youtube.ts';

// titles, captions and bios are written by people on the platforms, so the client is told the result holds them
const READ_PLATFORM_TEXT: ToolAnnotations = { ...READ_ONLY, openWorldHint: true };

// long captions are cut so a page of posts stays small; the permalink leads to the full text
const MAX_CAPTION_CHARS = 300;

const VIDEO_SORTS = ['recent', 'views'] as const;
type VideoSort = typeof VIDEO_SORTS[number];

function shortText(text: string | undefined): string {
    if (!text) return '';
    return text.length > MAX_CAPTION_CHARS ? `${text.slice(0, MAX_CAPTION_CHARS)}...` : text;
}

// the fields a person knows an account by; tokens are already gone from SafeAccount, and thumbnails add nothing
function accountSummary(account: SafeAccount) {
    return account.platform === 'instagram'
        ? {
            id: account.id, platform: account.platform, name: account.title ?? account.username ?? '', username: account.username ?? null,
            followers: account.followersCount ?? null, posts: account.mediaCount ?? null, lastUpdated: account.lastUpdated ?? null,
        }
        : {
            id: account.id, platform: account.platform, name: account.title ?? '', handle: account.customUrl ?? null,
            subscribers: account.hiddenSubscriberCount ? null : account.subscriberCount ?? null, views: account.viewCount ?? null,
            videos: account.videoCount ?? null, lastUpdated: account.lastUpdated ?? null,
        };
}

function videoBrief(video: YouTubeVideoSummary | null) {
    if (!video) return null;
    return { videoId: video.videoId, title: video.title, views: video.viewCount, likes: video.likeCount, comments: video.commentCount, publishedAt: video.publishedAt };
}

function videoRow(video: YouTubeVideo) {
    return {
        videoId: video.videoId, title: video.title, publishedAt: video.publishedAt, duration: video.duration,
        views: video.viewCount, likes: video.likeCount, comments: video.commentCount, privacy: video.privacyStatus,
    };
}

function mediaRow(media: InstagramMedia | null) {
    if (!media) return null;
    return {
        id: media.id, type: media.contentType, caption: shortText(media.caption), postedAt: media.timestamp,
        likes: media.likeCount, comments: media.commentsCount, views: media.viewCount, permalink: media.permalink,
    };
}

const accountIdInput = objectSchema({ accountId: idProperty('account') }, ['accountId']);

export const listAccounts = defineTool<Record<string, never>>({
    name: 'list_accounts',
    title: 'List connected accounts',
    description: 'Lists the YouTube channels and Instagram accounts in Twiligent with their headline figures. Use the ids with the other tools.',
    inputSchema: noInput(),
    annotations: READ_PLATFORM_TEXT,
    permission: 'read',
    parse: () => ({}),
    async run(_input, { services, principal }) {
        const accounts = await services.accounts.list(principal.userId);
        return { accounts: accounts.map(accountSummary) };
    },
});

export const getYouTubeChannelAnalytics = defineTool<{ accountId: string }>({
    name: 'get_youtube_channel_analytics',
    title: 'Get YouTube channel analytics',
    description: 'Gets a YouTube channel\'s figures from its public data: subscribers, views, upload totals and averages, engagement, growth estimates, and its best and most recent videos.',
    inputSchema: accountIdInput,
    annotations: READ_PLATFORM_TEXT,
    permission: 'read',
    parse: args => ({ accountId: requiredId(args, 'accountId', 'account') }),
    async run({ accountId }, { services, principal }) {
        const { channel, analytics, videoCount } = await services.youtubeAnalytics.channelAnalytics(principal.userId, accountId);
        return {
            channel: {
                ...accountSummary(channel), ageYears: channel.channelAgeYears, avgViewsPerDay: channel.avgViewsPerDay,
                avgSubscribersPerDay: channel.avgSubGainPerDay, estimatedMonthlyViews: channel.estimatedMonthlyViews,
                estimatedMonthlySubscribers: channel.estimatedMonthlySubGain,
            },
            uploads: {
                analysedVideos: videoCount, totalViews: analytics.totalViews, avgViews: analytics.avgViews, medianViews: analytics.medianViews,
                avgLikes: analytics.avgLikes, avgComments: analytics.avgComments, engagementRate: analytics.overallEngagementRate,
                avgDuration: analytics.avgDurationFormatted, estimatedWatchTimeHours: analytics.estimatedTotalWatchTimeHours,
            },
            videos: {
                bestByViews: videoBrief(analytics.bestByViews), bestByEngagement: videoBrief(analytics.bestByEngagement),
                worstByViews: videoBrief(analytics.worstByViews), mostRecent: videoBrief(analytics.mostRecent),
            },
        };
    },
});

export const listYouTubeVideos = defineTool<{ accountId: string; sort: VideoSort; page: Page }>({
    name: 'list_youtube_videos',
    title: 'List a channel\'s YouTube videos',
    description: 'Lists a YouTube channel\'s uploads with views, likes and comments, newest first or most viewed first.',
    inputSchema: objectSchema({
        accountId: idProperty('account'),
        sort: { type: 'string', enum: [...VIDEO_SORTS], description: 'recent (default) or views' },
        ...pageProperties,
    }, ['accountId']),
    annotations: READ_PLATFORM_TEXT,
    permission: 'read',
    parse(args) {
        const sort = args.sort ?? 'recent';
        if (!VIDEO_SORTS.includes(sort as VideoSort)) throw new ValidationError(`sort must be one of ${VIDEO_SORTS.join(', ')}`);
        return { accountId: requiredId(args, 'accountId', 'account'), sort: sort as VideoSort, page: parsePage(args) };
    },
    async run({ accountId, sort, page }, { services, principal }) {
        const { videos, fetchedAt } = await services.youtubeAnalytics.channelVideos(principal.userId, accountId);
        const ordered = [...videos].sort(sort === 'views'
            ? (a, b) => b.viewCount - a.viewCount
            : (a, b) => b.publishedAt.localeCompare(a.publishedAt));
        const { items, nextCursor, total } = pageOf(ordered, page);
        return { videos: items.map(videoRow), nextCursor, total, fetchedAt };
    },
});

export const compareYouTubeChannels = defineTool<Record<string, never>>({
    name: 'compare_youtube_channels',
    title: 'Compare YouTube channels',
    description: 'Compares all connected YouTube channels: combined totals and the leading channel by subscribers, views and videos.',
    inputSchema: noInput(),
    annotations: READ_PLATFORM_TEXT,
    permission: 'read',
    parse: () => ({}),
    async run(_input, { services, principal }) {
        const comparison = await services.youtubeAnalytics.comparison(principal.userId);
        if (!comparison) return { channels: 0, message: 'No YouTube channels are connected yet.' };
        const lead = (account: SafeAccount | null) => (account ? { id: account.id, name: account.title ?? '' } : null);
        return {
            channels: comparison.accountCount,
            totals: comparison.totals,
            leaders: { subscribers: lead(comparison.bestBySubscribers), views: lead(comparison.bestByViews), videos: lead(comparison.bestByVideos) },
        };
    },
});

export const getInstagramAccountAnalytics = defineTool<{ accountId: string }>({
    name: 'get_instagram_account_analytics',
    title: 'Get Instagram account analytics',
    description: 'Gets an Instagram account\'s followers, post totals and averages, engagement rate, results per content type, and its best posts.',
    inputSchema: accountIdInput,
    annotations: READ_PLATFORM_TEXT,
    permission: 'read',
    parse: args => ({ accountId: requiredId(args, 'accountId', 'account') }),
    async run({ accountId }, { services, principal }) {
        const { profile, analytics, mediaCount } = await services.instagramAnalytics.analytics(principal.userId, accountId);
        return {
            account: { id: accountId, username: profile.username, name: profile.name, followers: profile.followersCount, following: profile.followsCount, posts: mediaCount },
            posts: {
                analysedPosts: analytics.fetchedPosts, avgLikes: analytics.avgLikes, avgComments: analytics.avgComments, avgViews: analytics.avgViews,
                medianLikes: analytics.medianLikes, engagementRate: analytics.engagementRate, totalViews: analytics.totalViews,
            },
            byContentType: analytics.contentTypeStats,
            postFrequency: analytics.postFrequency,
            best: { byLikes: mediaRow(analytics.bestByLikes), byComments: mediaRow(analytics.bestByComments) },
            worstByLikes: mediaRow(analytics.worstByLikes),
        };
    },
});

export const listInstagramMedia = defineTool<{ accountId: string; page: Page }>({
    name: 'list_instagram_media',
    title: 'List Instagram posts',
    description: 'Lists an Instagram account\'s posts, newest first, with likes, comments, views and a link to each.',
    inputSchema: objectSchema({ accountId: idProperty('account'), ...pageProperties }, ['accountId']),
    annotations: READ_PLATFORM_TEXT,
    permission: 'read',
    parse: args => ({ accountId: requiredId(args, 'accountId', 'account'), page: parsePage(args) }),
    async run({ accountId, page }, { services, principal }) {
        const { media, fetchedAt } = await services.instagramAnalytics.media(principal.userId, accountId);
        const ordered = [...media].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        const { items, nextCursor, total } = pageOf(ordered, page);
        return { posts: items.map(mediaRow), nextCursor, total, fetchedAt };
    },
});

export const ANALYTICS_TOOLS = [
    listAccounts, getYouTubeChannelAnalytics, listYouTubeVideos, compareYouTubeChannels, getInstagramAccountAnalytics, listInstagramMedia,
];
