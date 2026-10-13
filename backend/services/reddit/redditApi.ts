import type { RedditMediaType, RedditPost, RedditProfile, RedditTrackedPostData } from '../../../shared/types/reddit.ts';
import { NotFoundError, UpstreamError, UpstreamTimeoutError, ValidationError, isAbortError } from '../../lib/errors.ts';

export { computeRedditAnalytics } from './redditAnalytics.ts';

// fetch is a worker global; requests send the stored reddit_session cookie
const REDDIT_BASE = 'https://www.reddit.com';
// reddit requires <platform>:<appid>:<version> (by /u/<username>)
const USER_AGENT = 'script:twiligent:v1.0 (by /u/spacesdrive)';

interface RedditApiError {
    error?: number | string;
    message?: string;
}

interface RedditApiUser {
    name: string;
    total_karma?: number;
    link_karma?: number;
    comment_karma?: number;
    awardee_karma?: number;
    awarder_karma?: number;
    icon_img?: string;
    snoovatar_img?: string;
    created_utc?: number;
    is_gold?: boolean;
    is_mod?: boolean;
    verified?: boolean;
}

interface RedditApiPost {
    id: string;
    title: string;
    subreddit: string;
    subreddit_name_prefixed?: string;
    author?: string;
    score?: number;
    upvote_ratio?: number;
    num_comments?: number;
    url?: string;
    permalink: string;
    thumbnail?: string;
    post_hint?: string;
    is_self?: boolean;
    is_video?: boolean;
    over_18?: boolean;
    created_utc?: number;
    link_flair_text?: string | null;
    total_awards_received?: number;
}

interface RedditThing<T> {
    kind?: string;
    data: T;
}

interface RedditListing<T> {
    data?: {
        children?: RedditThing<T>[];
        after?: string | null;
    };
}

type RedditCookie = string | null | undefined;

async function redditFetch<T>(path: string, cookie: RedditCookie, signal?: AbortSignal): Promise<T> {
    const headers: Record<string, string> = { 'User-Agent': USER_AGENT, 'Accept': 'application/json' };
    if (cookie) headers['Cookie'] = `reddit_session=${cookie}`;
    let res: Response;
    try {
        res = await fetch(`${REDDIT_BASE}${path}`, { headers, signal });
    } catch (err) {
        if (isAbortError(err)) throw new UpstreamTimeoutError('Reddit', err);
        throw new UpstreamError(`Reddit could not be reached (${(err as Error).message})`, { cause: err });
    }

    if (res.status === 404) throw new NotFoundError('Reddit user not found - check the username');
    if (res.status === 403) throw new UpstreamError('Session cookie is invalid or expired - open reddit.com in your browser, copy a fresh reddit_session value from DevTools (Application > Cookies > reddit.com), delete this account, and re-add it', { status: 403 });
    if (res.status === 429) throw new UpstreamError('Reddit rate limit hit - try again in a moment', { status: 429 });
    if (!res.ok) throw new UpstreamError(`Reddit API ${res.status}: ${res.statusText}`, { status: res.status });

    const data = await res.json() as T & RedditApiError;
    if (data.error) throw new UpstreamError(data.message || 'Reddit API error');
    return data;
}

export async function fetchRedditProfile(username: string, cookie: RedditCookie, signal?: AbortSignal): Promise<RedditProfile> {
    const data = await redditFetch<RedditThing<RedditApiUser>>(`/user/${username}/about.json`, cookie, signal);
    const user = data.data;
    return {
        username: user.name,
        totalKarma: user.total_karma ?? ((user.link_karma ?? 0) + (user.comment_karma ?? 0)),
        postKarma: user.link_karma ?? 0,
        commentKarma: user.comment_karma ?? 0,
        awardeeKarma: user.awardee_karma ?? 0,
        awarderKarma: user.awarder_karma ?? 0,
        iconUrl: (user.icon_img || user.snoovatar_img || '').replace(/&amp;/g, '&'),
        createdAt: user.created_utc ? new Date(user.created_utc * 1000).toISOString() : '',
        isGold: user.is_gold ?? false,
        isMod: user.is_mod ?? false,
        verified: user.verified ?? false,
    };
}

function redditMediaType(post: RedditApiPost): RedditMediaType {
    if (post.is_video) return 'video';
    if (post.post_hint === 'image') return 'image';
    if (post.is_self) return 'text';
    return 'link';
}

function normalizeRedditPost(post: RedditApiPost): RedditPost {
    return {
        id: post.id,
        title: post.title,
        subreddit: post.subreddit,
        subredditPrefixed: post.subreddit_name_prefixed ?? `r/${post.subreddit}`,
        score: post.score ?? 0,
        upvoteRatio: post.upvote_ratio ?? 0,
        numComments: post.num_comments ?? 0,
        url: post.url ?? '',
        permalink: `https://reddit.com${post.permalink}`,
        thumbnail: (post.thumbnail && post.thumbnail.startsWith('http')) ? post.thumbnail : '',
        mediaType: redditMediaType(post),
        isSelf: post.is_self ?? false,
        isVideo: post.is_video ?? false,
        isNsfw: post.over_18 ?? false,
        createdAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : '',
        flair: post.link_flair_text ?? '',
        awardsCount: post.total_awards_received ?? 0,
    };
}

export async function fetchRedditPosts(username: string, cookie: RedditCookie, limit = 100, signal?: AbortSignal): Promise<RedditPost[]> {
    const allPosts: RedditApiPost[] = [];
    let after: string | null = null;
    let pages = 0;

    while (pages < 10 && allPosts.length < limit) {
        const query = new URLSearchParams({
            limit: String(Math.min(100, limit - allPosts.length)),
            sort: 'new',
        });
        if (after) query.set('after', after);

        const data: RedditListing<RedditApiPost> = await redditFetch<RedditListing<RedditApiPost>>(`/user/${username}/submitted.json?${query}`, cookie, signal);
        const children = data.data?.children ?? [];
        if (children.length === 0) break;

        for (const child of children) allPosts.push(child.data);
        after = data.data?.after ?? null;
        if (!after) break;
        pages++;
    }

    return allPosts.slice(0, limit).map(normalizeRedditPost);
}

function parseRedditPostUrl(rawUrl: string): string {
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(rawUrl);
    } catch {
        throw new ValidationError('Invalid URL - paste the full post link from reddit.com');
    }
    if (!parsedUrl.hostname.includes('reddit.com')) throw new ValidationError('Not a Reddit URL - paste a link from reddit.com');
    const match = parsedUrl.pathname.match(/^(\/r\/[^/]+\/comments\/[^/]+(?:\/[^/]+)?)\/?$/);
    if (!match) throw new ValidationError('Not a Reddit post URL - paste the full post link including /r/.../comments/...');
    return match[1];
}

export async function fetchTrackedPostData(postUrl: string, cookie: RedditCookie, signal?: AbortSignal): Promise<RedditTrackedPostData> {
    const path = parseRedditPostUrl(postUrl);
    const data = await redditFetch<RedditListing<RedditApiPost>[]>(`${path}.json`, cookie, signal);
    if (!Array.isArray(data) || !data[0]) throw new UpstreamError('Unexpected Reddit response - post may be deleted or private');
    const post = data[0]?.data?.children?.[0]?.data;
    if (!post) throw new NotFoundError('Post not found or has been deleted');
    return {
        postId: post.id,
        title: post.title,
        subreddit: post.subreddit,
        subredditPrefixed: post.subreddit_name_prefixed ?? `r/${post.subreddit}`,
        author: post.author ?? '[deleted]',
        score: post.score ?? 0,
        upvoteRatio: post.upvote_ratio ?? 0,
        numComments: post.num_comments ?? 0,
        permalink: `https://reddit.com${post.permalink}`,
        isNsfw: post.over_18 ?? false,
        createdAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : '',
        lastFetchedAt: new Date().toISOString(),
    };
}
