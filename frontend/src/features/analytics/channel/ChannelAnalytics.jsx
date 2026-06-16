import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from 'recharts';
import StatCard from '../../../components/ui/StatCard';
import MainCard from '../../../components/MainCard';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, fmtNumFull, fmtDate, fmtPercent, fmtDuration, CATEGORY_MAP } from '../../../utils/formatters';
import {
  ArrowLeft, RefreshCw, Eye, Users, VideoIcon, ThumbsUp, MessageSquare,
  TrendingUp, Clock, Trophy, Zap, Flame, Calendar, Timer, Film,
  Tag, Play, BarChart2, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const C = {
  blue:   'hsl(221.2,83.2%,53.3%)',
  green:  '#22c55e',
  orange: '#f97316',
  red:    '#ef4444',
  purple: '#a855f7',
  cyan:   '#06b6d4',
  pink:   '#ec4899',
  indigo: '#6366f1',
  amber:  '#f59e0b',
};

const TS = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 };

function ChartCard({ title, children, height = 280 }) {
  return (
    <MainCard title={title} contentClassName="p-3">
      <ResponsiveContainer width="100%" height={height} debounce={200}>
        {children}
      </ResponsiveContainer>
    </MainCard>
  );
}

function VideoTable({ videos }) {
  return (
    <MainCard content={false}>
      <ScrollArea className="h-[480px]">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Video</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Likes</TableHead>
              <TableHead className="text-right">Comments</TableHead>
              <TableHead className="text-right">Eng%</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead className="text-right">Published</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(videos || []).filter(Boolean).map((v, i) => (
              <TableRow key={v.videoId} className="cursor-pointer" onClick={() => window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank', 'noopener')}>
                <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="max-w-[280px]"><p className="text-sm font-medium truncate">{v.title}</p></TableCell>
                <TableCell className="text-right text-sm font-semibold">{fmtNum(v.viewCount)}</TableCell>
                <TableCell className="text-right text-sm">{fmtNum(v.likeCount)}</TableCell>
                <TableCell className="text-right text-sm">{fmtNum(v.commentCount)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className={cn('text-xs', parseFloat(v.engagementRate) > 5 ? 'border-green-200 bg-green-50 text-green-700' : '')}>
                    {fmtPercent(v.engagementRate)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm">{fmtDuration(v.durationSeconds)}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{fmtDate(v.publishedAt)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-50" onClick={e => { e.stopPropagation(); window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank', 'noopener'); }}>
                    <Play className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </MainCard>
  );
}

export default function ChannelAnalytics() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accounts, showToast } = useAppContext();
  const account = accounts.find(a => a.id === id);

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('overview');

  useEffect(() => { if (id) loadAnalytics(); }, [id]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.getAnalytics(id);
      setData(res);
    } catch (err) {
      showToast('Failed to load analytics: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!account && !loading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/')} className="gap-2 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Overview
        </Button>
        <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>Account not found. It may have been removed.</AlertDescription></Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" className="gap-2 -ml-2 text-muted-foreground" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Progress className="h-1" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { channel, analytics } = data;

  const dayData  = analytics.publishDayDistribution
    ? Object.entries(analytics.publishDayDistribution).map(([day, count]) => ({ day, count }))
    : [];
  const hourData = analytics.publishHourDistribution
    ? Object.entries(analytics.publishHourDistribution).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([hour, count]) => ({ hour: `${hour}:00`, count }))
    : [];
  const durationData = analytics.durationDistribution
    ? [
        { name: 'Shorts (<1m)',    value: analytics.durationDistribution.short,    color: C.red    },
        { name: 'Medium (1-10m)', value: analytics.durationDistribution.medium,   color: C.blue   },
        { name: 'Long (10-60m)',  value: analytics.durationDistribution.long,     color: C.green  },
        { name: 'Very Long (>1h)',value: analytics.durationDistribution.veryLong, color: C.orange },
      ].filter(d => d.value > 0)
    : [];
  const catData = analytics.categoryDistribution
    ? Object.entries(analytics.categoryDistribution).map(([id, count]) => ({ name: CATEGORY_MAP[id] || `Cat ${id}`, value: count }))
    : [];

  return (
    <div className="space-y-4">
      {/* Back */}
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-2 -ml-2 text-muted-foreground h-8">
        <ArrowLeft className="h-4 w-4" /> Back to Overview
      </Button>

      {/* Channel header */}
      <MainCard content={false}>
        <div className="p-4 flex items-center gap-4 flex-wrap">
          <Avatar className="h-16 w-16 border-2 border-border">
            <AvatarImage src={channel.thumbnails?.high || channel.thumbnails?.medium} />
            <AvatarFallback className="bg-red-500 text-white text-lg font-bold">{(channel.title || 'YT').slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">{channel.title}</h2>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {channel.customUrl && <Badge variant="outline" className="text-xs">{channel.customUrl}</Badge>}
              {channel.country && channel.country !== 'Unknown' && <Badge variant="outline" className="text-xs">{channel.country}</Badge>}
              <Badge variant="outline" className="text-xs">{channel.channelAgeYears} years old</Badge>
              <Badge variant="outline" className="text-xs">Since {fmtDate(channel.publishedAt)}</Badge>
            </div>
          </div>
          <Button size="sm" onClick={loadAnalytics} className="gap-2 shrink-0">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </MainCard>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto scrollbar-hide">
          <TabsList className="w-max">
            {['overview','videos','engagement','content','publishing','growth','shorts','tags'].map((t, i) => (
              <TabsTrigger key={t} value={t} className="text-xs px-3">
                {['Overview','Videos','Engagement','Content','Publishing','Growth','Shorts vs Regular','Tags & SEO'][i]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatCard icon={<Eye />}        label="Total Views"     value={fmtNum(channel.viewCount)}               subtitle={fmtNumFull(channel.viewCount)}         gradient="red"    small />
            <StatCard icon={<Users />}      label="Subscribers"     value={fmtNum(channel.subscriberCount)}          subtitle={fmtNumFull(channel.subscriberCount)}   gradient="green"  small />
            <StatCard icon={<VideoIcon />}  label="Total Videos"    value={fmtNum(channel.videoCount)}               subtitle={`${analytics.totalVideos} analyzed`}   gradient="orange" small />
            <StatCard icon={<ThumbsUp />}   label="Total Likes"     value={fmtNum(analytics.totalLikes)}             subtitle={fmtNumFull(analytics.totalLikes)}      gradient="blue"   small />
            <StatCard icon={<MessageSquare />} label="Comments"     value={fmtNum(analytics.totalComments)}          subtitle={fmtNumFull(analytics.totalComments)}   gradient="purple" small />
            <StatCard icon={<TrendingUp />} label="Engagement"      value={fmtPercent(analytics.overallEngagementRate)} subtitle="Likes+Comments/Views"              gradient="teal"   small />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Zap />}     label="Avg Views/Video"   value={fmtNum(analytics.avgViews)}               gradient="cyan"   small />
            <StatCard icon={<ThumbsUp />} label="Avg Likes/Video"  value={fmtNum(analytics.avgLikes)}               gradient="indigo" small />
            <StatCard icon={<MessageSquare />} label="Avg Comments" value={fmtNum(analytics.avgComments)}            gradient="pink"   small />
            <StatCard icon={<BarChart2 />} label="Median Views"     value={fmtNum(analytics.medianViews)}             gradient="amber"  small />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Eye />}         label="Views/Subscriber" value={channel.viewsPerSubscriber}              gradient="red"    small />
            <StatCard icon={<TrendingUp />}  label="Avg Subs/Day"     value={fmtNum(channel.avgSubGainPerDay)}        gradient="green"  small />
            <StatCard icon={<Eye />}         label="Avg Views/Day"    value={fmtNum(channel.avgViewsPerDay)}          gradient="blue"   small />
            <StatCard icon={<Timer />}       label="Avg Duration"     value={analytics.avgDurationFormatted}          gradient="orange" small />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Clock />} label="Videos (7d)"   value={analytics.videosLast7Days}    gradient="red"    small />
            <StatCard icon={<Clock />} label="Videos (30d)"  value={analytics.videosLast30Days}   gradient="blue"   small />
            <StatCard icon={<Clock />} label="Videos (90d)"  value={analytics.videosLast90Days}   gradient="green"  small />
            <StatCard icon={<Clock />} label="Videos (365d)" value={analytics.videosLast365Days}  gradient="orange" small />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Calendar />}   label="Est. Monthly Views" value={fmtNum(channel.estimatedMonthlyViews)}   gradient="indigo" small />
            <StatCard icon={<Users />}      label="Est. Monthly Subs"  value={fmtNum(channel.estimatedMonthlySubGain)} gradient="teal"   small />
            <StatCard icon={<Flame />}      label="Virality Score"     value={`${analytics.viralityScore}x`}           gradient="pink"   small />
            <StatCard icon={<Trophy />}     label="Consistency"        value={`${analytics.consistencyScore}/100`}     gradient="amber"  small />
          </div>

          <div>
            <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" /> Best Performing Videos
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {[
                { label: 'Most Viewed',     video: analytics.bestByViews,      color: 'bg-red-500' },
                { label: 'Most Liked',      video: analytics.bestByLikes,      color: 'bg-green-500' },
                { label: 'Most Comments',   video: analytics.bestByComments,   color: 'bg-blue-500' },
                { label: 'Best Engagement', video: analytics.bestByEngagement, color: 'bg-orange-500' },
              ].filter(({ video }) => video).map(({ label, video, color }) => (
                <div key={label} className="border border-border rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.open(`https://www.youtube.com/watch?v=${video.videoId}`, '_blank', 'noopener')}>
                  <div className="relative">
                    <img src={video.thumbnail} className="w-full aspect-video object-cover" alt="" />
                    <span className={`absolute top-2 left-2 text-white text-xs font-semibold px-2 py-0.5 rounded ${color}`}>{label}</span>
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold line-clamp-2">{video.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{fmtNum(video.viewCount)} views · {fmtNum(video.likeCount)} likes</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Videos */}
        <TabsContent value="videos" className="space-y-4 mt-4">
          <ChartCard title="Top 10 Videos by Views" height={320}>
            <BarChart data={(analytics.top10ByViews || []).map(v => ({ name: (v?.title || '').slice(0, 28) + '…', views: v?.viewCount || 0, likes: v?.likeCount || 0 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} angle={-15} textAnchor="end" height={70} />
              <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={fmtNum} axisLine={false} tickLine={false} />
              <ReTooltip contentStyle={TS} formatter={v => fmtNumFull(v)} />
              <Bar dataKey="views" fill={C.red}   radius={[4, 4, 0, 0]} name="Views" />
              <Bar dataKey="likes" fill={C.green} radius={[4, 4, 0, 0]} name="Likes" />
              <Legend />
            </BarChart>
          </ChartCard>
          <VideoTable videos={
            (analytics.top10ByViews || []).concat(analytics.top10ByLikes || [])
              .filter((v, i, arr) => v && arr.findIndex(x => x?.videoId === v?.videoId) === i)
              .sort((a, b) => (b?.viewCount || 0) - (a?.viewCount || 0))
          } />
        </TabsContent>

        {/* Engagement */}
        <TabsContent value="engagement" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatCard icon={<ThumbsUp />}      label="Total Engagement"   value={fmtNum(analytics.totalEngagement)}            gradient="blue"   small />
            <StatCard icon={<TrendingUp />}     label="Engagement Rate"    value={fmtPercent(analytics.overallEngagementRate)}  gradient="green"  small />
            <StatCard icon={<ThumbsUp />}       label="Avg Like Rate"      value={analytics.totalViews > 0 ? fmtPercent(analytics.totalLikes / analytics.totalViews * 100) : '0%'} gradient="red" small />
            <StatCard icon={<MessageSquare />}  label="Avg Comment Rate"   value={analytics.totalViews > 0 ? fmtPercent(analytics.totalComments / analytics.totalViews * 100) : '0%'} gradient="purple" small />
            <StatCard icon={<Flame />}          label="Virality Score"     value={`${analytics.viralityScore}x`}               gradient="orange" small />
            <StatCard icon={<BarChart2 />}      label="Like:Comment"       value={analytics.totalComments > 0 ? (analytics.totalLikes / analytics.totalComments).toFixed(1) + ':1' : 'N/A'} gradient="teal" small />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartCard title="Engagement Rate Trend">
              <AreaChart data={analytics.engagementTrend || []}>
                <defs><linearGradient id="egGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.green} stopOpacity={0.15} /><stop offset="95%" stopColor={C.green} stopOpacity={0.01} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={v => v + '%'} axisLine={false} tickLine={false} />
                <ReTooltip contentStyle={TS} />
                <Area type="monotone" dataKey="value" stroke={C.green} fill="url(#egGrad)" strokeWidth={2} name="Engagement %" />
              </AreaChart>
            </ChartCard>
            <ChartCard title="Like Rate Trend">
              <AreaChart data={analytics.likeRateTrend || []}>
                <defs><linearGradient id="lrGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.red} stopOpacity={0.12} /><stop offset="95%" stopColor={C.red} stopOpacity={0.01} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={v => v + '%'} axisLine={false} tickLine={false} />
                <ReTooltip contentStyle={TS} />
                <Area type="monotone" dataKey="value" stroke={C.red} fill="url(#lrGrad)" strokeWidth={2} name="Like Rate %" />
              </AreaChart>
            </ChartCard>
          </div>
          <MainCard title="Top 10 by Engagement Rate" content={false}>
            <VideoTable videos={analytics.top10ByEngagement} />
          </MainCard>
        </TabsContent>

        {/* Content */}
        <TabsContent value="content" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatCard icon={<Film />}         label="HD Videos"    value={analytics.hdCount}         subtitle={fmtPercent(analytics.hdPercentage)}         gradient="blue"   small />
            <StatCard icon={<MessageSquare />} label="Captions"    value={analytics.captionCount}    subtitle={fmtPercent(analytics.captionPercentage)}    gradient="green"  small />
            <StatCard icon={<Trophy />}        label="Licensed"    value={analytics.licensedCount}   subtitle={fmtPercent(analytics.licensedPercentage)}   gradient="purple" small />
            <StatCard icon={<VideoIcon />}     label="Embeddable"  value={analytics.embeddableCount} subtitle={fmtPercent(analytics.embeddablePercentage)} gradient="orange" small />
            <StatCard icon={<Users />}         label="Kids Content" value={analytics.madeForKidsCount}                                                      gradient="cyan"   small />
            <StatCard icon={<Timer />}         label="Avg Duration" value={analytics.avgDurationFormatted}                                                   gradient="amber"  small />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartCard title="Duration Distribution">
              <PieChart>
                <Pie data={durationData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={50} paddingAngle={3} strokeWidth={0}>
                  {durationData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <ReTooltip contentStyle={TS} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ChartCard>
            <ChartCard title="Category Distribution">
              <BarChart data={catData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} width={110} axisLine={false} tickLine={false} />
                <ReTooltip contentStyle={TS} />
                <Bar dataKey="value" fill={C.blue} radius={[0, 4, 4, 0]} name="Videos" />
              </BarChart>
            </ChartCard>
          </div>
          <ChartCard title="Views Distribution" height={240}>
            <BarChart data={(analytics.viewsDistribution?.ranges || []).map((r, i) => ({ range: r, count: analytics.viewsDistribution.counts[i] || 0 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="range" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <ReTooltip contentStyle={TS} />
              <Bar dataKey="count" fill={C.orange} radius={[4, 4, 0, 0]} name="Videos" />
            </BarChart>
          </ChartCard>
        </TabsContent>

        {/* Publishing */}
        <TabsContent value="publishing" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Calendar />}  label="Peak Publish Day"  value={analytics.peakPublishDay || 'N/A'}   gradient="blue"   small />
            <StatCard icon={<Clock />}     label="Peak Publish Hour" value={analytics.peakPublishHour !== undefined ? `${analytics.peakPublishHour}:00 UTC` : 'N/A'} gradient="green" small />
            <StatCard icon={<Zap />}       label="Uploads/Week"      value={analytics.uploadFrequencyPerWeek}     gradient="orange" small />
            <StatCard icon={<Trophy />}    label="Consistency"       value={`${analytics.consistencyScore}/100`}  gradient="purple" small />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartCard title="Publish Day Distribution">
              <BarChart data={dayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <ReTooltip contentStyle={TS} />
                <Bar dataKey="count" fill={C.blue} radius={[4, 4, 0, 0]} name="Videos" />
              </BarChart>
            </ChartCard>
            <ChartCard title="Publish Hour Distribution (UTC)">
              <AreaChart data={hourData}>
                <defs><linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.orange} stopOpacity={0.15} /><stop offset="95%" stopColor={C.orange} stopOpacity={0.01} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <ReTooltip contentStyle={TS} />
                <Area type="monotone" dataKey="count" stroke={C.orange} fill="url(#hourGrad)" strokeWidth={2} name="Videos" />
              </AreaChart>
            </ChartCard>
          </div>
        </TabsContent>

        {/* Growth */}
        <TabsContent value="growth" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<TrendingUp />} label="Est. Yearly Views" value={fmtNum(channel.estimatedYearlyViews)}    gradient="red"    small />
            <StatCard icon={<Users />}      label="Est. Yearly Subs"  value={fmtNum(channel.estimatedYearlySubGain)} gradient="green"  small />
            <StatCard icon={<Eye />}        label="Views/Day Avg"     value={fmtNum(channel.avgViewsPerDay)}          gradient="blue"   small />
            <StatCard icon={<Users />}      label="Subs/Day Avg"      value={fmtNum(channel.avgSubGainPerDay)}        gradient="purple" small />
          </div>
          <ChartCard title="Monthly Views Trend" height={300}>
            <AreaChart data={analytics.viewsTrend || []}>
              <defs><linearGradient id="viewGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.red} stopOpacity={0.12} /><stop offset="95%" stopColor={C.red} stopOpacity={0.01} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={fmtNum} axisLine={false} tickLine={false} />
              <ReTooltip contentStyle={TS} formatter={v => fmtNumFull(v)} />
              <Area type="monotone" dataKey="value" stroke={C.red} fill="url(#viewGrad)" strokeWidth={2} name="Views" />
            </AreaChart>
          </ChartCard>
          <ChartCard title="Monthly Upload Count" height={240}>
            <BarChart data={(analytics.viewsTrend || []).map(t => ({ month: t.month, uploads: t.count }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <ReTooltip contentStyle={TS} />
              <Bar dataKey="uploads" fill={C.green} radius={[4, 4, 0, 0]} name="Uploads" />
            </BarChart>
          </ChartCard>
        </TabsContent>

        {/* Shorts vs Regular */}
        <TabsContent value="shorts" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Flame />}     label="Shorts Count"      value={analytics.shortsCount}              gradient="red"    small />
            <StatCard icon={<VideoIcon />} label="Regular Videos"    value={analytics.regularCount}             gradient="blue"   small />
            <StatCard icon={<Eye />}       label="Avg Short Views"   value={fmtNum(analytics.avgShortViews)}    gradient="orange" small />
            <StatCard icon={<Eye />}       label="Avg Regular Views" value={fmtNum(analytics.avgRegularViews)}  gradient="green"  small />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <ChartCard title="Content Split">
                <PieChart>
                  <Pie data={[{ name: 'Shorts', value: analytics.shortsCount, color: C.red }, { name: 'Regular', value: analytics.regularCount, color: C.blue }].filter(d => d.value > 0)}
                    dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={50} paddingAngle={4} strokeWidth={0}>
                    {[{ color: C.red }, { color: C.blue }].map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <ReTooltip contentStyle={TS} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ChartCard>
            </div>
            <div className="md:col-span-3">
              <ChartCard title="Performance Comparison">
                <BarChart data={[
                  { metric: 'Avg Views', Shorts: analytics.avgShortViews,  Regular: analytics.avgRegularViews  },
                  { metric: 'Avg Likes', Shorts: analytics.avgShortLikes,  Regular: analytics.avgRegularLikes  },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="metric" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={fmtNum} axisLine={false} tickLine={false} />
                  <ReTooltip contentStyle={TS} formatter={v => fmtNumFull(v)} />
                  <Bar dataKey="Shorts"  fill={C.red}  radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Regular" fill={C.blue} radius={[4, 4, 0, 0]} />
                  <Legend />
                </BarChart>
              </ChartCard>
            </div>
          </div>
        </TabsContent>

        {/* Tags & SEO */}
        <TabsContent value="tags" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Tag />}         label="Unique Tags"    value={analytics.tagFrequency?.length || 0}       gradient="blue"   small />
            <StatCard icon={<MessageSquare />} label="Caption Rate" value={fmtPercent(analytics.captionPercentage)}   gradient="green"  small />
            <StatCard icon={<Film />}        label="HD Rate"        value={fmtPercent(analytics.hdPercentage)}        gradient="purple" small />
            <StatCard icon={<VideoIcon />}   label="Embeddable"     value={fmtPercent(analytics.embeddablePercentage)} gradient="orange" small />
          </div>
          <MainCard title="Most Used Tags">
            <div className="flex flex-wrap gap-2">
              {(analytics.tagFrequency || []).map(({ tag, count }, i) => (
                <Badge key={i} variant={i < 5 ? 'default' : 'outline'} className={cn('text-xs', i < 5 ? 'bg-primary' : '')}>
                  {tag} ({count})
                </Badge>
              ))}
              {(!analytics.tagFrequency || analytics.tagFrequency.length === 0) && (
                <p className="text-sm text-muted-foreground">No tags data available</p>
              )}
            </div>
          </MainCard>
          {(analytics.tagFrequency || []).length > 0 && (
            <ChartCard title="Tag Usage Frequency (Top 20)" height={400}>
              <BarChart data={(analytics.tagFrequency || []).slice(0, 20)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="tag" type="category" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} width={140} axisLine={false} tickLine={false} />
                <ReTooltip contentStyle={TS} />
                <Bar dataKey="count" fill={C.red} radius={[0, 4, 4, 0]} name="Usage Count" />
              </BarChart>
            </ChartCard>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
