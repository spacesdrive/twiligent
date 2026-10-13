import type { InstagramMedia } from '../../../shared/types/instagram.ts';

export const FIXED_NOW = Date.parse('2026-09-01T12:00:00Z');

// 'story' is not a known content type, so contentType is any string here
function mediaItem(id: string, contentType: string, timestamp: string, counts: [number, number, number | null], caption = ''): InstagramMedia {
    const [likeCount, commentsCount, viewCount] = counts;
    return {
        id,
        caption,
        contentType,
        mediaType: contentType === 'post' ? 'IMAGE' : 'VIDEO',
        mediaUrl: `https://cdn.example/${id}.jpg`,
        thumbnailUrl: '',
        permalink: `https://www.instagram.com/p/${id}/`,
        timestamp,
        likeCount,
        commentsCount,
        viewCount,
    } as InstagramMedia;
}

const longCaption = `${'Behind the scenes of the shoot. '.repeat(6)}#Café #travel #reels`;

export const richMedia = [
    mediaItem('m01', 'reel', '2026-08-31T09:15:00+0000', [120, 14, 5400], '#Travel #sunset golden hour over the bay'),
    mediaItem('m02', 'post', '2026-08-29T18:40:00+0000', [45, 3, null]),
    mediaItem('m03', 'video', '2026-08-25T09:05:00+0000', [45, 9, 800], 'Short clip #travel'),
    mediaItem('m04', 'reel', '2026-08-10T21:00:00+0000', [300, 40, 12000], longCaption),
    mediaItem('m05', 'post', 'not-a-date', [10, 1, null], `${'x'.repeat(320)} #longform`),
    mediaItem('m06', 'post', '2026-07-14T06:30:00+0000', [0, 0, null], '#quiet'),
    mediaItem('m07', 'reel', '2026-07-02T12:00:00+0000', [88, 12, 0], `${'m'.repeat(70)} #reels #Àpropos`),
    mediaItem('m08', 'story', '2026-06-20T23:59:00+0000', [15, 2, 100], 'Unknown type'),
    mediaItem('m09', 'post', '2026-06-03T00:00:00+0000', [45, 9, null], 'a'.repeat(50)),
    mediaItem('m10', 'video', '2026-05-01T15:45:00+0000', [60, 5, 2500], 'b'.repeat(151)),
    mediaItem('m11', 'post', '2026-03-15T08:00:00+0000', [22, 0, null], 'c'.repeat(300)),
    mediaItem('m12', 'reel', '2025-12-31T23:30:00+0000', [500, 75, 30000], '#Travel #TRAVEL #newyear'),
    mediaItem('m13', 'post', '', [5, 1, null], '#travel'),
];

export const zeroEngagementMedia = [
    mediaItem('z1', 'post', '2026-08-01T10:00:00+0000', [0, 0, null]),
    mediaItem('z2', 'post', '2026-08-02T10:00:00+0000', [0, 0, null]),
    mediaItem('z3', 'reel', '2026-08-03T10:00:00+0000', [0, 0, 0]),
];

function generatedCaption(index: number) {
    const tags: string[] = [];
    for (let tag = 0; tag < 25; tag++) {
        if ((tag + index) % 3 === 0) tags.push(`#tag${tag}`);
    }
    return `Post number ${index} ${tags.join(' ')}`;
}

export const generatedMedia = Array.from({ length: 24 }, (_, index) => mediaItem(
    `g${String(index).padStart(2, '0')}`,
    ['reel', 'post', 'video'][index % 3],
    new Date(Date.UTC(2026, 7, 30, 20) - index * 3.5 * 86400000).toISOString().replace('.000Z', '+0000'),
    [(index * 37) % 200, (index * 11) % 30, index % 4 === 0 ? null : index * 100],
    generatedCaption(index),
));
