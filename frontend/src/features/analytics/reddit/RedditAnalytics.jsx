import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Spinner } from '@/components/ui/spinner';
import StatCard from '../../../components/ui/StatCard';
import MainCard from '../../../components/MainCard';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, fmtNumFull, fmtDate, timeAgo } from '../../../utils/formatters';
import {
  ArrowLeft, RefreshCw, TrendingUp, MessageSquare, Award, BarChart2,
  Calendar, Clock, Zap, Flame, Trophy, ExternalLink, FileText, Link2,
  Image, Video, Star,
} from 'lucide-react';

const REDDIT_COLORS = ['#FF4500', '#FF6534', '#FF8C00', '#FFA500', '#FFB347', '#FFC080'];
const MEDIA_TYPE_LABELS = { text: 'Text', image: 'Image', video: 'Video', link: 'Link' };
const MEDIA_TYPE_COLORS = { text: '#6366f1', image: '#22c55e', video: '#f97316', link: '#06b6d4' };

const TS = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 };

export default function RedditAnalytics() {
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
      const data = await api.getRedditAnalytics(account.id);
      setProfile(data.profile);
      setAnalytics(data.analytics);
    } catch (err) {
      showToast('Failed to load Reddit analytics: ' + err.message, 'error');
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
      showToast('Reddit account refreshed');
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
          <p className="text-sm text-muted-foreground">Loading Reddit analytics...</p>
        </div>
      </div>
    );
  }

  const p = profile || account;
  const a = analytics || {};

  const mediaTypeData = a.mediaTypeDistribution
    ? Object.entries(a.mediaTypeDistribution).map(([key, value], i) => ({
        name: MEDIA_TYPE_LABELS[key] || key,
        value,
        color: MEDIA_TYPE_COLORS[key] || REDDIT_COLORS[i % REDDIT_COLORS.length],
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-2 -ml-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* Profile header */}
      <MainCard>
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={p.iconUrl || account.thumbnail} />
              <AvatarFallback className="bg-orange-500 text-white font-bold text-lg">
                {(p.username || account.title || '?').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">u/{p.username || account.username}</h1>
                {p.isGold && <Badge className="bg-yellow-500 text-white text-xs">Gold</Badge>}
                {p.verified && <Badge className="bg-blue-500 text-white text-xs">Verified</Badge>}
                {p.isMod && <Badge variant="outline" className="text-xs">Moderator</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Reddit account
                {p.createdAt ? ` - joined ${fmtDate(p.createdAt)}` : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Last refreshed: {timeAgo(account.lastUpdated)}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => navigate(`/reddit-posts/${account.id}`)}
            >
              <FileText className="h-3.5 w-3.5" />
              View Posts
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </MainCard>

      {/* Karma - separate from profile since it's the key engagement metric on Reddit */}
      <MainCard>
        <div className="flex items-center gap-2 mb-4">
          <Flame className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-semibold">Karma</span>
          <span className="text-xs text-muted-foreground">earned across posts and comments</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Karma',   value: fmtNum(p.totalKarma),   sub: fmtNumFull(p.totalKarma) },
            { label: 'Post Karma',    value: fmtNum(p.postKarma),    sub: 'from submitted posts' },
            { label: 'Comment Karma', value: fmtNum(p.commentKarma), sub: 'from comments' },
            { label: 'Awardee Karma', value: fmtNum(p.awardeeKarma ?? 0), sub: 'from received awards' },
          ].map(item => (
            <div key={item.label} className="text-center p-3 rounded-lg bg-muted/40">
              <p className="text-xl font-bold tabular-nums text-orange-500">{item.value}</p>
              <p className="text-xs font-medium mt-0.5">{item.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.sub}</p>
            </div>
          ))}
        </div>
      </MainCard>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={<TrendingUp />}    label="Posts Fetched"   value={fmtNum(a.fetchedPosts)} subtitle={`${a.postsLast30Days ?? 0} in the last 30 days`} gradient="orange" />
        <StatCard icon={<Award />}         label="Total Karma"     value={fmtNum(a.totalScore)} subtitle={`Avg ${fmtNum(a.avgScore)} per post`} gradient="red" />
        <StatCard icon={<MessageSquare />} label="Total Comments"  value={fmtNum(a.totalComments)} subtitle={`Avg ${fmtNum(a.avgComments)} per post`} gradient="blue" />
        <StatCard icon={<Star />}          label="Awards Received" value={fmtNum(a.totalAwards ?? 0)} subtitle={`Avg ${a.avgAwards ?? 0} per post`} gradient="purple" />
      </div>

      {/* Karma timeline + media type pie */}
      {a.monthlyBreakdown?.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <MainCard title="Karma Over Time" className="xl:col-span-2">
            <ResponsiveContainer width="100%" height={240} debounce={200}>
              <AreaChart data={a.monthlyBreakdown} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="redditGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#FF4500" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#FF4500" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={fmtNum} axisLine={false} tickLine={false} width={48} />
                <ReTooltip contentStyle={TS} formatter={(v, n) => [fmtNumFull(v), n === 'score' ? 'Total Karma' : 'Posts']} />
                <Area type="monotone" dataKey="score" stroke="#FF4500" strokeWidth={2} fill="url(#redditGrad)" dot={{ fill: '#FF4500', r: 3, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </MainCard>

          {mediaTypeData.length > 0 && (
            <MainCard title="Post Type Breakdown">
              <ResponsiveContainer width="100%" height={240} debounce={200}>
                <PieChart>
                  <Pie data={mediaTypeData} dataKey="value" nameKey="name" cx="50%" cy="44%" outerRadius={80} innerRadius={44} paddingAngle={3} strokeWidth={0}>
                    {mediaTypeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <ReTooltip contentStyle={TS} formatter={(v) => [fmtNumFull(v), 'posts']} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </MainCard>
          )}
        </div>
      )}

      {/* Detailed metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <MainCard title="Posting Frequency">
          <div className="space-y-3">
            {[
              { label: 'Last 7 days',  value: `${a.postsLast7Days} posts` },
              { label: 'Last 30 days', value: `${a.postsLast30Days} posts` },
              { label: 'Last 90 days', value: `${a.postsLast90Days} posts` },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="text-sm font-semibold tabular-nums">{item.value}</span>
              </div>
            ))}
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Avg per week</span>
              <span className="text-sm font-semibold tabular-nums">{a.postFrequency?.perWeek ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Avg per month</span>
              <span className="text-sm font-semibold tabular-nums">{a.postFrequency?.perMonth ?? 0}</span>
            </div>
          </div>
        </MainCard>

        <MainCard title="Karma Breakdown">
          <div className="space-y-3">
            {[
              { label: 'Average karma',    value: fmtNum(a.avgScore) },
              { label: 'Median karma',     value: fmtNum(a.medianScore) },
              { label: 'Best single post', value: fmtNum(a.topPosts?.[0]?.score) },
              { label: 'Avg upvote ratio', value: `${a.avgUpvoteRatio ?? 0}%` },
              { label: 'Total comments',   value: fmtNum(a.totalComments) },
              { label: 'Avg comments',     value: fmtNum(a.avgComments) },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="text-sm font-semibold tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
        </MainCard>

        <MainCard title="Performance Indicators">
          <div className="space-y-4">
            {[
              { label: 'Virality Score', value: a.viralityScore, max: Math.max(10, a.viralityScore), desc: 'Ratio of peak post karma to average - higher means bigger outlier hits' },
              { label: 'Consistency',    value: a.consistencyScore, max: 100, desc: 'Karma reliability across posts - 100 means very uniform performance' },
            ].map(item => (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground tabular-nums">{item.value}</span>
                </div>
                <Progress value={(item.value / item.max) * 100} className="h-1.5" />
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </MainCard>
      </div>

      {/* Best posting times */}
      {a.postsByDayOfWeek?.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <MainCard title="Posts by Day of Week">
            <ResponsiveContainer width="100%" height={220} debounce={200}>
              <BarChart data={a.postsByDayOfWeek} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="shortDay" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={fmtNum} axisLine={false} tickLine={false} width={36} />
                <ReTooltip contentStyle={TS} formatter={(v, n) => [fmtNumFull(v), n === 'avgScore' ? 'Avg Karma' : 'Posts']} />
                <Bar dataKey="posts"    fill="#FF4500" opacity={0.35} radius={[3, 3, 0, 0]} />
                <Bar dataKey="avgScore" fill="#FF4500" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {a.bestPostingDay && (
              <p className="text-xs text-muted-foreground mt-2">
                Best day: <span className="font-medium text-foreground">{a.bestPostingDay}</span>
              </p>
            )}
          </MainCard>

          <MainCard title="Posts by Hour">
            <ResponsiveContainer width="100%" height={220} debounce={200}>
              <BarChart data={a.postsByHour} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="hour" tickFormatter={h => `${h}h`} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={fmtNum} axisLine={false} tickLine={false} width={36} />
                <ReTooltip contentStyle={TS} formatter={(v, n) => [fmtNumFull(v), n === 'avgScore' ? 'Avg Karma' : 'Posts']} />
                <Bar dataKey="avgScore" fill="#FF6534" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {a.bestPostingHour && (
              <p className="text-xs text-muted-foreground mt-2">
                Best hour: <span className="font-medium text-foreground">{a.bestPostingHour}</span>
              </p>
            )}
          </MainCard>
        </div>
      )}

      {/* Subreddit breakdown */}
      {a.subredditBreakdown?.length > 0 && (
        <MainCard title="Top Subreddits" content={false}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Subreddit</TableHead>
                <TableHead className="text-right">Posts</TableHead>
                <TableHead className="text-right">Total Karma</TableHead>
                <TableHead className="text-right">Avg Karma</TableHead>
                <TableHead className="text-right">Avg Comments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.subredditBreakdown.map((sub, i) => (
                <TableRow key={sub.subreddit}>
                  <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                  <TableCell>
                    <a
                      href={`https://reddit.com/r/${sub.subreddit}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:underline flex items-center gap-1"
                    >
                      r/{sub.subreddit}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{sub.posts}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{fmtNum(sub.totalScore)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{fmtNum(sub.avgScore)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{fmtNum(sub.avgComments)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      )}

      {/* Top posts */}
      {a.topPosts?.length > 0 && (
        <MainCard title="Top Posts by Karma" content={false}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Post</TableHead>
                <TableHead className="text-right">Karma</TableHead>
                <TableHead className="text-right">Comments</TableHead>
                <TableHead className="text-right">Upvote %</TableHead>
                <TableHead className="text-right">Posted</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.topPosts.map((post, i) => (
                <TableRow key={post.id}>
                  <TableCell>
                    <span className={`text-xs font-bold ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-400' : 'text-muted-foreground'}`}>
                      {i + 1}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-sm">
                      <p className="text-sm font-medium leading-snug line-clamp-2">{post.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{post.subredditPrefixed}</span>
                        {post.flair && <Badge variant="outline" className="text-[10px] px-1 py-0">{post.flair}</Badge>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums text-orange-500">{fmtNum(post.score)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{fmtNum(post.numComments)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{Math.round((post.upvoteRatio ?? 0) * 100)}%</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{fmtDate(post.createdAt)}</TableCell>
                  <TableCell>
                    <a href={post.permalink} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="size-7">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      )}
    </div>
  );
}
