import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from 'recharts';
import {
  RefreshCw, Eye, Users, VideoIcon, ThumbsUp, MessageSquare, TrendingUp, Clock, Trophy, Zap, Flame,
  Calendar, Timer, Film, Tag, Play, BarChart2, UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageHeader from '@/components/PageHeader';
import MetricBox from '@/components/MetricBox';
import SurfaceBox from '@/components/SurfaceBox';
import ChartPanel from '@/components/ChartPanel';
import SectionHeader from '@/components/SectionHeader';
import MediaCard, { MediaChip } from '@/components/MediaCard';
import { EmptyState, PageSkeleton } from '@/components/StateViews';
import { AccountAvatar } from '@/components/platform';
import { SERIES, axisProps, axisTick, gridProps, legendStyle, tooltipCursor, tooltipStyle } from '@/lib/chart';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, fmtNumFull, fmtDate, fmtPercent, fmtDuration, CATEGORY_MAP, fmtCount } from '../../../utils/formatters';
import { cn } from '@/lib/utils';

const watchUrl = id => `https://www.youtube.com/watch?v=${id}`;

const TABS = [
  { value: 'overview',   label: 'Overview' },
  { value: 'videos',     label: 'Videos' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'content',    label: 'Content' },
  { value: 'publishing', label: 'Publishing' },
  { value: 'growth',     label: 'Growth' },
  { value: 'shorts',     label: 'Shorts and regular' },
  { value: 'tags',       label: 'Tags and SEO' },
];

function MetricGrid({ className, children }) {
  return <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4', className)}>{children}</div>;
}

function VideoTable({ videos }) {
  const rows = (videos || []).filter(Boolean);
  return (
    <SurfaceBox content={false} className="overflow-hidden">
      <div className="max-h-[480px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-surface-raised">
            <TableRow>
              <TableHead className="w-10 text-right">#</TableHead>
              <TableHead>Video</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Likes</TableHead>
              <TableHead className="text-right">Comments</TableHead>
              <TableHead className="text-right">Engagement</TableHead>
              <TableHead className="text-right">Length</TableHead>
              <TableHead className="text-right">Published</TableHead>
              <TableHead className="w-10"><span className="sr-only">Watch</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((v, i) => (
              <TableRow key={v.videoId}>
                <TableCell className="text-right font-mono text-caption text-ink-faint">{i + 1}</TableCell>
                <TableCell className="max-w-[280px]">
                  <a href={watchUrl(v.videoId)} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-ink hover:underline">{v.title}</a>
                </TableCell>
                <TableCell className="text-right font-semibold text-ink">{fmtNum(v.viewCount)}</TableCell>
                <TableCell className="text-right text-ink-muted">{fmtCount(v.likeCount)}</TableCell>
                <TableCell className="text-right text-ink-muted">{fmtCount(v.commentCount)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={parseFloat(v.engagementRate) > 5 ? 'success' : 'secondary'}>{fmtPercent(v.engagementRate)}</Badge>
                </TableCell>
                <TableCell className="text-right text-ink-muted">{fmtDuration(v.durationSeconds)}</TableCell>
                <TableCell className="text-right text-small text-ink-faint">{fmtDate(v.publishedAt)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-xs" render={<a href={watchUrl(v.videoId)} target="_blank" rel="noopener noreferrer" aria-label={`Watch ${v.title} on YouTube`} />}>
                    <Play />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SurfaceBox>
  );
}

function TrendArea({ data, dataKey = 'value', color, name, percent = false, gradientId }) {
  return (
    <AreaChart data={data}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.2} />
          <stop offset="95%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid {...gridProps} vertical={false} />
      <XAxis dataKey="month" {...axisProps} />
      <YAxis {...axisProps} tickFormatter={percent ? v => `${v}%` : fmtNum} width={48} />
      <ReTooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--line-strong)' }} formatter={percent ? undefined : v => fmtNumFull(v)} />
      <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#${gradientId})`} strokeWidth={2} name={name} />
    </AreaChart>
  );
}

export default function ChannelAnalytics() {
  const { id } = useParams();
  const { accounts, showToast } = useAppContext();
  const account = accounts.find(a => a.id === id);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.getAnalytics(id));
    } catch (err) {
      showToast(`Couldn't load channel analytics. ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => { if (id) loadAnalytics(); }, [id, loadAnalytics]);

  const back = { to: '/', label: 'Overview' };

  if (!account && !loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="YouTube channel" back={back} />
        <SurfaceBox>
          <EmptyState icon={<UserX />} title="Channel not found" description="It may have been removed. Choose another account from the sidebar." />
        </SurfaceBox>
      </div>
    );
  }

  if (loading) return <PageSkeleton metrics={4} />;

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={account?.title || 'YouTube channel'} back={back} />
        <SurfaceBox>
          <EmptyState
            icon={<BarChart2 />}
            title="Analytics are unavailable"
            description="The channel's analytics could not be loaded. Check the YouTube API key in Settings, then try again."
            action={<Button variant="outline" size="sm" onClick={loadAnalytics}>Try again</Button>}
          />
        </SurfaceBox>
      </div>
    );
  }

  const { channel, analytics } = data;

  const dayData = analytics.publishDayDistribution
    ? Object.entries(analytics.publishDayDistribution).map(([day, count]) => ({ day, count }))
    : [];
  const hourData = analytics.publishHourDistribution
    ? Object.entries(analytics.publishHourDistribution).sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10)).map(([hour, count]) => ({ hour: `${hour}:00`, count }))
    : [];
  const durationData = analytics.durationDistribution
    ? [
        { name: 'Shorts (under 1m)', value: analytics.durationDistribution.short,    color: SERIES.primary },
        { name: 'Medium (1 to 10m)', value: analytics.durationDistribution.medium,   color: SERIES.cool },
        { name: 'Long (10 to 60m)',  value: analytics.durationDistribution.long,     color: SERIES.neutral },
        { name: 'Very long (1h+)',   value: analytics.durationDistribution.veryLong, color: SERIES.warm },
      ].filter(d => d.value > 0)
    : [];
  const catData = analytics.categoryDistribution
    ? Object.entries(analytics.categoryDistribution).map(([catId, count]) => ({ name: CATEGORY_MAP[catId] || `Category ${catId}`, value: count }))
    : [];
  const splitData = [
    { name: 'Shorts', value: analytics.shortsCount, color: SERIES.primary },
    { name: 'Regular', value: analytics.regularCount, color: SERIES.cool },
  ].filter(d => d.value > 0);

  const meta = [
    channel.customUrl,
    channel.country && channel.country !== 'Unknown' ? channel.country : null,
    `${channel.channelAgeYears} years old`,
    `Since ${fmtDate(channel.publishedAt)}`,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={back}
        media={<AccountAvatar account={{ ...account, thumbnail: channel.thumbnails?.high || channel.thumbnails?.medium || account?.thumbnail }} size="xl" showPlatform />}
        title={channel.title}
        description={
          <span className="flex flex-wrap gap-1.5">
            {meta.map(m => <Badge key={m} variant="outline">{m}</Badge>)}
          </span>
        }
        actions={
          <Button variant="outline" size="sm" onClick={loadAnalytics}>
            <RefreshCw data-icon="inline-start" />
            Refresh
          </Button>
        }
      />

      {analytics.totalVideos === 0 ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricBox small icon={<Users />}     label="Subscribers"  value={fmtNum(channel.subscriberCount)} subtitle={fmtNumFull(channel.subscriberCount)} />
            <MetricBox small icon={<Eye />}       label="Total views"  value={fmtNum(channel.viewCount)}       subtitle={fmtNumFull(channel.viewCount)} />
            <MetricBox small icon={<VideoIcon />} label="Total videos" value={fmtNum(channel.videoCount)}      subtitle="Public uploads" />
          </div>
          <SurfaceBox>
            <EmptyState
              icon={<VideoIcon />}
              title="No public videos yet"
              description="Video analytics start with this channel's first public upload. After publishing, choose Refresh."
            />
          </SurfaceBox>
        </>
      ) : (
      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <div className="scrollbar-hide -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="w-max min-w-full">
            {TABS.map(t => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <MetricBox small icon={<Eye />}           label="Total views"   value={fmtNum(channel.viewCount)}       subtitle={fmtNumFull(channel.viewCount)} highlight />
            <MetricBox small icon={<Users />}         label="Subscribers"   value={fmtNum(channel.subscriberCount)} subtitle={fmtNumFull(channel.subscriberCount)} />
            <MetricBox small icon={<VideoIcon />}     label="Total videos"  value={fmtNum(channel.videoCount)}      subtitle={`${analytics.totalVideos} analyzed`} />
            <MetricBox small icon={<ThumbsUp />}      label="Total likes"   value={fmtNum(analytics.totalLikes)}    subtitle={fmtNumFull(analytics.totalLikes)} />
            <MetricBox small icon={<MessageSquare />} label="Comments"      value={fmtNum(analytics.totalComments)} subtitle={fmtNumFull(analytics.totalComments)} />
            <MetricBox small icon={<TrendingUp />}    label="Engagement"    value={fmtPercent(analytics.overallEngagementRate)} subtitle="Likes and comments per view" />
          </div>
          <MetricGrid>
            <MetricBox small icon={<Zap />}           label="Average views per video"  value={fmtNum(analytics.avgViews)} />
            <MetricBox small icon={<ThumbsUp />}      label="Average likes per video"  value={fmtNum(analytics.avgLikes)} />
            <MetricBox small icon={<MessageSquare />} label="Average comments"         value={fmtNum(analytics.avgComments)} />
            <MetricBox small icon={<BarChart2 />}     label="Median views"             value={fmtNum(analytics.medianViews)} />
          </MetricGrid>
          <MetricGrid>
            <MetricBox small icon={<Eye />}        label="Views per subscriber"   value={channel.viewsPerSubscriber} />
            <MetricBox small icon={<TrendingUp />} label="Subscribers per day"    value={fmtNum(channel.avgSubGainPerDay)} />
            <MetricBox small icon={<Eye />}        label="Views per day"          value={fmtNum(channel.avgViewsPerDay)} />
            <MetricBox small icon={<Timer />}      label="Average length"         value={analytics.avgDurationFormatted} />
          </MetricGrid>
          <MetricGrid>
            <MetricBox small icon={<Clock />} label="Videos, last 7 days"   value={analytics.videosLast7Days} />
            <MetricBox small icon={<Clock />} label="Videos, last 30 days"  value={analytics.videosLast30Days} />
            <MetricBox small icon={<Clock />} label="Videos, last 90 days"  value={analytics.videosLast90Days} />
            <MetricBox small icon={<Clock />} label="Videos, last 365 days" value={analytics.videosLast365Days} />
          </MetricGrid>
          <MetricGrid>
            <MetricBox small icon={<Calendar />} label="Estimated monthly views"       value={fmtNum(channel.estimatedMonthlyViews)} />
            <MetricBox small icon={<Users />}    label="Estimated monthly subscribers" value={fmtNum(channel.estimatedMonthlySubGain)} />
            <MetricBox small icon={<Flame />}    label="Virality score"                value={`${analytics.viralityScore}x`} />
            <MetricBox small icon={<Trophy />}   label="Consistency"                   value={`${analytics.consistencyScore}/100`} />
          </MetricGrid>

          <SectionHeader title="Best performing videos" className="mt-5" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Most viewed',     video: analytics.bestByViews },
              { label: 'Most liked',      video: analytics.bestByLikes },
              { label: 'Most comments',   video: analytics.bestByComments },
              { label: 'Best engagement', video: analytics.bestByEngagement },
            ].filter(({ video }) => video).map(({ label, video }) => (
              <MediaCard
                key={label}
                href={watchUrl(video.videoId)}
                image={video.thumbnail}
                title={video.title}
                topLeft={<MediaChip>{label}</MediaChip>}
                meta={<span>{fmtNum(video.viewCount)} views, {video.likeCount == null ? 'likes hidden' : `${fmtNum(video.likeCount)} likes`}</span>}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="videos" className="flex flex-col gap-4">
          <ChartPanel title="Top 10 videos by views" height={320}>
            <BarChart data={(analytics.top10ByViews || []).map(v => ({ name: `${(v?.title || '').slice(0, 28)}…`, views: v?.viewCount || 0, likes: v?.likeCount || 0 }))}>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 10 }} angle={-15} textAnchor="end" height={70} />
              <YAxis {...axisProps} tickFormatter={fmtNum} />
              <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} formatter={v => fmtNumFull(v)} />
              <Bar dataKey="views" fill={SERIES.primary} radius={[4, 4, 0, 0]} name="Views" />
              <Bar dataKey="likes" fill={SERIES.neutral} radius={[4, 4, 0, 0]} name="Likes" />
              <Legend wrapperStyle={legendStyle} />
            </BarChart>
          </ChartPanel>
          <VideoTable videos={
            (analytics.top10ByViews || []).concat(analytics.top10ByLikes || [])
              .filter((v, i, arr) => v && arr.findIndex(x => x?.videoId === v?.videoId) === i)
              .sort((a, b) => (b?.viewCount || 0) - (a?.viewCount || 0))
          } />
        </TabsContent>

        <TabsContent value="engagement" className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <MetricBox small icon={<ThumbsUp />}      label="Total engagement" value={fmtNum(analytics.totalEngagement)} />
            <MetricBox small icon={<TrendingUp />}    label="Engagement rate"  value={fmtPercent(analytics.overallEngagementRate)} highlight />
            <MetricBox small icon={<ThumbsUp />}      label="Like rate"        value={analytics.totalViews > 0 ? fmtPercent(analytics.totalLikes / analytics.totalViews * 100) : '0%'} />
            <MetricBox small icon={<MessageSquare />} label="Comment rate"     value={analytics.totalViews > 0 ? fmtPercent(analytics.totalComments / analytics.totalViews * 100) : '0%'} />
            <MetricBox small icon={<Flame />}         label="Virality score"   value={`${analytics.viralityScore}x`} />
            <MetricBox small icon={<BarChart2 />}     label="Likes per comment" value={analytics.totalComments > 0 ? `${(analytics.totalLikes / analytics.totalComments).toFixed(1)}:1` : 'Not available'} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ChartPanel title="Engagement rate by month">
              <TrendArea data={analytics.engagementTrend || []} color={SERIES.cool} name="Engagement %" percent gradientId="egGrad" />
            </ChartPanel>
            <ChartPanel title="Like rate by month">
              <TrendArea data={analytics.likeRateTrend || []} color={SERIES.primary} name="Like rate %" percent gradientId="lrGrad" />
            </ChartPanel>
          </div>
          <SectionHeader title="Top 10 by engagement rate" />
          <VideoTable videos={analytics.top10ByEngagement} />
        </TabsContent>

        <TabsContent value="content" className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <MetricBox small icon={<Film />}          label="HD videos"     value={analytics.hdCount}         subtitle={fmtPercent(analytics.hdPercentage)} />
            <MetricBox small icon={<MessageSquare />} label="Captions"      value={analytics.captionCount}    subtitle={fmtPercent(analytics.captionPercentage)} />
            <MetricBox small icon={<Trophy />}        label="Licensed"      value={analytics.licensedCount}   subtitle={fmtPercent(analytics.licensedPercentage)} />
            <MetricBox small icon={<VideoIcon />}     label="Embeddable"    value={analytics.embeddableCount} subtitle={fmtPercent(analytics.embeddablePercentage)} />
            <MetricBox small icon={<Users />}         label="Made for kids" value={analytics.madeForKidsCount} />
            <MetricBox small icon={<Timer />}         label="Average length" value={analytics.avgDurationFormatted} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ChartPanel title="Length distribution" empty={durationData.length === 0}>
              <PieChart>
                <Pie data={durationData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={55} paddingAngle={2} strokeWidth={0}>
                  {durationData.map(d => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <ReTooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
              </PieChart>
            </ChartPanel>
            <ChartPanel title="Videos by category" empty={catData.length === 0}>
              <BarChart data={catData} layout="vertical">
                <CartesianGrid {...gridProps} horizontal={false} />
                <XAxis type="number" {...axisProps} />
                <YAxis dataKey="name" type="category" {...axisProps} width={120} />
                <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
                <Bar dataKey="value" fill={SERIES.cool} radius={[0, 4, 4, 0]} name="Videos" />
              </BarChart>
            </ChartPanel>
          </div>
          <ChartPanel title="Videos by view range" height={240}>
            <BarChart data={(analytics.viewsDistribution?.ranges || []).map((r, i) => ({ range: r, count: analytics.viewsDistribution.counts[i] || 0 }))}>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="range" tick={{ ...axisTick, fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
              <YAxis {...axisProps} />
              <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
              <Bar dataKey="count" fill={SERIES.warm} radius={[4, 4, 0, 0]} name="Videos" />
            </BarChart>
          </ChartPanel>
        </TabsContent>

        <TabsContent value="publishing" className="flex flex-col gap-4">
          <MetricGrid>
            <MetricBox small icon={<Calendar />} label="Most common upload day"  value={analytics.peakPublishDay || 'Not available'} />
            <MetricBox small icon={<Clock />}    label="Most common upload hour" value={analytics.peakPublishHour !== undefined ? `${analytics.peakPublishHour}:00 UTC` : 'Not available'} />
            <MetricBox small icon={<Zap />}      label="Uploads per week"        value={analytics.uploadFrequencyPerWeek} />
            <MetricBox small icon={<Trophy />}   label="Consistency"             value={`${analytics.consistencyScore}/100`} />
          </MetricGrid>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ChartPanel title="Uploads by day of week">
              <BarChart data={dayData}>
                <CartesianGrid {...gridProps} vertical={false} />
                <XAxis dataKey="day" {...axisProps} />
                <YAxis {...axisProps} />
                <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
                <Bar dataKey="count" fill={SERIES.cool} radius={[4, 4, 0, 0]} name="Videos" />
              </BarChart>
            </ChartPanel>
            <ChartPanel title="Uploads by hour (UTC)">
              <AreaChart data={hourData}>
                <defs>
                  <linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SERIES.warm} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={SERIES.warm} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} vertical={false} />
                <XAxis dataKey="hour" {...axisProps} />
                <YAxis {...axisProps} />
                <ReTooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--line-strong)' }} />
                <Area type="monotone" dataKey="count" stroke={SERIES.warm} fill="url(#hourGrad)" strokeWidth={2} name="Videos" />
              </AreaChart>
            </ChartPanel>
          </div>
        </TabsContent>

        <TabsContent value="growth" className="flex flex-col gap-4">
          <MetricGrid>
            <MetricBox small icon={<TrendingUp />} label="Estimated yearly views"       value={fmtNum(channel.estimatedYearlyViews)} highlight />
            <MetricBox small icon={<Users />}      label="Estimated yearly subscribers" value={fmtNum(channel.estimatedYearlySubGain)} />
            <MetricBox small icon={<Eye />}        label="Views per day"                value={fmtNum(channel.avgViewsPerDay)} />
            <MetricBox small icon={<Users />}      label="Subscribers per day"          value={fmtNum(channel.avgSubGainPerDay)} />
          </MetricGrid>
          <ChartPanel title="Views by month" height={300}>
            <TrendArea data={analytics.viewsTrend || []} color={SERIES.primary} name="Views" gradientId="viewGrad" />
          </ChartPanel>
          <ChartPanel title="Uploads by month" height={240}>
            <BarChart data={(analytics.viewsTrend || []).map(t => ({ month: t.month, uploads: t.count }))}>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} />
              <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
              <Bar dataKey="uploads" fill={SERIES.neutral} radius={[4, 4, 0, 0]} name="Uploads" />
            </BarChart>
          </ChartPanel>
        </TabsContent>

        <TabsContent value="shorts" className="flex flex-col gap-4">
          <MetricGrid>
            <MetricBox small icon={<Flame />}     label="Shorts"                   value={analytics.shortsCount} />
            <MetricBox small icon={<VideoIcon />} label="Regular videos"           value={analytics.regularCount} />
            <MetricBox small icon={<Eye />}       label="Average views per Short"  value={fmtNum(analytics.avgShortViews)} />
            <MetricBox small icon={<Eye />}       label="Average views per video"  value={fmtNum(analytics.avgRegularViews)} />
          </MetricGrid>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <ChartPanel title="Content split" className="md:col-span-2" empty={splitData.length === 0}>
              <PieChart>
                <Pie data={splitData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={55} paddingAngle={2} strokeWidth={0}>
                  {splitData.map(d => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <ReTooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
              </PieChart>
            </ChartPanel>
            <ChartPanel title="Shorts compared with regular videos" className="md:col-span-3">
              <BarChart data={[
                { metric: 'Average views', Shorts: analytics.avgShortViews, Regular: analytics.avgRegularViews },
                { metric: 'Average likes', Shorts: analytics.avgShortLikes, Regular: analytics.avgRegularLikes },
              ]}>
                <CartesianGrid {...gridProps} vertical={false} />
                <XAxis dataKey="metric" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={fmtNum} />
                <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} formatter={v => fmtNumFull(v)} />
                <Bar dataKey="Shorts" fill={SERIES.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Regular" fill={SERIES.cool} radius={[4, 4, 0, 0]} />
                <Legend wrapperStyle={legendStyle} />
              </BarChart>
            </ChartPanel>
          </div>
        </TabsContent>

        <TabsContent value="tags" className="flex flex-col gap-4">
          <MetricGrid>
            <MetricBox small icon={<Tag />}           label="Unique tags"     value={analytics.tagFrequency?.length || 0} />
            <MetricBox small icon={<MessageSquare />} label="Caption rate"    value={fmtPercent(analytics.captionPercentage)} />
            <MetricBox small icon={<Film />}          label="HD rate"         value={fmtPercent(analytics.hdPercentage)} />
            <MetricBox small icon={<VideoIcon />}     label="Embeddable rate" value={fmtPercent(analytics.embeddablePercentage)} />
          </MetricGrid>
          <SurfaceBox title="Most used tags">
            {(analytics.tagFrequency || []).length === 0 ? (
              <p className="text-small text-ink-faint">These videos have no tags.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {analytics.tagFrequency.map(({ tag, count }, i) => (
                  <Badge key={tag} variant={i < 5 ? 'default' : 'outline'} className="h-6 px-2.5">
                    {tag}<span className="opacity-70">{count}</span>
                  </Badge>
                ))}
              </div>
            )}
          </SurfaceBox>
          {(analytics.tagFrequency || []).length > 0 && (
            <ChartPanel title="Tag usage, top 20" height={400}>
              <BarChart data={analytics.tagFrequency.slice(0, 20)} layout="vertical">
                <CartesianGrid {...gridProps} horizontal={false} />
                <XAxis type="number" {...axisProps} />
                <YAxis dataKey="tag" type="category" {...axisProps} width={140} />
                <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
                <Bar dataKey="count" fill={SERIES.primary} radius={[0, 4, 4, 0]} name="Videos using this tag" />
              </BarChart>
            </ChartPanel>
          )}
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}
