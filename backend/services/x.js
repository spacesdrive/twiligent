// X (Twitter) internal GraphQL API access via session cookies.
// Requires auth_token + ct0 from a logged-in x.com browser session.
// The bearer token below is X's own web client token and has been stable for years.
// Query IDs rotate when X deploys frontend changes - update X_QUERY_IDS when that happens.

const X_BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I6BeUge4%2Brkgmgd4%2FRwvXXGPvJQ8bGVNHSqcLRGrC%2FoLqEQ%3D';

// GraphQL query IDs change when X rotates its web client. Update here if requests return 400.
const X_QUERY_IDS = {
    UserByScreenName: 'qW5u-DAuXpMEG0zaGVs2dA',
    UserTweets: 'V7H0Ap3_Hh2FyS75OCDO3Q',
};

// Minimal feature flags - required by X's GraphQL alongside variables.
const PROFILE_FEATURES = JSON.stringify({
    hidden_profile_likes_enabled: true,
    hidden_profile_subscriptions_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    subscriptions_verification_info_is_identity_verified_enabled: true,
    subscriptions_verification_info_verified_since_enabled: true,
    highlights_tweets_tab_ui_enabled: true,
    responsive_web_twitter_article_notes_tab_enabled: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true,
});

const TWEETS_FEATURES = JSON.stringify({
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    rweb_video_timestamps_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_enhance_cards_enabled: false,
});

function xHeaders(authToken, ct0) {
    return {
        'Authorization': `Bearer ${decodeURIComponent(X_BEARER)}`,
        'x-csrf-token': ct0,
        'Cookie': `auth_token=${authToken}; ct0=${ct0}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'x-twitter-client-language': 'en',
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session',
    };
}

async function xFetch(url, authToken, ct0) {
    const res = await fetch(url, { headers: xHeaders(authToken, ct0) });

    if (res.status === 400) throw new Error('X API query ID is outdated - update X_QUERY_IDS in backend/services/x.js');
    if (res.status === 401) throw new Error('X session cookies are invalid or expired - open x.com in your browser, get fresh auth_token and ct0 values from DevTools, and re-add this account');
    if (res.status === 403) throw new Error('X rejected the request - your auth_token may be expired or your account may be suspended');
    if (res.status === 429) throw new Error('X rate limit reached - wait a few minutes and try again');
    if (!res.ok) throw new Error(`X API ${res.status}: ${res.statusText}`);

    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors[0].message || 'X API error');
    return json;
}

export async function fetchXProfile(username, authToken, ct0) {
    const variables = JSON.stringify({
        screen_name: username,
        withSafetyModeUserFields: true,
    });
    const url = `https://api.x.com/graphql/${X_QUERY_IDS.UserByScreenName}/UserByScreenName?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(PROFILE_FEATURES)}`;
    const data = await xFetch(url, authToken, ct0);

    const u = (
        data?.data?.user_result_by_screen_name?.result?.legacy ||
        data?.data?.user?.result?.legacy
    );
    const core = (
        data?.data?.user_result_by_screen_name?.result ||
        data?.data?.user?.result
    );

    if (!u) throw new Error('X user not found - check the username');
    if (u.protected && !authToken) throw new Error('This X account is protected - a session cookie from the account owner is required');

    return {
        username: u.screen_name,
        displayName: u.name || u.screen_name,
        description: u.description || '',
        location: u.location || '',
        website: u.entities?.url?.urls?.[0]?.expanded_url || u.url || '',
        followersCount: u.followers_count ?? 0,
        followingCount: u.friends_count ?? 0,
        tweetCount: u.statuses_count ?? 0,
        listedCount: u.listed_count ?? 0,
        profileImageUrl: (u.profile_image_url_https || '').replace('_normal', '_400x400'),
        bannerUrl: u.profile_banner_url || '',
        createdAt: u.created_at ? new Date(u.created_at).toISOString() : '',
        isProtected: u.protected ?? false,
        verifiedType: core?.affiliates_highlighted_label?.label?.userLabelType ||
            (u.verified ? 'LegacyVerified' : (core?.is_blue_verified ? 'BlueVerified' : 'none')),
    };
}

export async function fetchXTweets(username, authToken, ct0, limit = 200) {
    // First resolve the userId from the profile query
    const profileVariables = JSON.stringify({ screen_name: username, withSafetyModeUserFields: true });
    const profileUrl = `https://api.x.com/graphql/${X_QUERY_IDS.UserByScreenName}/UserByScreenName?variables=${encodeURIComponent(profileVariables)}&features=${encodeURIComponent(PROFILE_FEATURES)}`;
    const profileData = await xFetch(profileUrl, authToken, ct0);

    const userId = (
        profileData?.data?.user_result_by_screen_name?.result?.rest_id ||
        profileData?.data?.user?.result?.rest_id
    );
    if (!userId) throw new Error('Could not resolve X user ID');

    const tweets = [];
    let cursor = null;
    let pages = 0;

    while (pages < 10 && tweets.length < limit) {
        const variables = JSON.stringify({
            userId,
            count: Math.min(20, limit - tweets.length),
            includePromotedContent: false,
            withQuickPromoteEligibilityTweetFields: true,
            withVoice: true,
            withV2Timeline: true,
            ...(cursor ? { cursor } : {}),
        });

        const url = `https://api.x.com/graphql/${X_QUERY_IDS.UserTweets}/UserTweets?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(TWEETS_FEATURES)}`;
        const data = await xFetch(url, authToken, ct0);

        const instructions = data?.data?.user?.result?.timeline_v2?.timeline?.instructions ?? [];
        const timelineAddEntries = instructions.find(i => i.type === 'TimelineAddEntries');
        const entries = timelineAddEntries?.entries ?? [];

        let foundCursor = null;
        for (const entry of entries) {
            const content = entry.content;
            if (!content) continue;

            if (content.entryType === 'TimelineTimelineCursor' && content.cursorType === 'Bottom') {
                foundCursor = content.value;
                continue;
            }

            const tweet = content?.itemContent?.tweet_results?.result?.legacy ||
                          content?.itemContent?.tweet_results?.result?.tweet?.legacy;
            const tweetResult = content?.itemContent?.tweet_results?.result ||
                                content?.itemContent?.tweet_results?.result?.tweet;

            if (!tweet || !tweetResult) continue;

            const tweetId = tweetResult.rest_id || tweetResult.tweet?.rest_id;
            tweets.push({
                id: tweetId || entry.entryId,
                text: tweet.full_text || tweet.text || '',
                createdAt: tweet.created_at ? new Date(tweet.created_at).toISOString() : '',
                likeCount: tweet.favorite_count ?? 0,
                retweetCount: tweet.retweet_count ?? 0,
                replyCount: tweet.reply_count ?? 0,
                quoteCount: tweet.quote_count ?? 0,
                bookmarkCount: tweet.bookmark_count ?? 0,
                // views.count is available for authenticated requests on own account
                impressionCount: parseInt(tweetResult.views?.count ?? tweetResult.tweet?.views?.count ?? 0, 10) || 0,
                isRetweet: !!tweet.retweeted_status_id_str,
                isReply: !!tweet.in_reply_to_status_id_str,
                isQuote: tweet.is_quote_status ?? false,
                lang: tweet.lang || '',
                permalink: tweetId ? `https://x.com/${username}/status/${tweetId}` : '',
                mediaType: tweet.entities?.media?.[0]?.type || (tweet.entities?.urls?.length ? 'link' : 'text'),
            });
        }

        cursor = foundCursor;
        if (!cursor || entries.length < 3) break;
        pages++;
    }

    return tweets.slice(0, limit);
}

export function computeXAnalytics(profile, tweets) {
    const empty = {
        fetchedTweets: 0, totalLikes: 0, avgLikes: 0,
        totalRetweets: 0, avgRetweets: 0, totalReplies: 0, avgReplies: 0,
        totalQuotes: 0, totalBookmarks: 0, totalImpressions: 0, avgImpressions: 0,
        engagementRate: 0, avgEngagement: 0,
        topTweets: [], tweetTypeDistribution: {},
        postsByDayOfWeek: [], postsByHour: [], monthlyBreakdown: [],
        postsLast7Days: 0, postsLast30Days: 0, postsLast90Days: 0,
        postFrequency: { perWeek: 0, perMonth: 0 },
        viralityScore: 0, consistencyScore: 0,
        bestPostingDay: '', bestPostingHour: '',
    };

    if (!tweets || tweets.length === 0) return empty;

    const ownTweets = tweets.filter(t => !t.isRetweet);

    const totalLikes      = ownTweets.reduce((s, t) => s + t.likeCount, 0);
    const totalRetweets   = ownTweets.reduce((s, t) => s + t.retweetCount, 0);
    const totalReplies    = ownTweets.reduce((s, t) => s + t.replyCount, 0);
    const totalQuotes     = ownTweets.reduce((s, t) => s + t.quoteCount, 0);
    const totalBookmarks  = ownTweets.reduce((s, t) => s + t.bookmarkCount, 0);
    const totalImpressions = ownTweets.reduce((s, t) => s + t.impressionCount, 0);

    const n = ownTweets.length || 1;
    const avgLikes       = Math.round(totalLikes / n);
    const avgRetweets    = Math.round(totalRetweets / n);
    const avgReplies     = Math.round(totalReplies / n);
    const avgImpressions = Math.round(totalImpressions / n);
    const avgEngagement  = Math.round((totalLikes + totalRetweets + totalReplies) / n);
    const engagementRate = profile.followersCount > 0
        ? parseFloat(((avgLikes + avgRetweets + avgReplies) / profile.followersCount * 100).toFixed(2))
        : 0;

    // Tweet type distribution
    const tweetTypeDistribution = { tweet: 0, retweet: 0, reply: 0, quote: 0 };
    tweets.forEach(t => {
        if (t.isRetweet)      tweetTypeDistribution.retweet++;
        else if (t.isReply)   tweetTypeDistribution.reply++;
        else if (t.isQuote)   tweetTypeDistribution.quote++;
        else                  tweetTypeDistribution.tweet++;
    });

    // Day of week and hour analysis (own tweets only)
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayBuckets  = Array(7).fill(null).map(() => ({ count: 0, likes: 0, impressions: 0 }));
    const hourBuckets = Array(24).fill(null).map(() => ({ count: 0, likes: 0, impressions: 0 }));
    const dates = ownTweets.map(t => t.createdAt ? new Date(t.createdAt) : null).filter(Boolean);

    dates.forEach((d, i) => {
        const t = ownTweets[i];
        const day = d.getDay();
        dayBuckets[day].count++;
        dayBuckets[day].likes += t?.likeCount ?? 0;
        dayBuckets[day].impressions += t?.impressionCount ?? 0;
        const h = d.getHours();
        hourBuckets[h].count++;
        hourBuckets[h].likes += t?.likeCount ?? 0;
        hourBuckets[h].impressions += t?.impressionCount ?? 0;
    });

    const postsByDayOfWeek = dayBuckets.map((b, i) => ({
        day: dayNames[i], shortDay: dayNames[i].slice(0, 3),
        posts: b.count,
        avgLikes: b.count > 0 ? Math.round(b.likes / b.count) : 0,
        avgImpressions: b.count > 0 ? Math.round(b.impressions / b.count) : 0,
    }));
    const bestDay = postsByDayOfWeek.reduce((best, d) => d.avgLikes > best.avgLikes ? d : best, postsByDayOfWeek[0]);

    const postsByHour = hourBuckets.map((b, i) => ({
        hour: i, label: `${i}:00`,
        posts: b.count,
        avgLikes: b.count > 0 ? Math.round(b.likes / b.count) : 0,
        avgImpressions: b.count > 0 ? Math.round(b.impressions / b.count) : 0,
    }));
    const bestHour = postsByHour.reduce((best, h) => h.avgLikes > best.avgLikes ? h : best, postsByHour[0]);

    // Monthly breakdown (own tweets)
    const monthMap = {};
    ownTweets.forEach(t => {
        if (!t.createdAt) return;
        const d = new Date(t.createdAt);
        if (isNaN(d)) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthMap[key]) monthMap[key] = { posts: 0, likes: 0, retweets: 0, impressions: 0 };
        monthMap[key].posts++;
        monthMap[key].likes += t.likeCount;
        monthMap[key].retweets += t.retweetCount;
        monthMap[key].impressions += t.impressionCount;
    });
    const monthlyBreakdown = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, s]) => ({
            month, posts: s.posts, likes: s.likes, retweets: s.retweets, impressions: s.impressions,
            avgLikes: Math.round(s.likes / s.posts),
        }));

    // Recency
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
        perWeek  = parseFloat((ownTweets.length / spanDays * 7).toFixed(1));
        perMonth = parseFloat((ownTweets.length / spanDays * 30).toFixed(1));
    }

    // Virality and consistency (based on likes)
    const byLikes = [...ownTweets].sort((a, b) => b.likeCount - a.likeCount);
    const bestLikes = byLikes[0]?.likeCount ?? 0;
    const viralityScore = avgLikes > 0 ? parseFloat((bestLikes / avgLikes).toFixed(1)) : 0;

    let consistencyScore = 0;
    if (ownTweets.length >= 3) {
        const likes = ownTweets.map(t => t.likeCount);
        const mean = likes.reduce((s, v) => s + v, 0) / likes.length;
        const variance = likes.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / likes.length;
        const stdDev = Math.sqrt(variance);
        const cv = mean > 0 ? stdDev / mean : (stdDev > 0 ? 10 : 0);
        consistencyScore = Math.max(0, Math.min(100, Math.round(100 / (1 + cv))));
    }

    return {
        fetchedTweets: tweets.length,
        totalLikes, avgLikes, totalRetweets, avgRetweets,
        totalReplies, avgReplies, totalQuotes, totalBookmarks,
        totalImpressions, avgImpressions,
        engagementRate, avgEngagement,
        topTweets: byLikes.slice(0, 10),
        tweetTypeDistribution,
        postsByDayOfWeek, bestPostingDay: bestDay?.day ?? '',
        postsByHour,      bestPostingHour: bestHour?.posts > 0 ? bestHour.label : '',
        monthlyBreakdown,
        postsLast7Days, postsLast30Days, postsLast90Days,
        postFrequency: { perWeek, perMonth },
        viralityScore, consistencyScore,
    };
}

// Strips auth_token and ct0 before any API response.
// Exposes hasCookie: boolean so the frontend can show session status.
export function safeXAccount(account) {
    const copy = { ...account };
    copy.hasCookie = !!(copy.authToken && copy.ct0);
    delete copy.authToken;
    delete copy.ct0;
    return copy;
}
