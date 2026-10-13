import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from 'recharts';
import {
  RefreshCw, Heart, MessageCircle, Users, UserPlus, Image, TrendingUp, Calendar, Clock, Zap, Flame,
  Trophy, Star, ExternalLink, BarChart2, Hash, Eye, Clapperboard, Film, UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageHeader from '@/components/PageHeader';
import MetricBox from '@/components/MetricBox';
import SurfaceBox from '@/components/SurfaceBox';
import ChartPanel from '@/components/ChartPanel';
import { MediaChip } from '@/components/MediaCard';
import { EmptyState, PageSkeleton } from '@/components/StateViews';
import { AccountAvatar } from '@/components/platform';
import { SERIES, axisProps, gridProps, legendStyle, tooltipCursor, tooltipStyle } from '@/lib/chart';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, fmtNumFull, fmtDate, timeAgo } from '../../../utils/formatters';
import { IG_CONTENT_TYPES, IG_CONTENT_TYPE_META, igContentTypeMeta, fmtIGViews } from '../../../utils/instagramContent';
import { cn } from '@/lib/utils';

const CONTENT_TYPE_ICONS = { reel: Clapperboard, post: Image, video: Film };

function TypeBadge({ type }) {
  const meta = igContentTypeMeta(type);
  return (
    <span className="inline-flex h-5 items-center gap-1.5 rounded-pill border border-line px-2 text-caption font-medium text-ink-muted">
      <span className="size-2 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

function InsightChip({ icon, children }) {
  const Icon = icon;
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-field border border-line bg-surface px-3 text-small font-medium text-ink">
      <Icon className="size-3.5 stroke-[1.75] text-ink-faint" />
      {children}
    </span>
  );
}

export default function InstagramAnalytics() {
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
      const data = await api.getIGAnalytics(account.id);
      setProfile(data.profile);
      setAnalytics(data.analytics);
    } catch (err) {
      showToast(`Couldn't load Instagram analytics. ${err.message}`, 'error');
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
      showToast('Instagram account refreshed');
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
        <PageHeader title="Instagram account" back={back} />
        <SurfaceBox>
          <EmptyState icon={<UserX />} title="Account not found" description="It may have been removed. Choose another account from the sidebar." />
        </SurfaceBox>
      </div>
    );
  }

  if (loading) return <PageSkeleton metrics={6} />;

  const p = profile || account;
  const a = analytics || {};

  const typeStats = a.contentTypeStats || {};
  const typeRows = IG_CONTENT_TYPES
    .filter(type => typeStats[type]?.count > 0)
    .map(type => ({ type, ...typeStats[type], name: IG_CONTENT_TYPE_META[type].plural, color: IG_CONTENT_TYPE_META[type].color }));
  const contentMixData = typeRows.map(row => ({ name: row.name, value: row.count, color: row.color }));
  const topPostsData = (a.topPosts || []).slice(0, 8).map((post, i) => ({ name: `#${i + 1}`, likes: post.likeCount, comments: post.commentsCount }));
  const dayOfWeekData = (a.postsByDayOfWeek || []).map(d => ({ name: d.shortDay, posts: d.posts, avgEngagement: d.avgEngagement, avgLikes: d.avgLikes }));
  const timelineData = (a.engagementTimeline || []).map(m => ({ name: m.month, posts: m.posts, likes: m.likes, comments: m.comments, avgLikes: m.avgLikes }));
  const captionData = a.captionLengthCorrelation || [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={back}
        media={<AccountAvatar account={{ ...account, profilePictureUrl: p.profilePictureUrl || account.profilePictureUrl }} size="xl" showPlatform />}
        title={p.name || p.username}
        description={
          <span className="flex flex-col gap-1">
            <span>@{p.username}</span>
            {p.biography && <span className="line-clamp-2 max-w-xl text-small text-ink-faint">{p.biography}</span>}
          </span>
        }
        actions={
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw data-icon="inline-start" className={cn(refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing' : 'Refresh'}
          </Button>
        }
      />

      {refreshing && <Progress value={null} aria-label="Refreshing account" />}

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <MetricBox small icon={<Users />}         label="Followers"       value={fmtNum(p.followersCount)}             subtitle={fmtNumFull(p.followersCount)} highlight />
          <MetricBox small icon={<UserPlus />}      label="Following"       value={fmtNum(p.followsCount)}               subtitle={fmtNumFull(p.followsCount)} />
          <MetricBox small icon={<Image />}         label="Total posts"     value={fmtNum(a.totalPosts || p.mediaCount)} subtitle={`${a.fetchedPosts || 0} analyzed`} />
          <MetricBox small icon={<Heart />}         label="Total likes"     value={fmtNum(a.totalLikes)}                 subtitle={fmtNumFull(a.totalLikes)} />
          <MetricBox small icon={<MessageCircle />} label="Total comments"  value={fmtNum(a.totalComments)}              subtitle={fmtNumFull(a.totalComments)} />
          <MetricBox small icon={<TrendingUp />}    label="Engagement rate" value={`${a.engagementRate || 0}%`}          subtitle={`${fmtNum(a.avgLikes)} likes per post on average`} />
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricBox small icon={<Eye />} label="Total views" value={fmtNum(a.totalViews)} subtitle={`${a.mediaWithViews || 0} of ${a.fetchedPosts || 0} items report views`} />
          {IG_CONTENT_TYPES.map(type => {
            const stats = typeStats[type] || {};
            const Icon = CONTENT_TYPE_ICONS[type];
            return (
              <MetricBox
                key={type}
                small
                icon={<Icon />}
                label={IG_CONTENT_TYPE_META[type].plural}
                value={fmtNum(stats.count)}
                subtitle={stats.viewsReported > 0 ? `${fmtNum(stats.totalViews)} views, ${fmtNum(stats.avgViews)} on average` : 'No views reported'}
              />
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <MetricBox small icon={<Zap />}           label="Likes per post"      value={fmtNum(a.avgLikes)} />
          <MetricBox small icon={<MessageCircle />} label="Comments per post"   value={fmtNum(a.avgComments)} />
          <MetricBox small icon={<BarChart2 />}     label="Median likes"        value={fmtNum(a.medianLikes)} />
          <MetricBox small icon={<Users />}         label="Follower ratio"      value={p.followersCount > 0 ? (p.followersCount / Math.max(1, p.followsCount)).toFixed(1) : '0'} subtitle="Followers per account followed" />
          <MetricBox small icon={<Heart />}         label="Likes per follower"  value={`${a.likesPerFollower || 0}%`} subtitle="Per post, on average" />
          <MetricBox small icon={<TrendingUp />}    label="Likes per comment"   value={`${a.likesToCommentsRatio || 0}:1`} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <MetricBox small icon={<Calendar />} label="Posts per week" value={a.postFrequency?.perWeek || 0}    subtitle={`${a.postFrequency?.perMonth || 0} per month`} />
          <MetricBox small icon={<Calendar />} label="Last 7 days"    value={a.postsLast7Days || 0}            subtitle="Posts" />
          <MetricBox small icon={<Calendar />} label="Last 30 days"   value={a.postsLast30Days || 0}           subtitle="Posts" />
          <MetricBox small icon={<Calendar />} label="Last 90 days"   value={a.postsLast90Days || 0}           subtitle="Posts" />
          <MetricBox small icon={<Flame />}    label="Virality"       value={`${a.viralityScore || 0}x`}       subtitle="Best post against the average" />
          <MetricBox small icon={<Trophy />}   label="Consistency"    value={`${a.consistencyScore || 0}/100`} subtitle="Engagement stability" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {a.bestPostingDay && <InsightChip icon={Star}>Best day: {a.bestPostingDay}</InsightChip>}
        {a.bestPostingHour && <InsightChip icon={Clock}>Best hour: {a.bestPostingHour}</InsightChip>}
        <InsightChip icon={TrendingUp}>Average engagement: {fmtNum(a.avgEngagement || 0)} per post</InsightChip>
        <InsightChip icon={Trophy}>Consistency: {a.consistencyScore || 0}/100</InsightChip>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartPanel title="Engagement over time" className="xl:col-span-2" empty={timelineData.length === 0} emptyMessage="Not enough posts to chart a timeline">
          <AreaChart data={timelineData}>
            <defs>
              <linearGradient id="igLikesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SERIES.primary} stopOpacity={0.2} />
                <stop offset="95%" stopColor={SERIES.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={44} tickFormatter={fmtNum} />
            <ReTooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--line-strong)' }} />
            <Area type="monotone" dataKey="likes" name="Likes" stroke={SERIES.primary} strokeWidth={2} fill="url(#igLikesGrad)" />
            <Area type="monotone" dataKey="comments" name="Comments" stroke={SERIES.cool} strokeWidth={2} fill="transparent" />
            <Legend wrapperStyle={legendStyle} />
          </AreaChart>
        </ChartPanel>
        <ChartPanel title="Content type mix" empty={contentMixData.length === 0}>
          <PieChart>
            <Pie data={contentMixData} dataKey="value" nameKey="name" cx="50%" cy="44%" outerRadius={80} innerRadius={48} paddingAngle={2} strokeWidth={0}>
              {contentMixData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
            </Pie>
            <ReTooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v} items`, n]} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ ...legendStyle, paddingTop: 8 }} />
          </PieChart>
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartPanel title="Performance by content type" height={260} empty={typeRows.length === 0}>
          <BarChart data={typeRows}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={44} tickFormatter={fmtNum} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
            <Bar dataKey="avgLikes" name="Average likes" fill={SERIES.primary} radius={[4, 4, 0, 0]} />
            <Bar dataKey="avgComments" name="Average comments" fill={SERIES.neutral} radius={[4, 4, 0, 0]} />
            <Legend wrapperStyle={legendStyle} />
          </BarChart>
        </ChartPanel>
        <ChartPanel title="Best days to post" height={260} empty={dayOfWeekData.length === 0}>
          <BarChart data={dayOfWeekData}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={44} tickFormatter={fmtNum} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
            <Bar dataKey="avgEngagement" name="Average engagement" fill={SERIES.warm} radius={[4, 4, 0, 0]} />
            <Bar dataKey="posts" name="Posts" fill={SERIES.neutral} radius={[4, 4, 0, 0]} />
            <Legend wrapperStyle={legendStyle} />
          </BarChart>
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartPanel title="Top posts by engagement" height={260} empty={topPostsData.length === 0}>
          <BarChart data={topPostsData}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={44} tickFormatter={fmtNum} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
            <Bar dataKey="likes" name="Likes" fill={SERIES.primary} radius={[4, 4, 0, 0]} />
            <Bar dataKey="comments" name="Comments" fill={SERIES.neutral} radius={[4, 4, 0, 0]} />
            <Legend wrapperStyle={legendStyle} />
          </BarChart>
        </ChartPanel>
        <ChartPanel title="Caption length and engagement" height={260} empty={captionData.length === 0}>
          <BarChart data={captionData}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} width={44} tickFormatter={fmtNum} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
            <Bar dataKey="avgEngagement" name="Average engagement" fill={SERIES.cool} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartPanel>
      </div>

      {timelineData.length > 1 && (
        <ChartPanel title="Posts per month" height={220}>
          <BarChart data={timelineData}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={44} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
            <Bar dataKey="posts" name="Posts" fill={SERIES.warm} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartPanel>
      )}

      {(a.hashtagAnalysis || []).length > 0 && (
        <SurfaceBox title="Top hashtags">
          <div className="flex flex-wrap gap-1.5">
            {a.hashtagAnalysis.slice(0, 20).map((h, i) => (
              <Tooltip key={h.tag}>
                <TooltipTrigger render={<Badge variant={i < 5 ? 'default' : 'outline'} className="h-6 cursor-default px-2.5" />}>
                  <Hash />{h.tag}<span className="opacity-70">{h.count}</span>
                </TooltipTrigger>
                <TooltipContent>Used {h.count} times, {fmtNum(h.avgEngagement)} average engagement</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </SurfaceBox>
      )}

      <SurfaceBox title="Recent posts" subheader={`${a.fetchedPosts || 0} loaded`}>
        {(a.recentMedia || []).length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
            {a.recentMedia.map(post => {
              const thumb = post.contentType === 'post' ? (post.thumbnailUrl || post.mediaUrl) : post.thumbnailUrl;
              return (
                <a
                  key={post.id}
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${igContentTypeMeta(post.contentType).label.toLowerCase()} on Instagram`}
                  className="group relative aspect-square overflow-hidden rounded-control border border-line bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {thumb && <img src={thumb} alt="" loading="lazy" className="size-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                  {post.contentType !== 'post' && (
                    <span className="absolute top-1 right-1"><MediaChip className="px-1.5 text-[0.625rem]">{igContentTypeMeta(post.contentType).label}</MediaChip></span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 flex justify-center gap-2 bg-gradient-to-t from-[#0C0809]/80 to-transparent pt-4 pb-1 text-[0.625rem] font-semibold text-white opacity-0 transition-opacity duration-(--duration-base) group-hover:opacity-100 group-focus-visible:opacity-100 [&_svg]:size-2.5">
                    <span className="flex items-center gap-0.5"><Eye />{fmtIGViews(post.viewCount)}</span>
                    <span className="flex items-center gap-0.5"><Heart />{fmtNum(post.likeCount)}</span>
                    <span className="flex items-center gap-0.5"><MessageCircle />{fmtNum(post.commentsCount)}</span>
                  </span>
                </a>
              );
            })}
          </div>
        ) : (
          <EmptyState compact icon={<Image />} title="No posts yet" description="This account has not published anything we can read." />
        )}
      </SurfaceBox>

      {(a.topPosts || []).length > 0 && (
        <SurfaceBox title="Top performing posts" content={false} className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-right">#</TableHead>
                <TableHead>Caption</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Likes</TableHead>
                <TableHead className="text-right">Comments</TableHead>
                <TableHead className="text-right">Engagement</TableHead>
                <TableHead>Posted</TableHead>
                <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.topPosts.slice(0, 10).map((post, i) => (
                <TableRow key={post.id}>
                  <TableCell className="text-right font-mono text-caption text-ink-faint">{i + 1}</TableCell>
                  <TableCell className="max-w-[220px]"><p className="truncate text-sm text-ink">{post.caption || 'No caption'}</p></TableCell>
                  <TableCell><TypeBadge type={post.contentType} /></TableCell>
                  <TableCell className="text-right text-ink-muted">{fmtIGViews(post.viewCount)}</TableCell>
                  <TableCell className="text-right font-semibold text-ink">{fmtNum(post.likeCount)}</TableCell>
                  <TableCell className="text-right text-ink-muted">{fmtNum(post.commentsCount)}</TableCell>
                  <TableCell className="text-right text-ink-muted">{fmtNum(post.engagement)}</TableCell>
                  <TableCell className="text-small text-ink-faint">{fmtDate(post.timestamp)}</TableCell>
                  <TableCell>
                    {post.permalink && (
                      <Button variant="ghost" size="icon-xs" render={<a href={post.permalink} target="_blank" rel="noopener noreferrer" aria-label="Open post on Instagram" />}>
                        <ExternalLink />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SurfaceBox>
      )}

      {typeRows.length > 0 && (
        <SurfaceBox title="Summary by content type" content={false} className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Total views</TableHead>
                <TableHead className="text-right">Average views</TableHead>
                <TableHead className="text-right">Average likes</TableHead>
                <TableHead className="text-right">Average comments</TableHead>
                <TableHead className="text-right">Average engagement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {typeRows.map(row => (
                <TableRow key={row.type}>
                  <TableCell><TypeBadge type={row.type} /></TableCell>
                  <TableCell className="text-right text-ink">{row.count}</TableCell>
                  <TableCell className="text-right text-ink-muted">{row.viewsReported > 0 ? fmtNum(row.totalViews) : '-'}</TableCell>
                  <TableCell className="text-right text-ink-muted">{row.viewsReported > 0 ? fmtNum(row.avgViews) : '-'}</TableCell>
                  <TableCell className="text-right text-ink-muted">{fmtNum(row.avgLikes)}</TableCell>
                  <TableCell className="text-right text-ink-muted">{fmtNum(row.avgComments)}</TableCell>
                  <TableCell className="text-right font-semibold text-ink">{fmtNum(row.avgEngagement)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SurfaceBox>
      )}

      <p className="text-center text-caption text-ink-faint">Last updated {timeAgo(account.lastUpdated).toLowerCase()}</p>
    </div>
  );
}
