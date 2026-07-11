// fetch is a global in Cloudflare Workers - no import needed.
// No crypto or DB imports needed - Reddit uses the public JSON API or RSS.
// Session cookies are stored as-is (not encrypted) and used directly in requests.

const REDDIT_BASE = 'https://www.reddit.com';
const REDDIT_OAUTH_BASE = 'https://oauth.reddit.com';
// Reddit requires: <platform>:<appid>:<version> (by /u/<username>)
const USER_AGENT = 'script:twiligent:v1.0 (by /u/spacesdrive)';

// Module-level token cache. Cloudflare isolates are reused within a data center,
// so this reduces token fetches. On fresh isolates it re-fetches transparently.
let _cachedToken = null;
let _tokenExpiry = 0;

async function getAppOnlyToken(env) {
    if (!env?.REDDIT_CLIENT_ID || !env?.REDDIT_CLIENT_SECRET) return null;
    if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;
    try {
        const creds = btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`);
        const res = await fetch('https://www.reddit.com/api/v1/access_token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${creds}`,
                'User-Agent': USER_AGENT,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'grant_type=client_credentials',
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.access_token) return null;
        _cachedToken = data.access_token;
        _tokenExpiry = Date.now() + Math.max(0, (data.expires_in ?? 3600) - 60) * 1000;
        return _cachedToken;
    } catch {
        return null;
    }
}

async function redditFetch(path, cookie = null, token = null) {
    const base = token ? REDDIT_OAUTH_BASE : REDDIT_BASE;
    const headers = {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (cookie) headers['Cookie'] = `reddit_session=${cookie}`;

    const res = await fetch(`${base}${path}`, { headers });

    if (res.status === 404) throw new Error('Reddit user not found - check the username');
    if (res.status === 403) {
        if (token) throw new Error('Account is private or suspended');
        // Reddit ended unauthenticated JSON access in May 2026 from server IPs.
        const err = new Error('REDDIT_BLOCKED');
        err.status = 403;
        throw err;
    }
    if (res.status === 429) throw new Error('Reddit rate limit hit - try again in a moment');
    if (!res.ok) throw new Error(`Reddit API ${res.status}: ${res.statusText}`);

    const data = await res.json();
    if (data.error) throw new Error(data.message || 'Reddit API error');
    return data;
}

// --- RSS fallback ---
// Reddit's .json API ended unauthenticated server access in May 2026.
// RSS feeds still return 200 but carry no score or karma data.

function rssExtractAll(xml, tag) {
    const results = [];
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g');
    let m;
    while ((m = re.exec(xml)) !== null) {
        results.push(m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim());
    }
    return results;
}

function rssExtractAttr(xml, tag, attr) {
    const m = xml.match(new RegExp(`<${tag}[^>]+${attr}="([^"]+)"`));
    return m ? m[1] : '';
}

async function fetchRedditRSS(username) {
    const res = await fetch(`${REDDIT_BASE}/user/${username}/submitted.rss`, {
        headers: { 'User-Agent': USER_AGENT },
    });
    if (res.status === 404) throw new Error('Reddit user not found - check the username');
    if (!res.ok) throw new Error(`Reddit has blocked all server access to public data (${res.status}). Reddit analytics are unavailable until Reddit re-enables public API access or you provide OAuth credentials.`);
    return res.text();
}

function parseRSSPosts(username, xml) {
    // Split by <entry> to get individual post blocks
    const raw = xml.split('<entry>').slice(1);
    return raw.map(block => {
        const title = rssExtractAll(block, 'title')[0] || '';
        const link = rssExtractAttr(block, 'link', 'href') || '';
        const published = rssExtractAll(block, 'published')[0] || rssExtractAll(block, 'updated')[0] || '';
        const category = rssExtractAttr(block, 'category', 'term') || '';
        // Extract post ID from permalink: /r/sub/comments/{id}/title/
        const idMatch = link.match(/\/comments\/([a-z0-9]+)\//i);
        return {
            id: idMatch ? idMatch[1] : link,
            title,
            subreddit: category,
            subredditPrefixed: category ? `r/${category}` : '',
            score: 0,
            upvoteRatio: 0,
            numComments: 0,
            url: link,
            permalink: link,
            thumbnail: '',
            mediaType: 'text',
            isSelf: true,
            isVideo: false,
            isNsfw: false,
            createdAt: published,
            flair: '',
        };
    }).filter(p => p.permalink);
}

// Verify user exists via RSS and return a minimal profile stub.
// Called when the JSON API is blocked (no OAuth credentials).
export async function fetchRedditProfileViaRSS(username) {
    await fetchRedditRSS(username); // throws if user not found or blocked
    return {
        username,
        totalKarma: null,
        postKarma: null,
        commentKarma: null,
        awardeeKarma: null,
        awarderKarma: null,
        iconUrl: '',
        createdAt: '',
        isGold: false,
        isMod: false,
        verified: false,
        apiRestricted: true,
    };
}

export async function fetchRedditProfile(username, cookie = null, env = null) {
    const token = await getAppOnlyToken(env);
    try {
        const data = await redditFetch(`/user/${username}/about.json`, cookie, token);
        const u = data.data;
        return {
            username: u.name,
            totalKarma: u.total_karma ?? (u.link_karma + u.comment_karma),
            postKarma: u.link_karma ?? 0,
            commentKarma: u.comment_karma ?? 0,
            awardeeKarma: u.awardee_karma ?? 0,
            awarderKarma: u.awarder_karma ?? 0,
            iconUrl: (u.icon_img || u.snoovatar_img || '').replace(/&amp;/g, '&'),
            createdAt: u.created_utc ? new Date(u.created_utc * 1000).toISOString() : '',
            isGold: u.is_gold ?? false,
            isMod: u.is_mod ?? false,
            verified: u.verified ?? false,
            apiRestricted: false,
        };
    } catch (err) {
        if (err.message === 'REDDIT_BLOCKED') {
            return fetchRedditProfileViaRSS(username);
        }
        throw err;
    }
}

export async function fetchRedditPosts(username, cookie = null, limit = 100, env = null) {
    const token = await getAppOnlyToken(env);
    try {
        return await fetchRedditPostsJSON(username, cookie, limit, token);
    } catch (err) {
        if (err.message === 'REDDIT_BLOCKED') {
            return fetchRedditPostsRSS(username);
        }
        throw err;
    }
}

async function fetchRedditPostsJSON(username, cookie, limit, token) {
    let allPosts = [];
    let after = null;
    let pages = 0;

    while (pages < 10 && allPosts.length < limit) {
        const qs = new URLSearchParams({
            limit: String(Math.min(100, limit - allPosts.length)),
            sort: 'new',
        });
        if (after) qs.set('after', after);

        const data = await redditFetch(`/user/${username}/submitted.json?${qs}`, cookie, token);
        const children = data.data?.children ?? [];
        if (children.length === 0) break;

        for (const child of children) allPosts.push(child.data);
        after = data.data?.after ?? null;
        if (!after) break;
        pages++;
    }

    return allPosts.slice(0, limit).map(p => ({
        id: p.id,
        title: p.title,
        subreddit: p.subreddit,
        subredditPrefixed: p.subreddit_name_prefixed ?? `r/${p.subreddit}`,
        score: p.score ?? 0,
        upvoteRatio: p.upvote_ratio ?? 0,
        numComments: p.num_comments ?? 0,
        url: p.url ?? '',
        permalink: `https://reddit.com${p.permalink}`,
        thumbnail: (p.thumbnail && p.thumbnail.startsWith('http')) ? p.thumbnail : '',
        mediaType: p.is_video ? 'video' : (p.post_hint === 'image' ? 'image' : p.is_self ? 'text' : 'link'),
        isSelf: p.is_self ?? false,
        isVideo: p.is_video ?? false,
        isNsfw: p.over_18 ?? false,
        createdAt: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : '',
        flair: p.link_flair_text ?? '',
    }));
}

async function fetchRedditPostsRSS(username) {
    const xml = await fetchRedditRSS(username);
    return parseRSSPosts(username, xml);
}

export function computeRedditAnalytics(profile, posts) {
    const empty = {
        fetchedPosts: 0, totalScore: 0, avgScore: 0, medianScore: 0,
        totalComments: 0, avgComments: 0, avgUpvoteRatio: 0,
        topPosts: [], worstPosts: [], subredditBreakdown: [],
        mediaTypeDistribution: {}, postsByDayOfWeek: [], postsByHour: [],
        monthlyBreakdown: [], engagementTimeline: [],
        postsLast7Days: 0, postsLast30Days: 0, postsLast90Days: 0,
        postFrequency: { perWeek: 0, perMonth: 0 },
        viralityScore: 0, consistencyScore: 0,
        bestPostingDay: '', bestPostingHour: '',
        apiRestricted: profile?.apiRestricted ?? false,
    };

    if (!posts || posts.length === 0) return empty;

    const totalScore = posts.reduce((s, p) => s + p.score, 0);
    const totalComments = posts.reduce((s, p) => s + p.numComments, 0);
    const avgScore = posts.length > 0 ? Math.round(totalScore / posts.length) : 0;
    const avgComments = posts.length > 0 ? Math.round(totalComments / posts.length) : 0;
    const avgUpvoteRatio = parseFloat(
        (posts.reduce((s, p) => s + p.upvoteRatio, 0) / posts.length * 100).toFixed(1)
    );

    const sortedScores = [...posts].map(p => p.score).sort((a, b) => a - b);
    const mid = Math.floor(sortedScores.length / 2);
    const medianScore = sortedScores.length % 2
        ? sortedScores[mid]
        : Math.round((sortedScores[mid - 1] + sortedScores[mid]) / 2);

    const byScore = [...posts].sort((a, b) => b.score - a.score);

    // Subreddit breakdown
    const subMap = {};
    posts.forEach(p => {
        const sub = p.subreddit;
        if (!subMap[sub]) subMap[sub] = { subreddit: sub, posts: 0, totalScore: 0, totalComments: 0 };
        subMap[sub].posts++;
        subMap[sub].totalScore += p.score;
        subMap[sub].totalComments += p.numComments;
    });
    const subredditBreakdown = Object.values(subMap)
        .map(s => ({
            ...s,
            avgScore: Math.round(s.totalScore / s.posts),
            avgComments: Math.round(s.totalComments / s.posts),
        }))
        .sort((a, b) => b.posts - a.posts)
        .slice(0, 20);

    // Media type distribution
    const mediaTypeDistribution = {};
    posts.forEach(p => { mediaTypeDistribution[p.mediaType] = (mediaTypeDistribution[p.mediaType] ?? 0) + 1; });

    // Day of week and hour analysis
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayBuckets = Array(7).fill(null).map(() => ({ count: 0, score: 0, comments: 0 }));
    const hourBuckets = Array(24).fill(null).map(() => ({ count: 0, score: 0 }));
    const dates = posts
        .map(p => p.createdAt ? new Date(p.createdAt) : null)
        .filter(Boolean);

    dates.forEach((d, i) => {
        const day = d.getDay();
        dayBuckets[day].count++;
        dayBuckets[day].score += posts[i]?.score ?? 0;
        dayBuckets[day].comments += posts[i]?.numComments ?? 0;
        const h = d.getHours();
        hourBuckets[h].count++;
        hourBuckets[h].score += posts[i]?.score ?? 0;
    });

    const postsByDayOfWeek = dayBuckets.map((b, i) => ({
        day: dayNames[i], shortDay: dayNames[i].slice(0, 3),
        posts: b.count,
        avgScore: b.count > 0 ? Math.round(b.score / b.count) : 0,
        avgComments: b.count > 0 ? Math.round(b.comments / b.count) : 0,
    }));
    const bestDayObj = postsByDayOfWeek.reduce(
        (best, d) => d.posts > best.posts ? d : best,
        postsByDayOfWeek[0]
    );

    const postsByHour = hourBuckets.map((b, i) => ({
        hour: i, label: `${i}:00`,
        posts: b.count,
        avgScore: b.count > 0 ? Math.round(b.score / b.count) : 0,
    }));
    const bestHourObj = postsByHour.reduce(
        (best, h) => h.posts > best.posts ? h : best,
        postsByHour[0]
    );

    // Monthly breakdown
    const monthMap = {};
    posts.forEach(p => {
        if (!p.createdAt) return;
        const d = new Date(p.createdAt);
        if (isNaN(d)) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthMap[key]) monthMap[key] = { posts: 0, score: 0, comments: 0 };
        monthMap[key].posts++;
        monthMap[key].score += p.score;
        monthMap[key].comments += p.numComments;
    });
    const monthlyBreakdown = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, s]) => ({
            month, posts: s.posts, score: s.score, comments: s.comments,
            avgScore: s.posts > 0 ? Math.round(s.score / s.posts) : 0,
        }));

    // Recency counts
    const now = Date.now();
    const postsLast7Days  = dates.filter(d => (now - d.getTime()) <= 7  * 86400000).length;
    const postsLast30Days = dates.filter(d => (now - d.getTime()) <= 30 * 86400000).length;
    const postsLast90Days = dates.filter(d => (now - d.getTime()) <= 90 * 86400000).length;

    // Post frequency
    let perWeek = 0, perMonth = 0;
    if (dates.length >= 2) {
        const newest = Math.max(...dates.map(d => d.getTime()));
        const oldest = Math.min(...dates.map(d => d.getTime()));
        const spanDays = Math.max(1, (newest - oldest) / 86400000);
        perWeek  = parseFloat((posts.length / spanDays * 7).toFixed(1));
        perMonth = parseFloat((posts.length / spanDays * 30).toFixed(1));
    }

    // Virality and consistency - only meaningful when scores are available
    const apiRestricted = profile?.apiRestricted ?? false;
    const bestScore = byScore[0]?.score ?? 0;
    const viralityScore = (!apiRestricted && avgScore > 0) ? parseFloat((bestScore / avgScore).toFixed(1)) : 0;

    let consistencyScore = 0;
    if (!apiRestricted && posts.length >= 3) {
        const scores = posts.map(p => p.score);
        const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
        const variance = scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        const cv = mean > 0 ? stdDev / mean : (stdDev > 0 ? 10 : 0);
        consistencyScore = Math.max(0, Math.min(100, Math.round(100 / (1 + cv))));
    }

    return {
        fetchedPosts: posts.length,
        totalScore, avgScore, medianScore,
        totalComments, avgComments, avgUpvoteRatio,
        topPosts: byScore.slice(0, 10),
        worstPosts: byScore.slice(-5).reverse(),
        subredditBreakdown,
        mediaTypeDistribution,
        postsByDayOfWeek, bestPostingDay: bestDayObj?.day ?? '',
        postsByHour,      bestPostingHour: bestHourObj?.posts > 0 ? bestHourObj.label : '',
        monthlyBreakdown, engagementTimeline: monthlyBreakdown,
        postsLast7Days, postsLast30Days, postsLast90Days,
        postFrequency: { perWeek, perMonth },
        viralityScore, consistencyScore,
        apiRestricted,
    };
}

// Strips the session cookie before any API response - treat it like an access token.
// Exposes hasCookie as a boolean so the frontend can show session status without the value.
export function safeRedditAccount(account) {
    const copy = { ...account };
    copy.hasCookie = !!copy.cookie;
    delete copy.cookie;
    delete copy.encryptedPassword;
    delete copy.encryptedTotpSecret;
    return copy;
}

// No-op: Reddit auto-refresh via automated login is not supported from server IPs.
// Reddit's login endpoint (ssl.reddit.com/api/login) blocks datacenter IPs.
// Session cookies must be refreshed manually by the user via the Account Manager.
export async function autoRefreshRedditSessions() {}
