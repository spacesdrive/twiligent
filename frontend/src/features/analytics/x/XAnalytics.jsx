import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  ArrowLeft, RefreshCw, TrendingUp, MessageSquare, BarChart2,
  Calendar, Clock, Zap, Flame, Trophy, ExternalLink, FileText,
  Heart, Repeat2, Quote, Bookmark, Eye, CheckCircle2, MapPin, Link2,
} from 'lucide-react';

const X_BLUE = '#1D9BF0';
const X_COLORS = ['#1D9BF0', '#0F6CBD', '#7BC8F6', '#5B9BD5', '#A8D8F0', '#C8E8F8'];
const TYPE_LABELS = { tweet: 'Original', retweet: 'Retweet', reply: 'Reply', quote: 'Quote' };
const TYPE_COLORS = { tweet: '#1D9BF0', retweet: '#17BF63', reply: '#F45D22', quote: '#794BC4' };

const TS = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 };

export default function XAnalytics() {
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
      const data = await api.getXAnalytics(account.id);
      setProfile(data.profile);
      setAnalytics(data.analytics);
    } catch (err) {
      showToast('Failed to load X analytics: ' + err.message, 'error');
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
      showToast('X account refreshed');
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
          <p className="text-sm text-muted-foreground">Loading X analytics...</p>
        </div>
      </div>
    );
  }

  const p = profile || account;
  const a = analytics || {};

  const tweetTypeData = a.tweetTypeDistribution
    ? Object.entries(a.tweetTypeDistribution)
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({
          name: TYPE_LABELS[key] || key,
          value,
          color: TYPE_COLORS[key] || X_COLORS[0],
        }))
    : [];

  const isVerified = p.verifiedType && p.verifiedType !== 'none';

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-2 -ml-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* Profile header */}
      <MainCard>
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={p.profileImageUrl || p.thumbnail} />
              <AvatarFallback style={{ background: X_BLUE }} className="text-white font-bold text-lg">
                {(p.username || p.title || '?').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{p.displayName || p.title}</h1>
                {isVerified && (
                  <CheckCircle2 className="h-5 w-5 text-blue-400 flex-shrink-0" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">@{p.username}</p>
              {p.description && (
                <p className="text-sm mt-1 max-w-md leading-snug">{p.description}</p>
              )}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {p.location && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {p.location}
                  </span>
                )}
                {p.website && (
                  <a href={p.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
                    <Link2 className="h-3 w-3" /> {p.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {p.createdAt && (
                  <span className="text-xs text-muted-foreground">Joined {fmtDate(p.createdAt)}</span>
                )}
              </div>
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
              onClick={() => navigate(`/x-tweets/${account.id}`)}
            >
              <FileText className="h-3.5 w-3.5" />
              View Tweets
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

      {/* Account stats - followers/following are the core audience metrics */}
      <MainCard>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4" style={{ color: X_BLUE }} />
          <span className="text-sm font-semibold">Account</span>
          <span className="text-xs text-muted-foreground">followers and activity totals</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Followers',  value: fmtNum(p.followersCount),  sub: fmtNumFull(p.followersCount) },
            { label: 'Following',  value: fmtNum(p.followingCount),  sub: 'accounts followed' },
            { label: 'Tweets',     value: fmtNum(p.tweetCount),      sub: 'lifetime posts' },
            { label: 'Listed',     value: fmtNum(p.listedCount ?? 0), sub: 'public lists' },
          ].map(item => (
            <div key={item.label} className="text-center p-3 rounded-lg bg-muted/40">
              <p className="text-xl font-bold tabular-nums" style={{ color: X_BLUE }}>{item.value}</p>
              <p className="text-xs font-medium mt-0.5">{item.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.sub}</p>
            </div>
          ))}
        </div>
      </MainCard>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={<FileText />}    label="Tweets Fetched"    value={fmtNum(a.fetchedTweets)} subtitle={`${a.postsLast30Days ?? 0} in the last 30 days`} gradient="blue" />
        <StatCard icon={<Heart />}       label="Total Likes"       value={fmtNum(a.totalLikes)} subtitle={`Avg ${fmtNum(a.avgLikes)} per tweet`} gradient="red" />
        <StatCard icon={<Eye />}         label="Total Impressions" value={fmtNum(a.totalImpressions)} subtitle={`Avg ${fmtNum(a.avgImpressions)} per tweet`} gradient="purple" />
        <StatCard icon={<TrendingUp />}  label="Engagement Rate"   value={`${a.engagementRate ?? 0}%`} subtitle="(likes+retweets+replies) / followers" gradient="green" />
      </div>

      {/* Impressions timeline + tweet type pie */}
      {a.monthlyBreakdown?.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <MainCard title="Impressions Over Time" className="xl:col-span-2">
            <ResponsiveContainer width="100%" height={240} debounce={200}>
              <AreaChart data={a.monthlyBreakdown} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="xGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={X_BLUE} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={X_BLUE} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={fmtNum} axisLine={false} tickLine={false} width={48} />
                <ReTooltip contentStyle={TS} formatter={(v, n) => [fmtNumFull(v), n === 'impressions' ? 'Impressions' : 'Likes']} />
                <Area type="monotone" dataKey="impressions" stroke={X_BLUE} strokeWidth={2} fill="url(#xGrad)" dot={{ fill: X_BLUE, r: 3, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </MainCard>

          {tweetTypeData.length > 0 && (
            <MainCard title="Tweet Type Breakdown">
              <ResponsiveContainer width="100%" height={240} debounce={200}>
                <PieChart>
                  <Pie data={tweetTypeData} dataKey="value" nameKey="name" cx="50%" cy="44%" outerRadius={80} innerRadius={44} paddingAngle={3} strokeWidth={0}>
                    {tweetTypeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <ReTooltip contentStyle={TS} formatter={(v) => [fmtNumFull(v), 'tweets']} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </MainCard>
          )}
        </div>
      )}

      {/* Detail cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <MainCard title="Posting Frequency">
          <div className="space-y-3">
            {[
              { label: 'Last 7 days',  value: `${a.postsLast7Days} tweets` },
              { label: 'Last 30 days', value: `${a.postsLast30Days} tweets` },
              { label: 'Last 90 days', value: `${a.postsLast90Days} tweets` },
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

        <MainCard title="Engagement Breakdown">
          <div className="space-y-3">
            {[
              { label: 'Avg likes',      value: fmtNum(a.avgLikes) },
              { label: 'Avg retweets',   value: fmtNum(a.avgRetweets) },
              { label: 'Avg replies',    value: fmtNum(a.avgReplies) },
              { label: 'Total quotes',   value: fmtNum(a.totalQuotes) },
              { label: 'Total bookmarks',value: fmtNum(a.totalBookmarks) },
              { label: 'Avg engagement', value: fmtNum(a.avgEngagement) },
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
              { label: 'Virality Score', value: a.viralityScore, max: Math.max(10, a.viralityScore), desc: 'Ratio of best tweet likes to average - higher means more viral outliers' },
              { label: 'Consistency',    value: a.consistencyScore, max: 100, desc: 'Like reliability across tweets - 100 means very uniform performance' },
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
          <MainCard title="Tweets by Day of Week">
            <ResponsiveContainer width="100%" height={220} debounce={200}>
              <BarChart data={a.postsByDayOfWeek} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="shortDay" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={fmtNum} axisLine={false} tickLine={false} width={36} />
                <ReTooltip contentStyle={TS} formatter={(v, n) => [fmtNumFull(v), n === 'avgLikes' ? 'Avg Likes' : 'Tweets']} />
                <Bar dataKey="posts"    fill={X_BLUE} opacity={0.35} radius={[3, 3, 0, 0]} />
                <Bar dataKey="avgLikes" fill={X_BLUE} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {a.bestPostingDay && (
              <p className="text-xs text-muted-foreground mt-2">
                Best day: <span className="font-medium text-foreground">{a.bestPostingDay}</span>
              </p>
            )}
          </MainCard>

          <MainCard title="Tweets by Hour">
            <ResponsiveContainer width="100%" height={220} debounce={200}>
              <BarChart data={a.postsByHour} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="hour" tickFormatter={h => `${h}h`} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={fmtNum} axisLine={false} tickLine={false} width={36} />
                <ReTooltip contentStyle={TS} formatter={(v, n) => [fmtNumFull(v), n === 'avgLikes' ? 'Avg Likes' : 'Tweets']} />
                <Bar dataKey="avgLikes" fill="#0F6CBD" radius={[3, 3, 0, 0]} />
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

      {/* Likes timeline bar chart */}
      {a.monthlyBreakdown?.length > 0 && (
        <MainCard title="Likes by Month">
          <ResponsiveContainer width="100%" height={200} debounce={200}>
            <BarChart data={a.monthlyBreakdown} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={fmtNum} axisLine={false} tickLine={false} width={48} />
              <ReTooltip contentStyle={TS} formatter={(v, n) => [fmtNumFull(v), n === 'likes' ? 'Likes' : n === 'retweets' ? 'Retweets' : 'Posts']} />
              <Bar dataKey="likes"    fill={X_BLUE}  radius={[3, 3, 0, 0]} />
              <Bar dataKey="retweets" fill="#17BF63" radius={[3, 3, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </MainCard>
      )}

      {/* Top tweets */}
      {a.topTweets?.length > 0 && (
        <MainCard title="Top Tweets by Likes" content={false}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Tweet</TableHead>
                <TableHead className="text-right">Likes</TableHead>
                <TableHead className="text-right">Retweets</TableHead>
                <TableHead className="text-right">Replies</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">Posted</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.topTweets.map((tweet, i) => (
                <TableRow key={tweet.id}>
                  <TableCell>
                    <span className={`text-xs font-bold ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-400' : 'text-muted-foreground'}`}>
                      {i + 1}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-sm">
                      <p className="text-sm leading-snug line-clamp-2">{tweet.text}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {TYPE_LABELS[tweet.isRetweet ? 'retweet' : tweet.isReply ? 'reply' : tweet.isQuote ? 'quote' : 'tweet']}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums" style={{ color: X_BLUE }}>{fmtNum(tweet.likeCount)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{fmtNum(tweet.retweetCount)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{fmtNum(tweet.replyCount)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{fmtNum(tweet.impressionCount)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{fmtDate(tweet.createdAt)}</TableCell>
                  <TableCell>
                    {tweet.permalink && (
                      <a href={tweet.permalink} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="size-7">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    )}
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
