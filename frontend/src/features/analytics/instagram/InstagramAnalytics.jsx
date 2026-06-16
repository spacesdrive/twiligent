import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { Spinner } from '@/components/ui/spinner';
import StatCard from '../../../components/ui/StatCard';
import MainCard from '../../../components/MainCard';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, fmtNumFull, fmtDate, timeAgo } from '../../../utils/formatters';
import {
  ArrowLeft, RefreshCw, Heart, MessageCircle, Users, UserPlus, Image,
  TrendingUp, Calendar, Clock, Zap, Flame, Trophy, Star, Camera,
  ExternalLink, BarChart2, Hash,
} from 'lucide-react';

const IG_COLORS = ['#F58529', '#DD2A7B', '#8134AF', '#515BD4', '#FEDA77', '#405DE6'];
const MEDIA_TYPE_NAMES  = { IMAGE: 'Photos', VIDEO: 'Videos', CAROUSEL_ALBUM: 'Carousels', REEL: 'Reels' };
const MEDIA_TYPE_COLORS = { IMAGE: '#F58529', VIDEO: '#DD2A7B', CAROUSEL_ALBUM: '#8134AF', REEL: '#515BD4' };

const TS = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 };

export default function InstagramAnalytics() {
  const { id } = useParams();
  const { accounts, showToast } = useAppContext();
  const navigate = useNavigate();
  const account = accounts.find(a => a.id === id);

  const [loading,    setLoading]    = useState(true);
  const [profile,    setProfile]    = useState(null);
  const [analytics,  setAnalytics]  = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadAnalytics = async () => {
    if (!account) return;
    setLoading(true);
    try {
      const data = await api.getIGAnalytics(account.id);
      setProfile(data.profile);
      setAnalytics(data.analytics);
    } catch (err) {
      showToast('Failed to load Instagram analytics: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAnalytics(); }, [id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.refreshAccount(account.id);
      await loadAnalytics();
      showToast('Instagram account refreshed!');
    } catch (err) {
      showToast('Refresh failed: ' + err.message, 'error');
    } finally {
      setRefreshing(false);
    }
  };

  if (!account) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" onClick={() => navigate('/')} className="gap-2 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <p className="text-muted-foreground">Account not found.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="size-10" />
          <p className="text-sm text-muted-foreground">Loading analytics…</p>
        </div>
      </div>
    );
  }

  const p = profile || account;
  const a = analytics || {};

  const mediaTypeData = a.mediaTypeDistribution
    ? Object.entries(a.mediaTypeDistribution).map(([key, value], i) => ({ name: MEDIA_TYPE_NAMES[key] || key, value, color: MEDIA_TYPE_COLORS[key] || IG_COLORS[i % IG_COLORS.length] }))
    : [];
  const topPostsData = (a.topPosts || []).slice(0, 8).map((post, i) => ({ name: `#${i + 1}`, likes: post.likeCount, comments: post.commentsCount }));
  const perfByTypeData = a.performanceByType
    ? Object.entries(a.performanceByType).map(([type, s]) => ({ name: MEDIA_TYPE_NAMES[type] || type, avgLikes: s.avgLikes, avgComments: s.avgComments, count: s.count, color: MEDIA_TYPE_COLORS[type] || '#999' }))
    : [];
  const dayOfWeekData = (a.postsByDayOfWeek || []).map(d => ({ name: d.shortDay, posts: d.posts, avgEngagement: d.avgEngagement, avgLikes: d.avgLikes }));
  const timelineData  = (a.engagementTimeline || []).map(m => ({ name: m.month, posts: m.posts, likes: m.likes, comments: m.comments, avgLikes: m.avgLikes }));
  const captionData   = a.captionLengthCorrelation || [];

  return (
    <div className="space-y-5">
      {/* Profile header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/')} size="icon" className="h-9 w-9 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-14 w-14 border-2 border-border">
            <AvatarImage src={p.profilePictureUrl} />
            <AvatarFallback className="bg-gradient-to-br from-pink-500 to-purple-600 text-white font-bold">
              {(p.name || p.username || 'IG').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{p.name || p.username}</h2>
              <Camera className="h-4 w-4 text-pink-500" />
            </div>
            <p className="text-sm text-muted-foreground">@{p.username}</p>
            {p.biography && <p className="text-xs text-muted-foreground mt-0.5 max-w-md line-clamp-2">{p.biography}</p>}
          </div>
        </div>
        <Button size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2 shrink-0">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {refreshing && <Progress className="h-1" />}

      {/* KPI stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard icon={<Users />}         label="Followers"       value={fmtNum(p.followersCount)}                  subtitle={fmtNumFull(p.followersCount)} gradient="purple" small />
        <StatCard icon={<UserPlus />}      label="Following"       value={fmtNum(p.followsCount)}                    subtitle={fmtNumFull(p.followsCount)}   gradient="blue"   small />
        <StatCard icon={<Image />}         label="Total Posts"     value={fmtNum(a.totalPosts || p.mediaCount)}      subtitle={`${a.fetchedPosts || 0} analyzed`} gradient="orange" small />
        <StatCard icon={<Heart />}         label="Total Likes"     value={fmtNum(a.totalLikes)}                      subtitle={fmtNumFull(a.totalLikes)}     gradient="red"    small />
        <StatCard icon={<MessageCircle />} label="Total Comments"  value={fmtNum(a.totalComments)}                   subtitle={fmtNumFull(a.totalComments)}  gradient="teal"   small />
        <StatCard icon={<TrendingUp />}    label="Engagement Rate" value={`${a.engagementRate || 0}%`}               subtitle={`Avg ${fmtNum(a.avgLikes)} likes/post`} gradient="green" small />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard icon={<Zap />}          label="Avg Likes/Post" value={fmtNum(a.avgLikes)}             gradient="cyan"   small />
        <StatCard icon={<MessageCircle />} label="Avg Comments"  value={fmtNum(a.avgComments)}          gradient="indigo" small />
        <StatCard icon={<BarChart2 />}    label="Median Likes"   value={fmtNum(a.medianLikes)}          gradient="amber"  small />
        <StatCard icon={<Users />}        label="Follower Ratio" value={p.followersCount > 0 ? (p.followersCount / Math.max(1, p.followsCount)).toFixed(1) : '0'} subtitle="Followers / Following" gradient="pink" small />
        <StatCard icon={<Heart />}        label="Likes/Follower" value={`${a.likesPerFollower || 0}%`}  subtitle="Per post avg"     gradient="red"  small />
        <StatCard icon={<TrendingUp />}   label="Like:Comment"   value={`${a.likesToCommentsRatio || 0}:1`} subtitle="Ratio"        gradient="blue" small />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard icon={<Calendar />}  label="Posts/Week"   value={a.postFrequency?.perWeek || 0}    subtitle={`${a.postFrequency?.perMonth || 0}/month`} gradient="orange" small />
        <StatCard icon={<Calendar />}  label="Last 7 Days"  value={a.postsLast7Days || 0}            subtitle="Recent posts"        gradient="red"    small />
        <StatCard icon={<Calendar />}  label="Last 30 Days" value={a.postsLast30Days || 0}           subtitle="Monthly"             gradient="green"  small />
        <StatCard icon={<Calendar />}  label="Last 90 Days" value={a.postsLast90Days || 0}           subtitle="Quarterly"           gradient="blue"   small />
        <StatCard icon={<Flame />}     label="Virality"     value={`${a.viralityScore || 0}x`}       subtitle="Best vs Average"     gradient="pink"   small />
        <StatCard icon={<Trophy />}    label="Consistency"  value={`${a.consistencyScore || 0}/100`} subtitle="Engagement stability" gradient="amber"  small />
      </div>

      {/* Insights row */}
      <MainCard>
        <div className="flex gap-2 flex-wrap items-center">
          {a.bestPostingDay && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700">
              <Star className="h-3 w-3" /> Best Day: {a.bestPostingDay}
            </span>
          )}
          {a.bestPostingHour && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 border border-green-200 text-green-700">
              <Clock className="h-3 w-3" /> Best Hour: {a.bestPostingHour}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-700">
            <TrendingUp className="h-3 w-3" /> Avg Engagement: {fmtNum(a.avgEngagement || 0)}/post
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 border border-purple-200 text-purple-700">
            <Trophy className="h-3 w-3" /> Consistency: {a.consistencyScore || 0}/100
          </span>
        </div>
      </MainCard>

      {/* Engagement timeline + content mix */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <MainCard title="Engagement Timeline" className="xl:col-span-2" contentClassName="p-3">
          {timelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280} debounce={200}>
              <AreaChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <ReTooltip contentStyle={TS} />
                <Area type="monotone" dataKey="likes"    name="Likes"    stroke="#DD2A7B" fill="rgba(221,42,123,0.1)" />
                <Area type="monotone" dataKey="comments" name="Comments" stroke="#8134AF" fill="rgba(129,52,175,0.1)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-10">Not enough data for timeline</p>}
        </MainCard>
        <MainCard title="Content Type Mix" contentClassName="p-3">
          {mediaTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280} debounce={200}>
              <PieChart>
                <Pie data={mediaTypeData} dataKey="value" nameKey="name" cx="50%" cy="44%" outerRadius={80} innerRadius={42} paddingAngle={3} strokeWidth={0}>
                  {mediaTypeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <ReTooltip contentStyle={TS} formatter={(v, n) => [`${v} posts`, n]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-10">No data</p>}
        </MainCard>
      </div>

      {/* Performance by type + Day of week */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MainCard title="Performance by Content Type" contentClassName="p-3">
          {perfByTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260} debounce={200}>
              <BarChart data={perfByTypeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <ReTooltip contentStyle={TS} />
                <Bar dataKey="avgLikes"    name="Avg Likes"    fill="#DD2A7B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgComments" name="Avg Comments" fill="#8134AF" radius={[4, 4, 0, 0]} />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-10">No data</p>}
        </MainCard>
        <MainCard title="Best Posting Days" contentClassName="p-3">
          {dayOfWeekData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260} debounce={200}>
              <BarChart data={dayOfWeekData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <ReTooltip contentStyle={TS} />
                <Bar dataKey="avgEngagement" name="Avg Engagement" fill="#F58529" radius={[4, 4, 0, 0]} />
                <Bar dataKey="posts"         name="Posts"          fill="var(--muted)" radius={[4, 4, 0, 0]} />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-10">No data</p>}
        </MainCard>
      </div>

      {/* Top posts + caption length */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MainCard title="Top Posts by Engagement" contentClassName="p-3">
          {topPostsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260} debounce={200}>
              <BarChart data={topPostsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <ReTooltip contentStyle={TS} />
                <Bar dataKey="likes"    name="Likes"    fill="#DD2A7B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="comments" name="Comments" fill="#8134AF" radius={[4, 4, 0, 0]} />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-10">No data</p>}
        </MainCard>
        <MainCard title="Caption Length vs Engagement" contentClassName="p-3">
          {captionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260} debounce={200}>
              <BarChart data={captionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <ReTooltip contentStyle={TS} />
                <Bar dataKey="avgEngagement" name="Avg Engagement" fill="#515BD4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-10">No data</p>}
        </MainCard>
      </div>

      {/* Monthly posting volume */}
      {timelineData.length > 1 && (
        <MainCard title="Monthly Posting Volume" contentClassName="p-3">
          <ResponsiveContainer width="100%" height={220} debounce={200}>
            <BarChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
              <ReTooltip contentStyle={TS} />
              <Bar dataKey="posts" name="Posts" fill="#F58529" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </MainCard>
      )}

      {/* Top hashtags */}
      {(a.hashtagAnalysis || []).length > 0 && (
        <MainCard title="Top Hashtags">
          <div className="flex flex-wrap gap-2">
            {a.hashtagAnalysis.slice(0, 20).map((h, i) => (
              <Tooltip key={h.tag}>
                <TooltipTrigger>
                  <Badge
                    variant="outline"
                    className="text-xs cursor-default"
                    style={{ borderColor: `${IG_COLORS[i % IG_COLORS.length]}60`, color: IG_COLORS[i % IG_COLORS.length], background: `${IG_COLORS[i % IG_COLORS.length]}10` }}
                  >
                    <Hash className="h-2.5 w-2.5 mr-0.5" />{h.tag} ({h.count})
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Used {h.count}x · Avg engagement: {fmtNum(h.avgEngagement)}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </MainCard>
      )}

      {/* Recent posts grid */}
      <MainCard title={`Recent Posts (${a.fetchedPosts || 0} loaded)`}>
        {(a.recentMedia || []).length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-2">
            {a.recentMedia.map((post) => (
              <div
                key={post.id}
                className="relative aspect-square rounded-lg overflow-hidden border border-border cursor-pointer group hover:shadow-md transition-shadow"
                onClick={() => post.permalink && window.open(post.permalink, '_blank')}
              >
                <img src={post.thumbnailUrl || post.mediaUrl} className="w-full h-full object-cover" alt=""
                  onError={e => { e.target.style.display = 'none'; }} />
                {post.mediaType !== 'IMAGE' && (
                  <span className="absolute top-1 right-1 bg-black/65 text-white text-[9px] font-semibold px-1 rounded">
                    {MEDIA_TYPE_NAMES[post.mediaType]?.[0] || 'V'}
                  </span>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-1 gap-2">
                  <span className="flex items-center gap-0.5 text-white text-[10px] font-semibold"><Heart className="h-2.5 w-2.5" />{fmtNum(post.likeCount)}</span>
                  <span className="flex items-center gap-0.5 text-white text-[10px] font-semibold"><MessageCircle className="h-2.5 w-2.5" />{fmtNum(post.commentsCount)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground text-center py-6">No posts found</p>}
      </MainCard>

      {/* Top posts table */}
      {(a.topPosts || []).length > 0 && (
        <MainCard title="Top Performing Posts" content={false}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Caption</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Likes</TableHead>
                <TableHead className="text-right">Comments</TableHead>
                <TableHead className="text-right">Engagement</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.topPosts.slice(0, 10).map((post, i) => (
                <TableRow key={post.id}>
                  <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="max-w-[200px]"><p className="text-sm truncate">{post.caption || '(no caption)'}</p></TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] h-5" style={{ borderColor: `${MEDIA_TYPE_COLORS[post.mediaType] || '#999'}50`, color: MEDIA_TYPE_COLORS[post.mediaType] || '#999', background: `${MEDIA_TYPE_COLORS[post.mediaType] || '#999'}10` }}>
                      {MEDIA_TYPE_NAMES[post.mediaType] || post.mediaType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">{fmtNum(post.likeCount)}</TableCell>
                  <TableCell className="text-right text-sm">{fmtNum(post.commentsCount)}</TableCell>
                  <TableCell className="text-right text-sm">{fmtNum(post.engagement)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(post.timestamp)}</TableCell>
                  <TableCell>
                    {post.permalink && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(post.permalink, '_blank')}>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      )}

      {/* Performance by type table */}
      {perfByTypeData.length > 0 && (
        <MainCard title="Performance Summary by Content Type" content={false}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Avg Likes</TableHead>
                <TableHead className="text-right">Avg Comments</TableHead>
                <TableHead className="text-right">Avg Engagement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perfByTypeData.map(row => (
                <TableRow key={row.name}>
                  <TableCell>
                    <Badge variant="outline" className="text-xs" style={{ borderColor: `${row.color}50`, color: row.color, background: `${row.color}10` }}>
                      {row.name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
                  <TableCell className="text-right">{fmtNum(row.avgLikes)}</TableCell>
                  <TableCell className="text-right">{fmtNum(row.avgComments)}</TableCell>
                  <TableCell className="text-right">{fmtNum(row.avgLikes + row.avgComments)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      )}

      <p className="text-xs text-muted-foreground text-center">Last updated: {timeAgo(account.lastUpdated)}</p>
    </div>
  );
}
