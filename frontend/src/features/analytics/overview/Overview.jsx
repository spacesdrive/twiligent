import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent,
} from '@/components/ui/empty';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer,
} from 'recharts';
import StatCard from '../../../components/ui/StatCard';
import MainCard from '../../../components/MainCard';
import MetricAreaChart from '../../../components/MetricAreaChart';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, fmtNumFull, fmtPercent, timeAgo } from '../../../utils/formatters';
import {
  RefreshCw, Users, VideoIcon, ExternalLink, Camera, BarChart2,
  Tag, ThumbsUp, MessageSquare, CirclePlay, Flame, BookmarkCheck,
} from 'lucide-react';

const PLATFORM_COLORS = {
  youtube:   '#ef4444',
  instagram: '#ec4899',
  reddit:    '#f97316',
  category:  '#a855f7',
};

function PlatformBadge({ platform }) {
  const map = {
    youtube:   'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400',
    instagram: 'border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-900 dark:bg-pink-950 dark:text-pink-400',
    reddit:    'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-400',
  };
  const labels = { youtube: 'YouTube', instagram: 'Instagram', reddit: 'Reddit' };
  return (
    <Badge variant="outline" className={`text-xs ${map[platform] || ''}`}>
      {labels[platform] || platform}
    </Badge>
  );
}

export default function Overview() {
  const { accounts, loading: accountsLoading, refreshAll } = useAppContext();
  const navigate = useNavigate();

  const [overviewData, setOverviewData]   = useState({ tracked: [], analyticsCache: {} });
  const [overviewLoading, setOverviewLoading] = useState(true);

  useEffect(() => {
    api.getOverview()
      .then(data => {
        if (data && !data.error) setOverviewData(data);
      })
      .catch(() => {})
      .finally(() => setOverviewLoading(false));
  }, []);

  // When the backend returns cacheWarmed: false for any account, it has fired a background
  // analytics fetch. Auto-refresh once after 6 seconds to pick up the newly warmed data.
  const isSyncing = !overviewLoading && accounts.some(a => {
    const entry = overviewData.analyticsCache[a.id];
    return entry?.cacheWarmed === false;
  });

  useEffect(() => {
    if (!isSyncing) return;
    const timer = setTimeout(() => {
      api.getOverview()
        .then(data => { if (data && !data.error) setOverviewData(data); })
        .catch(() => {});
    }, 6000);
    return () => clearTimeout(timer);
  }, [isSyncing]);

  const loading = accountsLoading || overviewLoading;

  // Memoized so the ?? fallbacks keep a stable identity and the derived useMemos below actually cache
  const trackedContent = useMemo(() => overviewData.tracked        ?? [], [overviewData.tracked]);
  const analyticsCache = useMemo(() => overviewData.analyticsCache ?? {}, [overviewData.analyticsCache]);

  const ytAccounts     = accounts.filter(a => a.platform !== 'instagram' && a.platform !== 'reddit');
  const igAccounts     = accounts.filter(a => a.platform === 'instagram');
  const redditAccounts = accounts.filter(a => a.platform === 'reddit');

  // Account metadata totals
  const totals = useMemo(() => accounts.reduce((acc, a) => {
    if (a.platform === 'instagram') {
      return { ...acc, followers: acc.followers + (a.followersCount || 0), posts: acc.posts + (a.mediaCount || 0) };
    }
    if (a.platform === 'reddit') {
      return {
        ...acc,
        karma:        acc.karma        + (a.totalKarma    || 0),
        postKarma:    acc.postKarma    + (a.postKarma     || 0),
        commentKarma: acc.commentKarma + (a.commentKarma  || 0),
      };
    }
    return {
      ...acc,
      subscribers: acc.subscribers + (a.subscriberCount || 0),
      views:       acc.views       + (a.viewCount       || 0),
      videos:      acc.videos      + (a.videoCount      || 0),
    };
  }, { subscribers: 0, views: 0, videos: 0, followers: 0, posts: 0, karma: 0, postKarma: 0, commentKarma: 0 }), [accounts]);

  // Per-account analytics from Redis cache (populated when user visits individual analytics pages)
  const cacheTotals = useMemo(() => {
    const result = { ytLikes: 0, ytComments: 0, igLikes: 0, igComments: 0, rdPosts: 0, rdKarma: 0, rdComments: 0 };
    accounts.forEach(a => {
      const c = analyticsCache[a.id];
      if (!c) return;
      if (a.platform === 'youtube') {
        result.ytLikes    += c.totalLikes    ?? 0;
        result.ytComments += c.totalComments ?? 0;
      } else if (a.platform === 'instagram') {
        result.igLikes    += c.totalLikes    ?? 0;
        result.igComments += c.totalComments ?? 0;
      } else if (a.platform === 'reddit') {
        result.rdPosts    += c.fetchedPosts  ?? 0;
        result.rdKarma    += c.totalScore    ?? 0;
        result.rdComments += c.totalComments ?? 0;
      }
    });
    return result;
  }, [accounts, analyticsCache]);

  // Tracked content aggregates. Reddit post score is karma, so it rolls into karma totals.
  const trackedStats = useMemo(() => {
    const ytItems = trackedContent.filter(p => p.contentType === 'youtube');
    const rdItems = trackedContent.filter(p => (p.contentType || 'reddit') === 'reddit');
    return {
      total:       trackedContent.length,
      ytItems,
      rdItems,
      ytLikes:     ytItems.reduce((s, p) => s + (p.likeCount    ?? 0), 0),
      ytComments:  ytItems.reduce((s, p) => s + (p.commentCount ?? 0), 0),
      rdKarma:     rdItems.reduce((s, p) => s + (p.score        ?? 0), 0),
      rdComments:  rdItems.reduce((s, p) => s + (p.numComments  ?? 0), 0),
    };
  }, [trackedContent]);

  // ── Metric totals ──────────────────────────────────────────────────────────────

  // Total Audience = subs + followers + account karma. Tracked posts are content, not audience.
  const totalAudience = totals.subscribers + totals.followers + totals.karma;

  // Total Content = YT videos + IG posts + Reddit account posts (from cache) + tracked items
  const totalContent = totals.videos + totals.posts + cacheTotals.rdPosts + trackedStats.total;

  // Tracked items are third-party URLs the user monitors, never their own account content,
  // so cache totals and tracked totals are disjoint and sum without double-counting.
  const ytComments = cacheTotals.ytComments + trackedStats.ytComments;
  const rdComments = cacheTotals.rdComments + trackedStats.rdComments;
  const totalComments = ytComments + cacheTotals.igComments + rdComments;

  // Reddit karma = account post karma + tracked post karma
  const redditKarma = totals.postKarma + trackedStats.rdKarma;
  const ytLikes     = cacheTotals.ytLikes + trackedStats.ytLikes;
  const totalLikes  = redditKarma + ytLikes + cacheTotals.igLikes;

  const avgCommentsPerContent = totalContent > 0 ? Math.round(totalComments / totalContent) : 0;

  const commentShare = {
    youtube: totalComments > 0 ? (ytComments / totalComments) * 100 : 0,
    reddit:  totalComments > 0 ? (rdComments / totalComments) * 100 : 0,
  };

  const likeShare = {
    youtube:   totalLikes > 0 ? (ytLikes / totalLikes) * 100              : 0,
    instagram: totalLikes > 0 ? (cacheTotals.igLikes / totalLikes) * 100  : 0,
  };

  // ── Category stats for tracked content ────────────────────────────────────────
  const categoryStats = useMemo(() => {
    const withCat = trackedContent.filter(p => p.category);
    if (!withCat.length) return [];
    const map = {};
    withCat.forEach(p => {
      if (!map[p.category]) {
        map[p.category] = {
          category: p.category,
          count: 0, ytCount: 0, rdCount: 0,
          ytViews: 0, ytLikes: 0, ytComments: 0,
          rdKarma: 0, rdComments: 0,
        };
      }
      const c = map[p.category];
      c.count++;
      if (p.contentType === 'youtube') {
        c.ytCount++;
        c.ytViews    += p.viewCount    ?? 0;
        c.ytLikes    += p.likeCount    ?? 0;
        c.ytComments += p.commentCount ?? 0;
      } else {
        c.rdCount++;
        c.rdKarma    += p.score       ?? 0;
        c.rdComments += p.numComments ?? 0;
      }
    });
    return Object.values(map).sort((a, b) =>
      (b.rdKarma + b.ytViews) - (a.rdKarma + a.ytViews)
    );
  }, [trackedContent]);

  // ── Audience metric per account ────────────────────────────────────────────────
  function audienceMetric(a) {
    if (a.platform === 'instagram') return a.followersCount || 0;
    if (a.platform === 'reddit')    return a.totalKarma    || 0;
    return a.subscriberCount || 0;
  }

  function contentMetric(a) {
    if (a.platform === 'instagram') return a.mediaCount  || 0;
    if (a.platform === 'reddit')    return a.totalKarma  || 0;
    return a.viewCount || 0;
  }

  const allSortedByAudience = [...accounts].sort((a, b) => audienceMetric(b) - audienceMetric(a));
  const allSortedByContent  = [...accounts].sort((a, b) => contentMetric(b)  - contentMetric(a));

  // ── Chart data ────────────────────────────────────────────────────────────────
  const audienceChartData = useMemo(() => [
    ...ytAccounts.map(a => ({
      name:  (a.title || '').slice(0, 12) + ((a.title || '').length > 12 ? '…' : ''),
      value: a.subscriberCount || 0,
      type:  'youtube',
    })),
    ...igAccounts.map(a => ({
      name:  (a.title || a.username || '').slice(0, 12) + ((a.title || a.username || '').length > 12 ? '…' : ''),
      value: a.followersCount || 0,
      type:  'instagram',
    })),
    ...redditAccounts.map(a => ({
      name:  `u/${(a.username || '')}`.slice(0, 12),
      value: a.totalKarma || 0,
      type:  'reddit',
    })),
    ...categoryStats.map(c => ({
      name:  c.category.slice(0, 12) + (c.category.length > 12 ? '…' : ''),
      value: c.rdKarma + c.ytViews,
      type:  'category',
    })),
  ], [ytAccounts, igAccounts, redditAccounts, categoryStats]);

  // ── Comment and engagement chart data ─────────────────────────────────────────
  const commentByContentData = useMemo(() =>
    trackedContent
      .map(p => ({
        name: (p.title || p.label || p.url || '').slice(0, 16),
        comments: p.contentType === 'youtube' ? (p.commentCount ?? 0) : (p.numComments ?? 0),
      }))
      .sort((a, b) => b.comments - a.comments)
      .slice(0, 12),
    [trackedContent]
  );

  const commentByCategoryData = useMemo(() =>
    categoryStats
      .map(c => ({ name: c.category.slice(0, 16), comments: c.ytComments + c.rdComments }))
      .sort((a, b) => b.comments - a.comments),
    [categoryStats]
  );

  const karmaByAccountData = useMemo(() =>
    [...redditAccounts]
      .sort((a, b) => (b.postKarma || 0) - (a.postKarma || 0))
      .map(a => ({ name: `u/${a.username || ''}`.slice(0, 16), karma: a.postKarma || 0 })),
    [redditAccounts]
  );

  const engagementByContentData = useMemo(() =>
    trackedContent
      .map(p => ({
        name: (p.title || p.label || p.url || '').slice(0, 16),
        engagement: p.contentType === 'youtube' ? (p.likeCount ?? 0) : (p.score ?? 0),
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 12),
    [trackedContent]
  );

  function handleViewChannel(acc) {
    if (acc.platform === 'instagram') navigate(`/instagram/${acc.id}`);
    else if (acc.platform === 'reddit') navigate(`/reddit/${acc.id}`);
    else navigate(`/channel/${acc.id}`);
  }

  const tabTriggerCls = 'flex flex-col items-start gap-0 h-auto py-3 px-4 text-left w-[175px] overflow-hidden';

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {accounts.length === 0
              ? 'Add your first account to start tracking'
              : [
                  `Tracking ${accounts.length} account${accounts.length !== 1 ? 's' : ''}`,
                  ytAccounts.length     ? `${ytAccounts.length} YouTube`    : null,
                  igAccounts.length     ? `${igAccounts.length} Instagram`  : null,
                  redditAccounts.length ? `${redditAccounts.length} Reddit` : null,
                ].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isSyncing && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Syncing analytics...
            </span>
          )}
          <Button
            onClick={refreshAll}
            disabled={loading || accounts.length === 0}
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh All'}
          </Button>
        </div>
      </div>

      {loading && <Progress className="h-1" value={undefined} />}

      {accounts.length === 0 ? (
        <MainCard>
          <div className="flex flex-col items-center text-center py-12 gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Welcome to Twiligent</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Add your first YouTube channel, Instagram account, or Reddit profile to start tracking analytics
              </p>
            </div>
            <Button onClick={() => navigate('/accounts')}>Add Account</Button>
          </div>
        </MainCard>
      ) : (
        <Tabs defaultValue="audience" className="space-y-6">
          {/* Tab triggers */}
          <div className="overflow-x-auto pb-1">
            <TabsList className="w-max flex gap-1 bg-muted/50 p-1 rounded-xl" style={{ height: 'auto' }}>

              <TabsTrigger value="audience" className={tabTriggerCls}>
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate w-full">Total Audience</span>
                <span className="text-2xl font-bold tabular-nums leading-tight mt-0.5">{fmtNum(totalAudience)}</span>
                <span className="text-[11px] text-muted-foreground mt-0.5 truncate w-full">
                  {[
                    totals.subscribers   ? `${fmtNum(totals.subscribers)} subs`    : null,
                    totals.followers     ? `${fmtNum(totals.followers)} followers`  : null,
                    totals.karma         ? `${fmtNum(totals.karma)} karma`          : null,
                  ].filter(Boolean).join(' · ') || 'no data yet'}
                </span>
              </TabsTrigger>

              <TabsTrigger value="views" className={tabTriggerCls}>
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate w-full">Total Views</span>
                <span className="text-2xl font-bold tabular-nums leading-tight mt-0.5">{fmtNum(totals.views)}</span>
                <span className="text-[11px] text-muted-foreground mt-0.5 truncate w-full">
                  {ytAccounts.length > 0 ? `${ytAccounts.length} YouTube channel${ytAccounts.length !== 1 ? 's' : ''}` : 'no YouTube accounts'}
                </span>
              </TabsTrigger>

              <TabsTrigger value="content" className={tabTriggerCls}>
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate w-full">Total Content</span>
                <span className="text-2xl font-bold tabular-nums leading-tight mt-0.5">{fmtNum(totalContent)}</span>
                <span className="text-[11px] text-muted-foreground mt-0.5 truncate w-full">
                  {[
                    totals.videos       ? `${fmtNum(totals.videos)} videos`      : null,
                    totals.posts        ? `${fmtNum(totals.posts)} IG posts`      : null,
                    cacheTotals.rdPosts ? `${fmtNum(cacheTotals.rdPosts)} Reddit` : null,
                    trackedStats.total  ? `${fmtNum(trackedStats.total)} tracked` : null,
                  ].filter(Boolean).join(' · ') || 'no content yet'}
                </span>
              </TabsTrigger>

              <TabsTrigger value="accounts" className={tabTriggerCls}>
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate w-full">Accounts</span>
                <span className="text-2xl font-bold tabular-nums leading-tight mt-0.5">{accounts.length}</span>
                <span className="text-[11px] text-muted-foreground mt-0.5 truncate w-full">
                  {[
                    ytAccounts.length     ? `${ytAccounts.length} YouTube`    : null,
                    igAccounts.length     ? `${igAccounts.length} Instagram`  : null,
                    redditAccounts.length ? `${redditAccounts.length} Reddit` : null,
                  ].filter(Boolean).join(' · ')}
                </span>
              </TabsTrigger>

              <TabsTrigger value="comments" className={tabTriggerCls}>
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate w-full">Total Comments</span>
                <span className="text-2xl font-bold tabular-nums leading-tight mt-0.5">{fmtNum(totalComments)}</span>
                <span className="text-[11px] text-muted-foreground mt-0.5 truncate w-full">
                  {isSyncing ? 'syncing analytics...' : totalComments > 0 ? 'across all platforms' : 'visit analytics pages to load'}
                </span>
              </TabsTrigger>

              <TabsTrigger value="likes" className={tabTriggerCls}>
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate w-full">Total Likes</span>
                <span className="text-2xl font-bold tabular-nums leading-tight mt-0.5">{fmtNum(totalLikes)}</span>
                <span className="text-[11px] text-muted-foreground mt-0.5 truncate w-full">
                  {isSyncing ? 'syncing analytics...' : totalLikes > 0 ? 'across all platforms' : 'visit analytics pages to load'}
                </span>
              </TabsTrigger>

            </TabsList>
          </div>

          {/* ── AUDIENCE TAB ──────────────────────────────────────────────── */}
          <TabsContent value="audience" className="space-y-4">
            <MainCard title="Audience Comparison">
              <p className="text-xs text-muted-foreground mb-3">
                YouTube = subscribers · Instagram = followers · Reddit = karma · Categories = views + karma
              </p>
              {audienceChartData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No data to display</p>
              ) : (
                <ResponsiveContainer width="100%" height={260} debounce={200}>
                  <AreaChart data={audienceChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="audienceAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={fmtNum} axisLine={false} tickLine={false} width={48} />
                    <ReTooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      formatter={(v, name, props) => [fmtNumFull(v), props.payload.type === 'category' ? 'Views + Karma' : 'Audience']}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      fill="url(#audienceAreaGrad)"
                      dot={(props) => {
                        const { cx, cy, payload, index } = props;
                        return (
                          <circle
                            key={`dot-${index}`}
                            cx={cx}
                            cy={cy}
                            r={5}
                            fill={PLATFORM_COLORS[payload.type] || '#6366f1'}
                            stroke="var(--card)"
                            strokeWidth={2}
                          />
                        );
                      }}
                      activeDot={{ r: 7 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
              <div className="flex flex-wrap gap-3 mt-2">
                {[
                  ytAccounts.length     ? { color: PLATFORM_COLORS.youtube,   label: 'YouTube (subs)'        } : null,
                  igAccounts.length     ? { color: PLATFORM_COLORS.instagram, label: 'Instagram (followers)' } : null,
                  redditAccounts.length ? { color: PLATFORM_COLORS.reddit,    label: 'Reddit (karma)'        } : null,
                  categoryStats.length  ? { color: PLATFORM_COLORS.category,  label: 'Category (views + karma)' } : null,
                ].filter(Boolean).map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    {label}
                  </div>
                ))}
              </div>
            </MainCard>

            {/* Top by Audience - accounts only, no metric label */}
            <MainCard title="Top by Audience">
              <div className="space-y-1">
                {allSortedByAudience.map((a, i) => {
                  const medalColor = i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-400' : 'text-muted-foreground';
                  const fallbackBg = a.platform === 'instagram' ? 'bg-pink-500' : a.platform === 'reddit' ? 'bg-orange-500' : 'bg-red-500';
                  return (
                    <button
                      key={a.id}
                      onClick={() => handleViewChannel(a)}
                      className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-muted/60 transition-colors text-left"
                    >
                      <span className={`w-5 text-xs font-bold tabular-nums ${medalColor}`}>{i + 1}</span>
                      <Avatar className="h-7 w-7 flex-shrink-0">
                        <AvatarImage src={a.thumbnail || a.profilePictureUrl || a.thumbnails?.default || a.iconUrl} />
                        <AvatarFallback className={`text-[0.55rem] font-bold text-white ${fallbackBg}`}>
                          {(a.title || a.username || '?').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 text-sm font-medium truncate">
                        {a.platform === 'reddit' ? `u/${a.username}` : a.title}
                      </span>
                      <PlatformBadge platform={a.platform} />
                    </button>
                  );
                })}
                {categoryStats.map(stat => (
                  <button
                    key={stat.category}
                    onClick={() => navigate(`/tracked-content/category/${encodeURIComponent(stat.category)}`)}
                    className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-muted/60 transition-colors text-left"
                  >
                    <span className="w-5 text-xs font-bold tabular-nums text-muted-foreground">#</span>
                    <div className="h-7 w-7 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                      <Tag className="h-3.5 w-3.5 text-purple-500" />
                    </div>
                    <span className="flex-1 text-sm font-medium truncate">{stat.category}</span>
                    <Badge variant="outline" className="text-xs border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-400 shrink-0">
                      Category
                    </Badge>
                  </button>
                ))}
              </div>
            </MainCard>
          </TabsContent>

          {/* ── VIEWS TAB ──────────────────────────────────────────────────── */}
          <TabsContent value="views" className="space-y-4">
            {ytAccounts.length === 0 ? (
              <MainCard>
                <p className="text-sm text-muted-foreground text-center py-8">No YouTube accounts connected</p>
              </MainCard>
            ) : (
              <MainCard title="YouTube Views by Channel" content={false}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead className="text-right">Total Views</TableHead>
                      <TableHead className="text-right">Subscribers</TableHead>
                      <TableHead className="text-right">Videos</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...ytAccounts].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).map((a, i) => (
                      <TableRow key={a.id} className="cursor-pointer" onClick={() => navigate(`/channel/${a.id}`)}>
                        <TableCell>
                          <span className={`text-xs font-bold ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-400' : 'text-muted-foreground'}`}>{i + 1}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={a.thumbnail || a.thumbnails?.default} />
                              <AvatarFallback className="bg-red-500 text-xs font-bold text-white">
                                {(a.title || '?').slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-semibold leading-none">{a.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{a.customUrl || a.channelId || ''}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <p className="text-sm font-bold">{fmtNum(a.viewCount)}</p>
                          <p className="text-xs text-muted-foreground">{fmtNumFull(a.viewCount)}</p>
                        </TableCell>
                        <TableCell className="text-right text-sm">{fmtNum(a.subscriberCount)}</TableCell>
                        <TableCell className="text-right text-sm">{fmtNum(a.videoCount)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{timeAgo(a.lastUpdated)}</TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger render={<Button variant="ghost" size="icon" className="size-7" onClick={(e) => { e.stopPropagation(); navigate(`/channel/${a.id}`); }} />}>
                              <ExternalLink />
                            </TooltipTrigger>
                            <TooltipContent>View Analytics</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </MainCard>
            )}
          </TabsContent>

          {/* ── CONTENT TAB ────────────────────────────────────────────────── */}
          <TabsContent value="content" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={<CirclePlay />}    label="YouTube Videos"   value={fmtNum(totals.videos)}       subtitle={`${ytAccounts.length} channel${ytAccounts.length !== 1 ? 's' : ''}`}                                    gradient="red"    />
              <StatCard icon={<VideoIcon />}     label="Instagram Posts"  value={fmtNum(totals.posts)}        subtitle={`${igAccounts.length} account${igAccounts.length !== 1 ? 's' : ''}`}                                   gradient="blue"   />
              <StatCard icon={<Flame />}         label="Reddit Posts"     value={fmtNum(cacheTotals.rdPosts)} subtitle={cacheTotals.rdPosts > 0 ? 'from analytics cache' : 'visit Reddit analytics to load'}                   gradient="orange" />
              <StatCard icon={<BookmarkCheck />} label="Tracked Content"  value={fmtNum(trackedStats.total)}  subtitle={`${trackedStats.ytItems.length} YouTube · ${trackedStats.rdItems.length} Reddit`}                 gradient="purple" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MainCard title="Top by Content">
                <div className="space-y-1">
                  {allSortedByContent.map((a, i) => {
                    const metric = a.platform === 'instagram'
                      ? `${fmtNum(a.mediaCount)} posts`
                      : a.platform === 'reddit'
                        ? `${fmtNum(a.totalKarma)} karma`
                        : `${fmtNum(a.viewCount)} views`;
                    const fallbackBg = a.platform === 'instagram' ? 'bg-pink-500' : a.platform === 'reddit' ? 'bg-orange-500' : 'bg-red-500';
                    return (
                      <button
                        key={a.id}
                        onClick={() => handleViewChannel(a)}
                        className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-muted/60 transition-colors text-left"
                      >
                        <span className={`w-5 text-xs font-bold ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-400' : 'text-muted-foreground'}`}>{i + 1}</span>
                        <Avatar className="h-7 w-7 flex-shrink-0">
                          <AvatarImage src={a.thumbnail || a.profilePictureUrl || a.thumbnails?.default || a.iconUrl} />
                          <AvatarFallback className={`text-[0.55rem] font-bold text-white ${fallbackBg}`}>
                            {(a.title || a.username || '?').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm font-medium truncate">
                          {a.platform === 'reddit' ? `u/${a.username}` : a.title}
                        </span>
                        <span className="text-sm font-semibold text-muted-foreground tabular-nums">{metric}</span>
                      </button>
                    );
                  })}
                </div>
              </MainCard>

              <MainCard title="Tracked Categories">
                {categoryStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Assign categories to tracked content to see breakdown
                  </p>
                ) : (
                  <div className="space-y-1">
                    {categoryStats.map(stat => (
                      <button
                        key={stat.category}
                        onClick={() => navigate(`/tracked-content/category/${encodeURIComponent(stat.category)}`)}
                        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted/60 transition-colors text-left"
                      >
                        <div className="h-7 w-7 rounded-md bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                          <Tag className="h-3.5 w-3.5 text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{stat.category}</p>
                          <p className="text-xs text-muted-foreground">
                            {stat.count} item{stat.count !== 1 ? 's' : ''}
                            {stat.ytCount > 0 && ` · ${stat.ytCount} YouTube`}
                            {stat.rdCount > 0 && ` · ${stat.rdCount} Reddit`}
                          </p>
                        </div>
                        <div className="text-right">
                          {stat.ytCount > 0 && (
                            <p className="text-xs font-semibold tabular-nums text-red-500 leading-none">
                              {fmtNum(stat.ytViews)} views
                            </p>
                          )}
                          {stat.rdCount > 0 && (
                            <p className="text-xs font-semibold tabular-nums text-orange-500 leading-none mt-0.5">
                              {fmtNum(stat.rdKarma)} karma
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </MainCard>
            </div>
          </TabsContent>

          {/* ── ACCOUNTS TAB ──────────────────────────────────────────────── */}
          <TabsContent value="accounts" className="space-y-4">
            <MainCard content={false}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-center">Platform</TableHead>
                    <TableHead className="text-right">Audience</TableHead>
                    <TableHead className="text-right">Content</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allSortedByAudience.map((a, i) => {
                    const audience = a.platform === 'instagram'
                      ? `${fmtNum(a.followersCount)} followers`
                      : a.platform === 'reddit'
                        ? `${fmtNum(a.totalKarma)} karma`
                        : `${fmtNum(a.subscriberCount)} subs`;
                    const content = a.platform === 'instagram'
                      ? `${fmtNum(a.mediaCount)} posts`
                      : a.platform === 'reddit'
                        ? `${fmtNum(a.postKarma)} post karma`
                        : `${fmtNum(a.viewCount)} views · ${fmtNum(a.videoCount)} vids`;
                    const fallbackBg = a.platform === 'instagram' ? 'bg-pink-500' : a.platform === 'reddit' ? 'bg-orange-500' : 'bg-red-500';
                    const medalColor = i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-400' : 'text-muted-foreground';
                    return (
                      <TableRow key={a.id} className="cursor-pointer" onClick={() => handleViewChannel(a)}>
                        <TableCell>
                          <span className={`text-xs font-bold ${medalColor}`}>{i + 1}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={a.thumbnail || a.profilePictureUrl || a.thumbnails?.default || a.iconUrl} />
                              <AvatarFallback className={`text-xs font-bold text-white ${fallbackBg}`}>
                                {(a.title || a.username || '?').slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-semibold leading-none">
                                {a.platform === 'reddit' ? `u/${a.username}` : a.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {a.platform === 'instagram' ? `@${a.username || ''}` : a.platform === 'reddit' ? 'Reddit' : (a.customUrl || a.channelId || '')}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <PlatformBadge platform={a.platform} />
                        </TableCell>
                        <TableCell className="text-right text-sm">{audience}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{content}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{timeAgo(a.lastUpdated)}</TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger render={<Button variant="ghost" size="icon" className="size-7" onClick={(e) => { e.stopPropagation(); handleViewChannel(a); }} />}>
                              <ExternalLink />
                            </TooltipTrigger>
                            <TooltipContent>View Analytics</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </MainCard>
          </TabsContent>

          {/* ── COMMENTS TAB ──────────────────────────────────────────────── */}
          <TabsContent value="comments" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard icon={<MessageSquare />} label="Total Comments"       value={fmtNum(totalComments)}         subtitle={totalComments > 0 ? 'across all platforms' : 'visit analytics pages to load'}                       gradient="blue"   />
              <StatCard icon={<CirclePlay />}    label="YouTube Comments"     value={fmtNum(ytComments)}            subtitle={`${fmtPercent(commentShare.youtube)} of all comments`}                                              gradient="red"    />
              <StatCard icon={<Flame />}         label="Reddit Comments"      value={fmtNum(rdComments)}            subtitle={`${fmtPercent(commentShare.reddit)} of all comments`}                                               gradient="orange" />
              <StatCard icon={<BarChart2 />}     label="Comments per Content" value={fmtNum(avgCommentsPerContent)} subtitle={`average across ${fmtNum(totalContent)} item${totalContent !== 1 ? 's' : ''}`}                       gradient="purple" />
            </div>

            {totalComments === 0 ? (
              <MainCard>
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <MessageSquare />
                    </EmptyMedia>
                    <EmptyTitle>No comment data yet</EmptyTitle>
                    <EmptyDescription>
                      Open a channel or account analytics page to load its comment data, or track individual posts and videos.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button size="sm" onClick={() => navigate('/tracked-content')}>Track Content</Button>
                  </EmptyContent>
                </Empty>
              </MainCard>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <MainCard
                  title="Comments by Tracked Content"
                  subheader="Top 12 tracked items ranked by comment count"
                >
                  <MetricAreaChart
                    data={commentByContentData}
                    dataKey="comments"
                    label="Comments"
                    color="#06b6d4"
                    emptyMessage="Track content to compare comment volume"
                  />
                </MainCard>

                <MainCard
                  title="Comments by Category"
                  subheader="Total comments across every item in each category"
                >
                  <MetricAreaChart
                    data={commentByCategoryData}
                    dataKey="comments"
                    label="Comments"
                    color="#a855f7"
                    emptyMessage="Assign categories to tracked content to see this breakdown"
                  />
                </MainCard>
              </div>
            )}
          </TabsContent>

          {/* ── LIKES TAB ──────────────────────────────────────────────────── */}
          <TabsContent value="likes" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard icon={<ThumbsUp />}   label="Total Likes"      value={fmtNum(totalLikes)}     subtitle={totalLikes > 0 ? 'YouTube likes, Instagram likes, Reddit karma' : 'visit analytics pages to load'} gradient="purple" />
              <StatCard icon={<Flame />}      label="Reddit Karma"     value={fmtNum(redditKarma)}    subtitle={`${fmtNum(totals.postKarma)} account · ${fmtNum(trackedStats.rdKarma)} tracked`}                    gradient="orange" />
              <StatCard icon={<CirclePlay />} label="YouTube Likes"    value={fmtNum(ytLikes)}        subtitle={`${fmtPercent(likeShare.youtube)} of all likes`}                                                     gradient="red"    />
              <StatCard icon={<Camera />}     label="Instagram Likes"  value={fmtNum(cacheTotals.igLikes)} subtitle={igAccounts.length > 0 ? `${fmtPercent(likeShare.instagram)} of all likes` : 'no Instagram accounts'} gradient="pink" />
            </div>

            {totalLikes === 0 ? (
              <MainCard>
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ThumbsUp />
                    </EmptyMedia>
                    <EmptyTitle>No engagement data yet</EmptyTitle>
                    <EmptyDescription>
                      Open a channel or account analytics page to load its like data, or track individual posts and videos.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button size="sm" onClick={() => navigate('/tracked-content')}>Track Content</Button>
                  </EmptyContent>
                </Empty>
              </MainCard>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <MainCard
                  title="Karma by Reddit Account"
                  subheader="Post karma earned by each connected account"
                >
                  <MetricAreaChart
                    data={karmaByAccountData}
                    dataKey="karma"
                    label="Post karma"
                    color="#f97316"
                    emptyMessage="Connect a Reddit account to see karma"
                  />
                </MainCard>

                <MainCard
                  title="Engagement by Tracked Content"
                  subheader="YouTube likes and Reddit karma for the top 12 tracked items"
                >
                  <MetricAreaChart
                    data={engagementByContentData}
                    dataKey="engagement"
                    label="Likes / karma"
                    color="#a855f7"
                    emptyMessage="Track content to compare engagement"
                  />
                </MainCard>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
