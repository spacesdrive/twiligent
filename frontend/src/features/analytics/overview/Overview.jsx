import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
} from 'recharts';
import {
  RefreshCw, Users, VideoIcon, Camera, BarChart2, Eye, Tag, ThumbsUp, MessageSquare, CirclePlay,
  MessagesSquare, BookmarkCheck, Bookmark, Send, Plus, PlaySquare, Scissors, Clapperboard, ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import PageHeader from '@/components/PageHeader';
import MetricBox from '@/components/MetricBox';
import SurfaceBox from '@/components/SurfaceBox';
import MetricAreaChart from '@/components/MetricAreaChart';
import ListRow, { RankNumber } from '@/components/ListRow';
import { EmptyState } from '@/components/StateViews';
import { AccountAvatar, PlatformBadge } from '@/components/platform';
import { PLATFORM_META, accountHandle, accountName, accountPath, platformOf, platformSummary } from '@/lib/accounts';
import { SERIES, axisProps, gridProps, tooltipStyle } from '@/lib/chart';
import { useAppContext } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../services/api';
import { fmtNum, fmtNumFull, fmtPercent, timeAgo } from '../../../utils/formatters';
import { trackedViews } from '../../../utils/trackedContent';
import { IG_CONTENT_TYPES, IG_CONTENT_TYPE_META } from '../../../utils/instagramContent';
import { cn } from '@/lib/utils';

const CATEGORY_SERIES = SERIES.neutral;
const SYNC_POLL_DELAYS = [4000, 8000, 16000];

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Overview() {
  const { accounts, loading: accountsLoading, refreshAll } = useAppContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('audience');

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

  // The backend reports syncing: true for accounts whose analytics it started fetching in the
  // background. Re-poll with backoff, and give up after a few tries so the label never hangs.
  const [syncPolls, setSyncPolls] = useState(0);
  const isSyncing = !overviewLoading && syncPolls < SYNC_POLL_DELAYS.length && accounts.some(a => {
    return overviewData.analyticsCache[a.id]?.syncing === true;
  });

  useEffect(() => {
    if (!isSyncing) return undefined;
    const timer = setTimeout(() => {
      api.getOverview()
        .then(data => { if (data && !data.error) setOverviewData(data); })
        .catch(() => {})
        .finally(() => setSyncPolls(n => n + 1));
    }, SYNC_POLL_DELAYS[syncPolls]);
    return () => clearTimeout(timer);
  }, [isSyncing, syncPolls]);

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
    const result = {
      ytLikes: 0, ytComments: 0, igLikes: 0, igComments: 0, igViews: 0, rdPosts: 0, rdKarma: 0, rdComments: 0,
      igTypes: Object.fromEntries(IG_CONTENT_TYPES.map(t => [t, { count: 0, views: 0 }])),
    };
    accounts.forEach(a => {
      const c = analyticsCache[a.id];
      if (!c) return;
      if (a.platform === 'youtube') {
        result.ytLikes    += c.totalLikes    ?? 0;
        result.ytComments += c.totalComments ?? 0;
      } else if (a.platform === 'instagram') {
        result.igLikes    += c.totalLikes    ?? 0;
        result.igComments += c.totalComments ?? 0;
        result.igViews    += c.totalViews    ?? 0;
        IG_CONTENT_TYPES.forEach(t => {
          result.igTypes[t].count += c.contentTypes?.[t]?.count ?? 0;
          result.igTypes[t].views += c.contentTypes?.[t]?.views ?? 0;
        });
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
      ytViews:     ytItems.reduce((s, p) => s + trackedViews(p), 0),
      ytLikes:     ytItems.reduce((s, p) => s + (p.likeCount    ?? 0), 0),
      ytComments:  ytItems.reduce((s, p) => s + (p.commentCount ?? 0), 0),
      rdViews:     rdItems.reduce((s, p) => s + trackedViews(p), 0),
      rdKarma:     rdItems.reduce((s, p) => s + (p.score        ?? 0), 0),
      rdComments:  rdItems.reduce((s, p) => s + (p.numComments  ?? 0), 0),
    };
  }, [trackedContent]);

  // ── Metric totals ──────────────────────────────────────────────────────────────

  // Total Audience = subs + followers + account karma. Tracked posts are content, not audience.
  const totalAudience = totals.subscribers + totals.followers + totals.karma;

  // Total Content = YT videos + IG posts + Reddit account posts (from cache) + tracked items
  const totalContent = totals.videos + totals.posts + cacheTotals.rdPosts + trackedStats.total;

  // Total Views = YouTube channel views + Instagram reel, post, and video views + tracked views
  const trackedViewTotal = trackedStats.ytViews + trackedStats.rdViews;
  const totalViews = totals.views + cacheTotals.igViews + trackedViewTotal;
  const igTypeSummary = (field) => IG_CONTENT_TYPES
    .map(t => `${fmtNum(cacheTotals.igTypes[t][field])} ${IG_CONTENT_TYPE_META[t].plural.toLowerCase()}`)
    .join(', ');
  const igAccountRows = igAccounts
    .map(a => ({ account: a, cache: analyticsCache[a.id] }))
    .sort((x, y) => (y.cache?.totalViews ?? 0) - (x.cache?.totalViews ?? 0));

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
          rdViews: 0, rdKarma: 0, rdComments: 0,
        };
      }
      const c = map[p.category];
      c.count++;
      if (p.contentType === 'youtube') {
        c.ytCount++;
        c.ytViews    += trackedViews(p);
        c.ytLikes    += p.likeCount    ?? 0;
        c.ytComments += p.commentCount ?? 0;
      } else {
        c.rdCount++;
        c.rdViews    += trackedViews(p);
        c.rdKarma    += p.score       ?? 0;
        c.rdComments += p.numComments ?? 0;
      }
    });
    return Object.values(map)
      .map(c => ({ ...c, views: c.ytViews + c.rdViews }))
      .sort((a, b) => (b.views + b.rdKarma) - (a.views + a.rdKarma));
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
    // Karma only. Adding views would mix an audience metric with a reach metric and
    // inflate the category far above the accounts it sits beside.
    ...categoryStats.map(c => ({
      name:  c.category.slice(0, 12) + (c.category.length > 12 ? '…' : ''),
      value: c.rdKarma,
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

  const categoryViewData = useMemo(() =>
    categoryStats
      .map(c => ({ name: c.category.slice(0, 16), views: c.views }))
      .sort((a, b) => b.views - a.views),
    [categoryStats]
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
    navigate(accountPath(acc));
  }

  const firstName = (user?.email || '').split('@')[0].split(/[._-]/)[0];
  const greetingName = firstName ? firstName[0].toUpperCase() + firstName.slice(1) : '';

  const metricTabs = [
    {
      value: 'audience', label: 'Audience', value_: fmtNum(totalAudience),
      detail: [
        totals.subscribers ? `${fmtNum(totals.subscribers)} subscribers` : null,
        totals.followers   ? `${fmtNum(totals.followers)} followers`     : null,
        totals.karma       ? `${fmtNum(totals.karma)} karma`             : null,
      ].filter(Boolean).join(', ') || 'No data yet',
    },
    {
      value: 'views', label: 'Views', value_: fmtNum(totalViews),
      detail: [
        totals.views        ? `${fmtNum(totals.views)} YouTube`          : null,
        cacheTotals.igViews ? `${fmtNum(cacheTotals.igViews)} Instagram` : null,
        trackedViewTotal    ? `${fmtNum(trackedViewTotal)} tracked`      : null,
      ].filter(Boolean).join(', ') || 'No views recorded yet',
    },
    {
      value: 'content', label: 'Content', value_: fmtNum(totalContent),
      detail: [
        totals.videos       ? `${fmtNum(totals.videos)} videos`        : null,
        totals.posts        ? `${fmtNum(totals.posts)} Instagram`      : null,
        cacheTotals.rdPosts ? `${fmtNum(cacheTotals.rdPosts)} Reddit`  : null,
        trackedStats.total  ? `${fmtNum(trackedStats.total)} tracked`  : null,
      ].filter(Boolean).join(', ') || 'No content yet',
    },
    { value: 'accounts', label: 'Accounts', value_: accounts.length, detail: platformSummary(accounts) },
    {
      value: 'comments', label: 'Comments', value_: fmtNum(totalComments),
      detail: isSyncing ? 'Syncing analytics' : totalComments > 0 ? 'Across all platforms' : 'Open an analytics page to load',
    },
    {
      value: 'likes', label: 'Likes', value_: fmtNum(totalLikes),
      detail: isSyncing ? 'Syncing analytics' : totalLikes > 0 ? 'Across all platforms' : 'Open an analytics page to load',
    },
  ];

  const quickActions = [
    { to: '/upload',          label: 'Publish',         icon: Send },
    { to: '/accounts?add=1',  label: 'Add account',     icon: Plus },
    { to: '/tracked-content', label: 'Track content',   icon: Bookmark },
    { to: '/videos',          label: 'Videos',          icon: PlaySquare },
    { to: '/shorts',          label: 'Shorts',          icon: Scissors },
    { to: '/reels',           label: 'Instagram',       icon: Clapperboard },
    { to: '/reddit-posts',    label: 'Reddit',          icon: MessagesSquare },
  ];

  const accountRow = (a, i, trailing) => (
    <ListRow
      key={a.id}
      onClick={() => handleViewChannel(a)}
      leading={<><RankNumber rank={i + 1} /><AccountAvatar account={a} showPlatform /></>}
      title={accountName(a)}
      meta={accountHandle(a)}
      trailing={trailing}
    />
  );

  const categoryRow = (stat, trailing) => (
    <ListRow
      key={stat.category}
      onClick={() => navigate(`/tracked-content/category/${encodeURIComponent(stat.category)}`)}
      leading={<><span className="w-5 shrink-0" /><span className="flex size-8 items-center justify-center rounded-control bg-surface-sunken text-ink-muted"><Tag className="size-4 stroke-[1.75]" /></span></>}
      title={stat.category}
      meta={[`${stat.count} item${stat.count !== 1 ? 's' : ''}`, stat.ytCount > 0 && `${stat.ytCount} YouTube`, stat.rdCount > 0 && `${stat.rdCount} Reddit`].filter(Boolean).join(', ')}
      trailing={trailing}
    />
  );

  const legend = [
    ytAccounts.length     ? { color: PLATFORM_META.youtube.series,   label: 'YouTube subscribers' } : null,
    igAccounts.length     ? { color: PLATFORM_META.instagram.series, label: 'Instagram followers' } : null,
    redditAccounts.length ? { color: PLATFORM_META.reddit.series,    label: 'Reddit karma' }        : null,
    categoryStats.length  ? { color: CATEGORY_SERIES,                label: 'Category karma' }      : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        size="display"
        title={greetingName ? `${greeting()}, ${greetingName}` : greeting()}
        description={accounts.length === 0
          ? 'Add your first account to start tracking.'
          : `Tracking ${accounts.length} account${accounts.length !== 1 ? 's' : ''}: ${platformSummary(accounts)}.`}
        actions={
          <>
            {isSyncing && (
              <span className="flex items-center gap-1.5 text-small text-ink-muted" role="status">
                <RefreshCw className="size-3.5 animate-spin" />
                Syncing analytics
              </span>
            )}
            <Button onClick={refreshAll} disabled={loading || accounts.length === 0} variant="outline">
              <RefreshCw data-icon="inline-start" className={cn(loading && 'animate-spin')} />
              {loading ? 'Refreshing' : 'Refresh all'}
            </Button>
          </>
        }
      />

      <nav aria-label="Quick actions" className="grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-7">
        {quickActions.map(action => {
          const Icon = action.icon;
          return (
          <Link
            key={action.to}
            to={action.to}
            className="group flex flex-col items-center gap-2 rounded-card py-2 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="flex size-12 items-center justify-center rounded-card bg-surface-wash text-ink-muted transition-colors duration-(--duration-base) group-hover:bg-surface-selected group-hover:text-ink">
              <Icon className="size-5 stroke-[1.75]" />
            </span>
            <span className="text-small font-medium text-ink">{action.label}</span>
          </Link>
          );
        })}
      </nav>

      {loading && <Progress value={null} aria-label="Loading accounts" />}

      {accounts.length === 0 ? (
        <section className="relative overflow-hidden rounded-panel border border-line bg-surface-raised">
          <div aria-hidden="true" className="fold-band absolute inset-y-0 right-0 hidden w-2/5 [clip-path:polygon(35%_0,100%_0,100%_100%,0_100%)] md:block" />
          <div className="relative flex max-w-xl flex-col gap-4 p-8">
            <p className="eyebrow text-brand-text">Getting started</p>
            <h2 className="font-heading text-page-title font-semibold text-ink">Bring your channels into one picture.</h2>
            <p className="text-sm text-ink-muted">Add a YouTube channel, connect an Instagram Business or Creator account, or add a Reddit profile. Analytics start filling in as soon as an account is added.</p>
            <div><Button render={<Link to="/accounts?add=1" />}><Plus data-icon="inline-start" />Add an account</Button></div>
          </div>
        </section>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-6">
          <TabsList
            variant="none"
            aria-label="Overview metrics"
            className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
          >
            {metricTabs.map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="h-auto min-w-0 flex-col items-start justify-start gap-1 rounded-card border border-line bg-surface-raised p-4 text-left after:hidden hover:border-line-strong/40 data-active:border-brand data-active:bg-brand-soft/40"
              >
                <span className="text-small font-medium text-ink-muted">{tab.label}</span>
                <span className="font-heading text-2xl font-semibold tracking-[-0.02em] text-ink tabular-nums">{tab.value_}</span>
                <span className="w-full truncate text-caption font-normal text-ink-faint">{tab.detail}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="audience" className="flex flex-col gap-4">
            <SurfaceBox title="Audience by account" subheader="Subscribers, followers and karma, plus karma earned by each tracked category">
              {audienceChartData.length === 0 ? (
                <EmptyState compact icon={<Users />} title="No audience data yet" description="Refresh your accounts to load subscriber and follower counts." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={260} debounce={200}>
                    <AreaChart data={audienceChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="audienceAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="var(--chart-1)" stopOpacity={0.22} />
                          <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...gridProps} vertical={false} />
                      <XAxis dataKey="name" {...axisProps} />
                      <YAxis {...axisProps} tickFormatter={fmtNum} width={48} />
                      <ReTooltip
                        contentStyle={tooltipStyle}
                        cursor={{ stroke: 'var(--line-strong)' }}
                        formatter={(v, name, props) => [fmtNumFull(v), props.payload.type === 'category' ? 'Karma' : 'Audience']}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="var(--chart-1)"
                        strokeWidth={2}
                        fill="url(#audienceAreaGrad)"
                        dot={({ cx, cy, payload, index }) => (
                          <circle
                            key={`dot-${index}`}
                            cx={cx}
                            cy={cy}
                            r={4.5}
                            fill={payload.type === 'category' ? CATEGORY_SERIES : PLATFORM_META[payload.type]?.series}
                            stroke="var(--surface-raised)"
                            strokeWidth={2}
                          />
                        )}
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                    {legend.map(({ color, label }) => (
                      <li key={label} className="flex items-center gap-1.5 text-caption text-ink-muted">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
                        {label}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </SurfaceBox>

            <SurfaceBox title="Top by audience" contentClassName="px-2 py-2">
              <div className="flex flex-col">
                {allSortedByAudience.map((a, i) => accountRow(a, i, <PlatformBadge platform={platformOf(a)} />))}
                {categoryStats.map(stat => categoryRow(stat, <Badge variant="outline">Category</Badge>))}
              </div>
            </SurfaceBox>
          </TabsContent>

          <TabsContent value="views" className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricBox icon={<Eye />}           label="Total views"     value={fmtNum(totalViews)}          subtitle="YouTube, Instagram and tracked content" highlight />
              <MetricBox icon={<CirclePlay />}    label="Channel views"   value={fmtNum(totals.views)}        subtitle={`${ytAccounts.length} YouTube channel${ytAccounts.length !== 1 ? 's' : ''}`} />
              <MetricBox icon={<Camera />}        label="Instagram views" value={fmtNum(cacheTotals.igViews)} subtitle={igAccounts.length > 0 ? igTypeSummary('views') : 'No Instagram accounts'} />
              <MetricBox icon={<BookmarkCheck />} label="Tracked views"   value={fmtNum(trackedViewTotal)}    subtitle={`${fmtNum(trackedStats.ytViews)} YouTube, ${fmtNum(trackedStats.rdViews)} Reddit`} />
            </div>

            {igAccounts.length > 0 && (
              <SurfaceBox title="Instagram views by content type" content={false} className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      {IG_CONTENT_TYPES.map(t => (
                        <TableHead key={t} className="text-right">{IG_CONTENT_TYPE_META[t].plural}</TableHead>
                      ))}
                      <TableHead className="text-right">Total views</TableHead>
                      <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {igAccountRows.map(({ account: a, cache }) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <AccountAvatar account={a} />
                            <div>
                              <p className="text-sm font-medium text-ink">{accountName(a)}</p>
                              <p className="text-caption text-ink-faint">{accountHandle(a)}</p>
                            </div>
                          </div>
                        </TableCell>
                        {IG_CONTENT_TYPES.map(t => (
                          <TableCell key={t} className="text-right">
                            {cache?.cacheWarmed ? (
                              <>
                                <p className="text-sm font-medium text-ink">{fmtNum(cache.contentTypes?.[t]?.views)}</p>
                                <p className="text-caption text-ink-faint">{fmtNum(cache.contentTypes?.[t]?.count)} {IG_CONTENT_TYPE_META[t].plural.toLowerCase()}</p>
                              </>
                            ) : <span className="text-ink-faint">-</span>}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-semibold text-ink">
                          {cache?.cacheWarmed ? fmtNum(cache.totalViews) : <span className="font-normal text-ink-faint">{isSyncing ? 'Syncing' : '-'}</span>}
                        </TableCell>
                        <TableCell>
                          <OpenAnalytics onClick={() => handleViewChannel(a)} name={accountName(a)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SurfaceBox>
            )}

            {categoryStats.length > 0 && (
              <SurfaceBox title="Views by category" subheader="YouTube video views plus Reddit post views entered by hand">
                <MetricAreaChart data={categoryViewData} dataKey="views" label="Views" color={SERIES.cool} emptyMessage="No views recorded for these categories yet" />
              </SurfaceBox>
            )}

            {ytAccounts.length > 0 && (
              <SurfaceBox title="YouTube views by channel" content={false} className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-right">#</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead className="text-right">Total views</TableHead>
                      <TableHead className="text-right">Subscribers</TableHead>
                      <TableHead className="text-right">Videos</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                      <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...ytAccounts].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).map((a, i) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-right"><RankNumber rank={i + 1} className="w-auto" /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <AccountAvatar account={a} />
                            <div>
                              <p className="text-sm font-medium text-ink">{a.title}</p>
                              <p className="text-caption text-ink-faint">{accountHandle(a)}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <p className="font-semibold text-ink">{fmtNum(a.viewCount)}</p>
                          <p className="text-caption text-ink-faint">{fmtNumFull(a.viewCount)}</p>
                        </TableCell>
                        <TableCell className="text-right text-ink-muted">{fmtNum(a.subscriberCount)}</TableCell>
                        <TableCell className="text-right text-ink-muted">{fmtNum(a.videoCount)}</TableCell>
                        <TableCell className="text-right text-small text-ink-faint">{timeAgo(a.lastUpdated)}</TableCell>
                        <TableCell><OpenAnalytics onClick={() => handleViewChannel(a)} name={a.title} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SurfaceBox>
            )}
          </TabsContent>

          <TabsContent value="content" className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricBox icon={<CirclePlay />}    label="YouTube videos"    value={fmtNum(totals.videos)}       subtitle={`${ytAccounts.length} channel${ytAccounts.length !== 1 ? 's' : ''}`} />
              <MetricBox icon={<VideoIcon />}     label="Instagram content" value={fmtNum(totals.posts)}        subtitle={IG_CONTENT_TYPES.some(t => cacheTotals.igTypes[t].count > 0) ? igTypeSummary('count') : `${igAccounts.length} account${igAccounts.length !== 1 ? 's' : ''}`} />
              <MetricBox icon={<MessagesSquare />} label="Reddit posts"     value={fmtNum(cacheTotals.rdPosts)} subtitle={cacheTotals.rdPosts > 0 ? 'From the analytics cache' : 'Open Reddit analytics to load'} />
              <MetricBox icon={<BookmarkCheck />} label="Tracked content"   value={fmtNum(trackedStats.total)}  subtitle={`${trackedStats.ytItems.length} YouTube, ${trackedStats.rdItems.length} Reddit`} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SurfaceBox title="Top by content" contentClassName="px-2 py-2">
                <div className="flex flex-col">
                  {allSortedByContent.map((a, i) => accountRow(a, i, (
                    <span className="font-medium text-ink-muted">
                      {platformOf(a) === 'instagram' ? `${fmtNum(a.mediaCount)} items`
                        : platformOf(a) === 'reddit' ? `${fmtNum(a.totalKarma)} karma`
                          : `${fmtNum(a.viewCount)} views`}
                    </span>
                  )))}
                </div>
              </SurfaceBox>

              <SurfaceBox title="Tracked categories" contentClassName="px-2 py-2">
                {categoryStats.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Tag />}
                    title="No categories yet"
                    description="Assign categories to tracked content to see this breakdown."
                    action={<Button size="sm" variant="outline" render={<Link to="/tracked-content" />}>Open tracked content</Button>}
                  />
                ) : (
                  <div className="flex flex-col">
                    {categoryStats.map(stat => categoryRow(stat, (
                      <span className="flex flex-col items-end gap-0.5 text-caption">
                        {stat.views > 0 && <span className="font-medium text-ink">{fmtNum(stat.views)} views</span>}
                        {stat.rdCount > 0 && <span className="text-ink-faint">{fmtNum(stat.rdKarma)} karma</span>}
                      </span>
                    )))}
                  </div>
                )}
              </SurfaceBox>
            </div>
          </TabsContent>

          <TabsContent value="accounts" className="flex flex-col gap-4">
            <SurfaceBox content={false} className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-right">#</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead className="text-right">Audience</TableHead>
                    <TableHead className="text-right">Content</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                    <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allSortedByAudience.map((a, i) => {
                    const platform = platformOf(a);
                    const audience = platform === 'instagram' ? `${fmtNum(a.followersCount)} followers`
                      : platform === 'reddit' ? `${fmtNum(a.totalKarma)} karma`
                        : `${fmtNum(a.subscriberCount)} subscribers`;
                    const content = platform === 'instagram' ? `${fmtNum(a.mediaCount)} items`
                      : platform === 'reddit' ? `${fmtNum(a.postKarma)} post karma`
                        : `${fmtNum(a.viewCount)} views, ${fmtNum(a.videoCount)} videos`;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="text-right"><RankNumber rank={i + 1} className="w-auto" /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <AccountAvatar account={a} />
                            <div>
                              <p className="text-sm font-medium text-ink">{accountName(a)}</p>
                              <p className="text-caption text-ink-faint">{accountHandle(a)}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><PlatformBadge platform={platform} /></TableCell>
                        <TableCell className="text-right text-ink">{audience}</TableCell>
                        <TableCell className="text-right text-ink-muted">{content}</TableCell>
                        <TableCell className="text-right text-small text-ink-faint">{timeAgo(a.lastUpdated)}</TableCell>
                        <TableCell><OpenAnalytics onClick={() => handleViewChannel(a)} name={accountName(a)} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </SurfaceBox>
          </TabsContent>

          <TabsContent value="comments" className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricBox icon={<MessageSquare />}  label="Total comments"       value={fmtNum(totalComments)}         subtitle={totalComments > 0 ? 'Across all platforms' : 'Open an analytics page to load'} highlight />
              <MetricBox icon={<CirclePlay />}     label="YouTube comments"     value={fmtNum(ytComments)}            subtitle={`${fmtPercent(commentShare.youtube)} of all comments`} />
              <MetricBox icon={<MessagesSquare />} label="Reddit comments"      value={fmtNum(rdComments)}            subtitle={`${fmtPercent(commentShare.reddit)} of all comments`} />
              <MetricBox icon={<BarChart2 />}      label="Comments per item"    value={fmtNum(avgCommentsPerContent)} subtitle={`Average across ${fmtNum(totalContent)} item${totalContent !== 1 ? 's' : ''}`} />
            </div>

            {totalComments === 0 ? (
              <SurfaceBox>
                <EmptyState
                  icon={<MessageSquare />}
                  title="No comment data yet"
                  description="Open a channel or account analytics page to load its comments, or track individual posts and videos."
                  action={<Button size="sm" render={<Link to="/tracked-content" />}>Track content</Button>}
                />
              </SurfaceBox>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <SurfaceBox title="Comments by tracked content" subheader="Top 12 tracked items ranked by comments">
                  <MetricAreaChart data={commentByContentData} dataKey="comments" label="Comments" color={SERIES.cool} emptyMessage="Track content to compare comment volume" />
                </SurfaceBox>
                <SurfaceBox title="Comments by category" subheader="Total comments across every item in each category">
                  <MetricAreaChart data={commentByCategoryData} dataKey="comments" label="Comments" color={SERIES.warm} emptyMessage="Assign categories to tracked content to see this breakdown" />
                </SurfaceBox>
              </div>
            )}
          </TabsContent>

          <TabsContent value="likes" className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricBox icon={<ThumbsUp />}       label="Total likes"     value={fmtNum(totalLikes)}          subtitle={totalLikes > 0 ? 'YouTube likes, Instagram likes, Reddit karma' : 'Open an analytics page to load'} highlight />
              <MetricBox icon={<MessagesSquare />} label="Reddit karma"    value={fmtNum(redditKarma)}         subtitle={`${fmtNum(totals.postKarma)} account, ${fmtNum(trackedStats.rdKarma)} tracked`} />
              <MetricBox icon={<CirclePlay />}     label="YouTube likes"   value={fmtNum(ytLikes)}             subtitle={`${fmtPercent(likeShare.youtube)} of all likes`} />
              <MetricBox icon={<Camera />}         label="Instagram likes" value={fmtNum(cacheTotals.igLikes)} subtitle={igAccounts.length > 0 ? `${fmtPercent(likeShare.instagram)} of all likes` : 'No Instagram accounts'} />
            </div>

            {totalLikes === 0 ? (
              <SurfaceBox>
                <EmptyState
                  icon={<ThumbsUp />}
                  title="No engagement data yet"
                  description="Open a channel or account analytics page to load its likes, or track individual posts and videos."
                  action={<Button size="sm" render={<Link to="/tracked-content" />}>Track content</Button>}
                />
              </SurfaceBox>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <SurfaceBox title="Karma by Reddit account" subheader="Post karma earned by each connected account">
                  <MetricAreaChart data={karmaByAccountData} dataKey="karma" label="Post karma" color={PLATFORM_META.reddit.series} emptyMessage="Connect a Reddit account to see karma" />
                </SurfaceBox>
                <SurfaceBox title="Engagement by tracked content" subheader="YouTube likes and Reddit karma for the top 12 tracked items">
                  <MetricAreaChart data={engagementByContentData} dataKey="engagement" label="Likes or karma" color={SERIES.primary} emptyMessage="Track content to compare engagement" />
                </SurfaceBox>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function OpenAnalytics({ onClick, name }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={onClick} aria-label={`Open analytics for ${name}`} />}>
        <ArrowUpRight />
      </TooltipTrigger>
      <TooltipContent>Open analytics</TooltipContent>
    </Tooltip>
  );
}
