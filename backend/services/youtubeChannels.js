import { ytFetch } from './youtubeApi.js';

const CHANNEL_ID_PATTERN = /^UC[\w-]{22}$/;
const CHANNEL_URL_PATTERNS = [
    /youtube\.com\/channel\/(UC[\w-]{22})/,
    /youtube\.com\/@([\w.-]+)/,
    /youtube\.com\/c\/([\w.-]+)/,
    /youtube\.com\/user\/([\w.-]+)/,
    /youtube\.com\/([\w.-]+)/,
];

function extractChannelId(input) {
    if (!input) return null;
    const trimmed = input.trim();
    if (CHANNEL_ID_PATTERN.test(trimmed)) return trimmed;
    for (const pattern of CHANNEL_URL_PATTERNS) {
        const match = trimmed.match(pattern);
        if (match) return match[1];
    }
    return trimmed;
}

// null when the lookup finds nothing or fails, so the next strategy runs
async function lookupChannelId(endpoint, params, pickId, apiKey) {
    try {
        const data = await ytFetch(endpoint, params, apiKey);
        if (data.items && data.items.length > 0) return pickId(data.items[0]);
        return null;
    } catch {
        return null;
    }
}

export async function resolveChannelId(input, apiKey) {
    const extracted = extractChannelId(input);
    if (!extracted) throw new Error('Invalid input');
    if (CHANNEL_ID_PATTERN.test(extracted)) return extracted;

    // sequential on purpose: a search costs 100 quota units
    const byHandle = await lookupChannelId('channels', { part: 'id', forHandle: extracted }, (item) => item.id, apiKey);
    if (byHandle !== null) return byHandle;

    const byUsername = await lookupChannelId('channels', { part: 'id', forUsername: extracted }, (item) => item.id, apiKey);
    if (byUsername !== null) return byUsername;

    const searchParams = { part: 'snippet', q: extracted, type: 'channel', maxResults: '1' };
    const bySearch = await lookupChannelId('search', searchParams, (item) => item.snippet.channelId, apiKey);
    if (bySearch !== null) return bySearch;

    throw new Error('Could not resolve channel. Please provide a valid Channel ID (starts with UC).');
}

export async function fetchChannelData(channelId, apiKey) {
    const data = await ytFetch('channels', {
        part: 'snippet,statistics,contentDetails,brandingSettings,status,topicDetails',
        id: channelId,
    }, apiKey);

    if (!data.items || data.items.length === 0) throw new Error('Channel not found');
    const channel = data.items[0];

    return {
        channelId: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        customUrl: channel.snippet.customUrl || '',
        publishedAt: channel.snippet.publishedAt,
        country: channel.snippet.country || 'Unknown',
        thumbnails: {
            default: channel.snippet.thumbnails?.default?.url || '',
            medium: channel.snippet.thumbnails?.medium?.url || '',
            high: channel.snippet.thumbnails?.high?.url || '',
        },
        subscriberCount: parseInt(channel.statistics.subscriberCount) || 0,
        viewCount: parseInt(channel.statistics.viewCount) || 0,
        videoCount: parseInt(channel.statistics.videoCount) || 0,
        hiddenSubscriberCount: channel.statistics.hiddenSubscriberCount || false,
        uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads || '',
        keywords: channel.brandingSettings?.channel?.keywords || '',
        bannerUrl: channel.brandingSettings?.image?.bannerExternalUrl || '',
        madeForKids: channel.status?.madeForKids || false,
        topicCategories: channel.topicDetails?.topicCategories || [],
        isLinked: channel.status?.isLinked || false,
    };
}
