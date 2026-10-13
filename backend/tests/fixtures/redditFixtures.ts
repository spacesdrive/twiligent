import type { RedditPost } from '../../../shared/types/reddit.ts';

// mediaType is any string and awardsCount is left out when the counts tuple has no fourth entry
interface RedditPostFixture extends Omit<RedditPost, 'mediaType' | 'awardsCount'> {
    mediaType: string;
    awardsCount?: number;
}

export const FIXED_NOW = Date.parse('2026-09-01T12:00:00Z');

function redditPost(id: string, subreddit: string, createdAt: string, counts: [number, number, number, number?], mediaType = 'text'): RedditPost {
    const [score, numComments, upvoteRatio, awardsCount] = counts;
    const post: RedditPostFixture = {
        id,
        title: `Post ${id}`,
        subreddit,
        subredditPrefixed: `r/${subreddit}`,
        score,
        upvoteRatio,
        numComments,
        url: `https://reddit.com/r/${subreddit}/comments/${id}/`,
        permalink: `https://reddit.com/r/${subreddit}/comments/${id}/post/`,
        thumbnail: '',
        mediaType,
        isSelf: mediaType === 'text',
        isVideo: mediaType === 'video',
        isNsfw: false,
        createdAt,
        flair: '',
    };
    if (awardsCount !== undefined) post.awardsCount = awardsCount;
    return post as RedditPost;
}

export const richPosts = [
    redditPost('r01', 'webdev', '2026-08-31T09:15:00.000Z', [420, 61, 0.97, 2], 'link'),
    redditPost('r02', 'javascript', '2026-08-29T18:40:00.000Z', [35, 12, 0.88, 0]),
    redditPost('r03', 'webdev', '2026-08-25T09:05:00.000Z', [35, 4, 0.9], 'image'),
    redditPost('r04', 'node', '', [12, 1, 0.75, 1], 'video'),
    redditPost('r05', 'javascript', '2026-08-10T21:00:00.000Z', [-3, 9, 0.31, 0]),
    redditPost('r06', 'webdev', '2026-07-14T06:30:00.000Z', [0, 0, 0.5, 0], 'image'),
    redditPost('r07', 'reactjs', '2026-07-02T12:00:00.000Z', [88, 30, 0.92, 3], 'link'),
    redditPost('r08', 'node', '2026-06-20T23:59:00.000Z', [150, 22, 0.95, 0], 'video'),
    redditPost('r09', 'reactjs', '2026-06-03T00:00:00.000Z', [35, 7, 0.81]),
    redditPost('r10', 'webdev', '2026-05-01T15:45:00.000Z', [1200, 340, 0.98, 12], 'image'),
    redditPost('r11', 'javascript', '2025-12-31T23:30:00.000Z', [7, 2, 0.66, 0]),
];

export const zeroScorePosts = [
    redditPost('z1', 'test', '2026-08-01T10:00:00.000Z', [0, 0, 0.5, 0]),
    redditPost('z2', 'test', '2026-08-02T10:00:00.000Z', [0, 1, 0.5, 0]),
    redditPost('z3', 'test', '2026-08-03T10:00:00.000Z', [0, 0, 0.5, 0]),
];

export const generatedPosts = Array.from({ length: 30 }, (_, index) => redditPost(
    `g${String(index).padStart(2, '0')}`,
    `sub${index % 25}`,
    new Date(Date.UTC(2026, 7, 30, 20) - index * 2.5 * 86400000).toISOString(),
    [(index * 53) % 400, (index * 7) % 60, ((index * 13) % 100) / 100, index % 3],
    ['text', 'image', 'video', 'link'][index % 4],
));

export const rawRedditPosts = [
    { id: 'a', title: 'Self post', subreddit: 'webdev', subreddit_name_prefixed: 'r/webdev', score: 10, upvote_ratio: 0.9, num_comments: 3, url: 'https://reddit.com/a', permalink: '/r/webdev/comments/a/self/', thumbnail: 'self', is_self: true, created_utc: 1785000000, link_flair_text: 'Discussion', total_awards_received: 1 },
    { id: 'b', title: 'Video', subreddit: 'videos', is_video: true, post_hint: 'image', permalink: '/r/videos/comments/b/v/', thumbnail: 'https://thumb/b.jpg', over_18: true, created_utc: 1785100000.5 },
    { id: 'c', title: 'Image', subreddit: 'pics', post_hint: 'image', is_self: true, permalink: '/r/pics/comments/c/i/', thumbnail: 'default' },
    { id: 'd', title: 'Link', subreddit: 'news', post_hint: 'link', permalink: '/r/news/comments/d/l/', score: 0, upvote_ratio: 0 },
    { id: 'e', title: 'Bare', subreddit: 'misc', permalink: '/r/misc/comments/e/b/', thumbnail: null, is_video: false, is_self: false },
];
