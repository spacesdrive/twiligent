import type { YouTubeVideo } from '../../../shared/types/youtube.ts';

export const FIXED_NOW = Date.parse('2026-09-01T12:00:00Z');

function video(videoId: string, publishedAt: string, duration: string, counts: [number, number | null, number | null], extra: Record<string, unknown> = {}): YouTubeVideo {
    const [viewCount, likeCount, commentCount] = counts;
    return {
        videoId,
        title: `Video ${videoId}`,
        description: 'About this video',
        publishedAt,
        channelTitle: 'Ribbon',
        thumbnails: { default: `https://i/${videoId}/d.jpg`, medium: `https://i/${videoId}/m.jpg`, high: '' },
        tags: [],
        categoryId: '22',
        liveBroadcastContent: 'none',
        defaultAudioLanguage: 'en',
        duration,
        dimension: '2d',
        definition: 'hd',
        caption: false,
        licensedContent: true,
        projection: 'rectangular',
        viewCount,
        likeCount,
        commentCount,
        privacyStatus: 'public',
        embeddable: true,
        madeForKids: false,
        ...extra,
    } as YouTubeVideo;
}

export const richVideos = [
    video('v01', '2026-08-31T09:15:00Z', 'PT45S', [12000, 900, 40], { tags: ['Shorts', 'travel'] }),
    video('v02', '2026-08-25T12:00:00Z', 'PT8M12S', [5400, null, 31], { tags: ['travel', 'vlog'], definition: 'sd' }),
    video('v03', '2026-08-25T12:00:00Z', 'PT1M', [5400, 210, null], { categoryId: '' }),
    video('v04', '2026-08-02T21:00:00Z', 'PT1H2M3S', [98000, 4100, 640], { caption: true, tags: ['Travel', 'long form'] }),
    video('v05', '2026-07-14T06:30:00Z', 'PT10M', [0, null, null], { embeddable: false, licensedContent: false }),
    video('v06', '2026-06-20T23:59:00Z', 'PT2H', [3100, 120, 15], { madeForKids: true, categoryId: '10' }),
    video('v07', '2026-06-03T00:00:00Z', 'P1DT2H3M', [450, 30, 2], { thumbnails: {} }),
    video('v08', '2026-03-15T08:00:00Z', 'P0D', [77, 5, 1], { definition: 'sd', caption: true }),
    video('v09', '2025-12-31T23:30:00Z', 'PT59S', [250000, 12000, 900], { tags: ['shorts', 'newyear', 'Travel'] }),
    video('v10', '2025-09-02T12:00:00Z', 'PT4M20S', [1000000, 50000, 3000], { categoryId: '10' }),
    video('v11', '2024-01-01T00:00:00Z', 'PT30M', [1, 0, 0]),
];

export const zeroViewVideos = [
    video('z1', '2026-08-01T10:00:00Z', 'PT30S', [0, 0, 0]),
    video('z2', '2026-08-01T10:00:00Z', 'PT20M', [0, null, null]),
];

function generatedTags(index: number) {
    const tags: string[] = [];
    for (let tag = 0; tag < 40; tag++) {
        if ((tag + index) % 4 === 0) tags.push(`Tag${tag}`);
    }
    return tags;
}

export const generatedVideos = Array.from({ length: 36 }, (_, index) => video(
    `g${String(index).padStart(2, '0')}`,
    new Date(Date.UTC(2026, 7, 30, 20) - index * 9.5 * 86400000).toISOString(),
    `PT${index % 3}H${(index * 7) % 60}M${(index * 13) % 60}S`,
    [(index * 7919) % 50000, index % 5 === 0 ? null : (index * 31) % 900, index % 7 === 0 ? null : index * 3],
    { tags: generatedTags(index), categoryId: String(20 + (index % 6)) },
));

export const rawPlaylistItem = (videoId: string) => ({ snippet: { resourceId: { videoId } } });

export const rawVideos = {
    full: {
        id: 'full',
        snippet: { title: 'Full', description: 'x'.repeat(260), publishedAt: '2026-08-01T10:00:00Z', channelTitle: 'Ribbon', thumbnails: { default: { url: 'd' }, medium: { url: 'm' }, high: { url: 'h' } }, tags: ['a'], categoryId: '22', liveBroadcastContent: 'live', defaultAudioLanguage: 'de' },
        contentDetails: { duration: 'PT3M', dimension: '3d', definition: 'sd', caption: 'true', licensedContent: true, projection: '360' },
        statistics: { viewCount: '1500', likeCount: '40', commentCount: '0' },
        status: { privacyStatus: 'unlisted', embeddable: true, madeForKids: true },
    },
    hidden: {
        id: 'hidden',
        snippet: { title: 'Hidden', publishedAt: '2026-08-02T10:00:00Z', channelTitle: 'Ribbon' },
        contentDetails: { duration: 'PT10S', caption: 'false' },
        statistics: { viewCount: 'abc' },
    },
    odd: {
        id: 'odd',
        snippet: { title: 'Odd', description: '', publishedAt: '2026-08-03T10:00:00Z', channelTitle: 'Ribbon' },
        contentDetails: { duration: 'PT1H' },
        statistics: { viewCount: '7', likeCount: 'n/a', commentCount: '12.9' },
        status: {},
    },
};
