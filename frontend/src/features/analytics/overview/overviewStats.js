import { audienceOf } from '../../../lib/accounts.js';
import { IG_CONTENT_TYPES } from '../../../utils/instagramContent.js';

function addAccountTotals(totals, account) {
  if (account.platform === 'instagram') {
    return { ...totals, followers: totals.followers + (account.followersCount || 0), posts: totals.posts + (account.mediaCount || 0) };
  }
  if (account.platform === 'reddit') {
    return {
      ...totals,
      karma:        totals.karma        + (account.totalKarma   || 0),
      postKarma:    totals.postKarma    + (account.postKarma    || 0),
      commentKarma: totals.commentKarma + (account.commentKarma || 0),
    };
  }
  return {
    ...totals,
    subscribers: totals.subscribers + (account.subscriberCount || 0),
    views:       totals.views       + (account.viewCount       || 0),
    videos:      totals.videos      + (account.videoCount      || 0),
  };
}

export function accountTotalsOf(accounts) {
  return accounts.reduce(addAccountTotals, {
    subscribers: 0, views: 0, videos: 0, followers: 0, posts: 0, karma: 0, postKarma: 0, commentKarma: 0,
  });
}

function addInstagramCache(result, cache) {
  result.igLikes    += cache.totalLikes    ?? 0;
  result.igComments += cache.totalComments ?? 0;
  result.igViews    += cache.totalViews    ?? 0;
  IG_CONTENT_TYPES.forEach(type => {
    result.igTypes[type].count += cache.contentTypes?.[type]?.count ?? 0;
    result.igTypes[type].views += cache.contentTypes?.[type]?.views ?? 0;
  });
}

// only accounts saved as 'youtube' count here, unlike the platform splits
export function cacheTotalsOf(accounts, analyticsCache) {
  const result = {
    ytLikes: 0, ytComments: 0, igLikes: 0, igComments: 0, igViews: 0, rdPosts: 0, rdKarma: 0, rdComments: 0,
    igTypes: Object.fromEntries(IG_CONTENT_TYPES.map(type => [type, { count: 0, views: 0 }])),
  };
  accounts.forEach(account => {
    const cache = analyticsCache[account.id];
    if (!cache) return;
    if (account.platform === 'youtube') {
      result.ytLikes    += cache.totalLikes    ?? 0;
      result.ytComments += cache.totalComments ?? 0;
    } else if (account.platform === 'instagram') {
      addInstagramCache(result, cache);
    } else if (account.platform === 'reddit') {
      result.rdPosts    += cache.fetchedPosts  ?? 0;
      result.rdKarma    += cache.totalScore    ?? 0;
      result.rdComments += cache.totalComments ?? 0;
    }
  });
  return result;
}

function shareOf(part, total) {
  return total > 0 ? (part / total) * 100 : 0;
}

// tracked items are never the user's own, so they never overlap cache totals
export function summaryOf(totals, cacheTotals, trackedStats) {
  const totalContent = totals.videos + totals.posts + cacheTotals.rdPosts + trackedStats.total;
  const trackedViewTotal = trackedStats.ytViews + trackedStats.rdViews;
  const ytComments = cacheTotals.ytComments + trackedStats.ytComments;
  const rdComments = cacheTotals.rdComments + trackedStats.rdComments;
  const totalComments = ytComments + cacheTotals.igComments + rdComments;
  const redditKarma = totals.postKarma + trackedStats.rdKarma;
  const ytLikes = cacheTotals.ytLikes + trackedStats.ytLikes;
  const totalLikes = redditKarma + ytLikes + cacheTotals.igLikes;
  return {
    totalAudience: totals.subscribers + totals.followers + totals.karma,
    totalContent,
    trackedViewTotal,
    totalViews: totals.views + cacheTotals.igViews + trackedViewTotal,
    ytComments, rdComments, totalComments,
    redditKarma, ytLikes, totalLikes,
    avgCommentsPerContent: totalContent > 0 ? Math.round(totalComments / totalContent) : 0,
    commentShare: { youtube: shareOf(ytComments, totalComments), reddit: shareOf(rdComments, totalComments) },
    likeShare: { youtube: shareOf(ytLikes, totalLikes), instagram: shareOf(cacheTotals.igLikes, totalLikes) },
  };
}

function contentOf(account) {
  if (account.platform === 'instagram') return account.mediaCount || 0;
  if (account.platform === 'reddit') return account.totalKarma || 0;
  return account.viewCount || 0;
}

export function sortedByAudience(accounts) {
  return [...accounts].sort((a, b) => audienceOf(b) - audienceOf(a));
}

export function sortedByContent(accounts) {
  return [...accounts].sort((a, b) => contentOf(b) - contentOf(a));
}

export function sortedByChannelViews(ytAccounts) {
  return [...ytAccounts].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
}

export function igAccountRowsOf(igAccounts, analyticsCache) {
  return igAccounts
    .map(account => ({ account, cache: analyticsCache[account.id] }))
    .sort((x, y) => (y.cache?.totalViews ?? 0) - (x.cache?.totalViews ?? 0));
}
