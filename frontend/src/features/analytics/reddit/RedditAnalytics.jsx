import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, AreaChart, Area, PieChart, Pie,
  Cell, Legend,
} from 'recharts';
import { RefreshCw, TrendingUp, MessageSquare, Award, Star, ExternalLink, FileText, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageHeader from '@/components/PageHeader';
import MetricBox from '@/components/MetricBox';
import SurfaceBox from '@/components/SurfaceBox';
import ChartPanel from '@/components/ChartPanel';
import { RankNumber } from '@/components/ListRow';
import { EmptyState, PageSkeleton } from '@/components/StateViews';
import { AccountAvatar } from '@/components/platform';
import { SERIES, axisProps, axisTick, gridProps, legendStyle, seriesAt, tooltipCursor, tooltipStyle } from '@/lib/chart';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, fmtNumFull, fmtDate, timeAgo } from '../../../utils/formatters';
import { MEDIA_TYPE_LABELS } from './redditPostUtils';
import { cn } from '@/lib/utils';
import ColumnHint from '@/components/ColumnHint';

const MEDIA_TYPE_ORDER = ['text', 'image', 'video', 'link'];

function StatList({ rows }) {
  return (
    <dl className="flex flex-col divide-y divide-divider">
      {rows.map(row => (
        <div key={row.label} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt className="text-sm text-ink-muted">{row.label}</dt>
          <dd className="text-sm font-semibold text-ink tabular-nums">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function RedditAnalytics() {
  const { id } = useParams();
  const { accounts, showToast } = useAppContext();
  const account = accounts.find(a => a.id === id);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadAnalytics = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const data = await api.getRedditAnalytics(account.id);
      setProfile(data.profile);
      setAnalytics(data.analytics);
    } catch (err) {
      showToast(`Couldn't load Reddit analytics. ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
    // Keyed on the account id so a background account refresh does not refetch analytics
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id, showToast]);

  useEffect(() => { loadAnalytics(); }, [id, loadAnalytics]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.refreshAccount(account.id);
      await loadAnalytics();
      showToast('Reddit account refreshed');
    } catch (err) {
      showToast(`Refresh failed. ${err.message}`, 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const back = { to: '/', label: 'Overview' };

  if (!account) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Reddit account" back={back} />
        <SurfaceBox>
          <EmptyState icon={<UserX />} title="Account not found" description="It may have been removed. Choose another account from the sidebar." />
        </SurfaceBox>
      </div>
    );
  }

  if (loading) return <PageSkeleton metrics={4} />;

  const p = profile || account;
  const a = analytics || {};

  const mediaTypeData = a.mediaTypeDistribution
    ? Object.entries(a.mediaTypeDistribution).map(([key, value]) => ({
        name: MEDIA_TYPE_LABELS[key] || key,
        value,
        color: seriesAt(Math.max(0, MEDIA_TYPE_ORDER.indexOf(key))),
      }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={back}
        media={<AccountAvatar account={{ ...account, iconUrl: p.iconUrl || account.iconUrl }} size="xl" showPlatform />}
        title={`u/${p.username || account.username}`}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            {p.isGold && <Badge variant="warning">Gold</Badge>}
            {p.verified && <Badge variant="info">Verified</Badge>}
            {p.isMod && <Badge variant="outline">Moderator</Badge>}
            <span>
              {p.createdAt ? `Joined ${fmtDate(p.createdAt)}. ` : ''}Refreshed {timeAgo(account.lastUpdated).toLowerCase()}.
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" size="sm" render={<Link to={`/reddit-posts/${account.id}`} />}>
              <FileText data-icon="inline-start" />
              View posts
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw data-icon="inline-start" className={cn(refreshing && 'animate-spin')} />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </Button>
          </>
        }
      />

      {refreshing && <Progress value={null} aria-label="Refreshing account" />}

      <SurfaceBox title="Karma" subheader="Earned across posts and comments">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {[
            { label: 'Total karma',   value: fmtNum(p.totalKarma),          sub: fmtNumFull(p.totalKarma), lead: true },
            { label: 'Post karma',    value: fmtNum(p.postKarma),           sub: 'From submitted posts' },
            { label: 'Comment karma', value: fmtNum(p.commentKarma),        sub: 'From comments' },
            { label: 'Awardee karma', value: fmtNum(p.awardeeKarma ?? 0),   sub: 'From awards received' },
          ].map(item => (
            <div key={item.label} className="flex flex-col gap-1">
              <span className="text-small font-medium text-ink-muted">{item.label}</span>
              <span className={cn('font-heading text-2xl font-semibold tracking-[-0.02em] tabular-nums', item.lead ? 'text-brand-text' : 'text-ink')}>{item.value}</span>
              <span className="text-caption text-ink-faint">{item.sub}</span>
            </div>
          ))}
        </div>
      </SurfaceBox>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricBox icon={<TrendingUp />}    label="Posts fetched"   value={fmtNum(a.fetchedPosts)}     subtitle={`${a.postsLast30Days ?? 0} in the last 30 days`} />
        <MetricBox icon={<Award />}         label="Karma from posts" value={fmtNum(a.totalScore)}      subtitle={`${fmtNum(a.avgScore)} per post on average`} highlight />
        <MetricBox icon={<MessageSquare />} label="Comments"        value={fmtNum(a.totalComments)}    subtitle={`${fmtNum(a.avgComments)} per post on average`} />
        <MetricBox icon={<Star />}          label="Awards received" value={fmtNum(a.totalAwards ?? 0)} subtitle={`${a.avgAwards ?? 0} per post on average`} />
      </div>

      {a.monthlyBreakdown?.length > 0 && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <ChartPanel title="Karma over time" height={240} className="xl:col-span-2">
            <AreaChart data={a.monthlyBreakdown} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="redditGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={SERIES.primary} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={SERIES.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={fmtNum} width={48} />
              <ReTooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--line-strong)' }} formatter={(v, n) => [fmtNumFull(v), n === 'score' ? 'Karma' : 'Posts']} />
              <Area type="monotone" dataKey="score" stroke={SERIES.primary} strokeWidth={2} fill="url(#redditGrad)" dot={{ fill: SERIES.primary, r: 3, strokeWidth: 0 }} />
            </AreaChart>
          </ChartPanel>

          {mediaTypeData.length > 0 && (
            <ChartPanel title="Post types" height={240}>
              <PieChart>
                <Pie data={mediaTypeData} dataKey="value" nameKey="name" cx="50%" cy="44%" outerRadius={80} innerRadius={48} paddingAngle={2} strokeWidth={0}>
                  {mediaTypeData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <ReTooltip contentStyle={tooltipStyle} formatter={v => [fmtNumFull(v), 'Posts']} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ ...legendStyle, paddingTop: 8 }} />
              </PieChart>
            </ChartPanel>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SurfaceBox title="Posting frequency">
          <StatList rows={[
            { label: 'Last 7 days',  value: `${a.postsLast7Days ?? 0} posts` },
            { label: 'Last 30 days', value: `${a.postsLast30Days ?? 0} posts` },
            { label: 'Last 90 days', value: `${a.postsLast90Days ?? 0} posts` },
            { label: 'Per week',     value: a.postFrequency?.perWeek ?? 0 },
            { label: 'Per month',    value: a.postFrequency?.perMonth ?? 0 },
          ]} />
        </SurfaceBox>

        <SurfaceBox title="Karma breakdown">
          <StatList rows={[
            { label: 'Average karma',          value: fmtNum(a.avgScore) },
            { label: 'Median karma',           value: fmtNum(a.medianScore) },
            { label: 'Best single post',       value: fmtNum(a.topPosts?.[0]?.score) },
            { label: 'Average upvote ratio',   value: `${a.avgUpvoteRatio ?? 0}%` },
            { label: 'Total comments',         value: fmtNum(a.totalComments) },
            { label: 'Average comments',       value: fmtNum(a.avgComments) },
          ]} />
        </SurfaceBox>

        <SurfaceBox title="Performance indicators">
          <div className="flex flex-col gap-5">
            {[
              { label: 'Virality score', value: a.viralityScore ?? 0, max: Math.max(10, a.viralityScore ?? 0), desc: 'Best post karma against the average. Higher means bigger outlier hits.' },
              { label: 'Consistency',    value: a.consistencyScore ?? 0, max: 100, desc: 'How evenly karma spreads across posts. 100 means every post performs alike.' },
            ].map(item => (
              <div key={item.label} className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{item.label}</span>
                  <span className="text-ink-muted tabular-nums">{item.value}</span>
                </div>
                <Progress value={(item.value / item.max) * 100} aria-label={item.label} />
                <p className="text-caption text-ink-faint">{item.desc}</p>
              </div>
            ))}
          </div>
        </SurfaceBox>
      </div>

      {a.postsByDayOfWeek?.length > 0 && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartPanel title="Posts by day of week" subheader={a.bestPostingDay ? `Best day: ${a.bestPostingDay}` : undefined} height={220}>
            <BarChart data={a.postsByDayOfWeek} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="shortDay" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={fmtNum} width={36} />
              <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} formatter={(v, n) => [fmtNumFull(v), n === 'avgScore' ? 'Average karma' : 'Posts']} />
              <Bar dataKey="posts" fill={SERIES.neutral} radius={[3, 3, 0, 0]} />
              <Bar dataKey="avgScore" fill={SERIES.primary} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartPanel>

          <ChartPanel title="Average karma by hour" subheader={a.bestPostingHour ? `Best hour: ${a.bestPostingHour}` : undefined} height={220}>
            <BarChart data={a.postsByHour} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="hour" tickFormatter={h => `${h}h`} tick={{ ...axisTick, fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
              <YAxis {...axisProps} tickFormatter={fmtNum} width={36} />
              <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} formatter={(v, n) => [fmtNumFull(v), n === 'avgScore' ? 'Average karma' : 'Posts']} />
              <Bar dataKey="avgScore" fill={SERIES.warm} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartPanel>
        </div>
      )}

      {a.subredditBreakdown?.length > 0 && (
        <SurfaceBox title="Top subreddits" content={false} className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-right">#</TableHead>
                <TableHead>Subreddit</TableHead>
                <TableHead className="text-right">Posts</TableHead>
                <TableHead className="text-right">Total karma</TableHead>
                <TableHead className="text-right">Average karma</TableHead>
                <TableHead className="text-right">Average comments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.subredditBreakdown.map((sub, i) => (
                <TableRow key={sub.subreddit}>
                  <TableCell className="text-right font-mono text-caption text-ink-faint">{i + 1}</TableCell>
                  <TableCell>
                    <a href={`https://reddit.com/r/${sub.subreddit}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-medium text-ink hover:underline">
                      r/{sub.subreddit}
                      <ExternalLink className="size-3 text-ink-faint" />
                    </a>
                  </TableCell>
                  <TableCell className="text-right text-ink-muted">{sub.posts}</TableCell>
                  <TableCell className="text-right font-semibold text-ink">{fmtNum(sub.totalScore)}</TableCell>
                  <TableCell className="text-right text-ink-muted">{fmtNum(sub.avgScore)}</TableCell>
                  <TableCell className="text-right text-ink-muted">{fmtNum(sub.avgComments)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SurfaceBox>
      )}

      {a.topPosts?.length > 0 && (
        <SurfaceBox title="Top posts by karma" content={false} className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-right">#</TableHead>
                <TableHead>Post</TableHead>
                <TableHead className="text-right">Karma</TableHead>
                <TableHead className="text-right">Comments</TableHead>
                <TableHead className="text-right"><ColumnHint label="Upvote rate" hint="Share of votes on the post that are upvotes. 96% means 96 of every 100 votes were up." /></TableHead>
                <TableHead className="text-right">Posted</TableHead>
                <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.topPosts.map((post, i) => (
                <TableRow key={post.id}>
                  <TableCell className="text-right"><RankNumber rank={i + 1} className="w-auto" /></TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="max-w-sm">
                      <p className="line-clamp-2 text-sm font-medium leading-snug text-ink">{post.title}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-caption text-ink-faint">{post.subredditPrefixed}</span>
                        {post.flair && <Badge variant="outline">{post.flair}</Badge>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-ink">{fmtNum(post.score)}</TableCell>
                  <TableCell className="text-right text-ink-muted">{fmtNum(post.numComments)}</TableCell>
                  <TableCell className="text-right text-ink-muted">{Math.round((post.upvoteRatio ?? 0) * 100)}%</TableCell>
                  <TableCell className="text-right text-small text-ink-faint">{fmtDate(post.createdAt)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon-xs" render={<a href={post.permalink} target="_blank" rel="noopener noreferrer" aria-label={`Open "${post.title}" on Reddit`} />}>
                      <ExternalLink />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SurfaceBox>
      )}
    </div>
  );
}
