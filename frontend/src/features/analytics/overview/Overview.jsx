import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import StatCard from '../../../components/ui/StatCard';
import MainCard from '../../../components/MainCard';
import { useAppContext } from '../../../context/AppContext';
import { fmtNum, fmtNumFull, timeAgo } from '../../../utils/formatters';
import { RefreshCw, Users, Eye, VideoIcon, BarChart3, ExternalLink, Tv, Camera } from 'lucide-react';

const CHART_COLORS = ['hsl(221.2,83.2%,53.3%)', '#22c55e', '#f97316', '#a855f7', '#06b6d4', '#ec4899', '#6366f1', '#eab308'];

export default function Overview() {
  const { accounts, loading, refreshAll } = useAppContext();
  const navigate = useNavigate();

  const ytAccounts = accounts.filter(a => a.platform !== 'instagram');
  const igAccounts = accounts.filter(a => a.platform === 'instagram');

  const totals = accounts.reduce((acc, a) => {
    if (a.platform === 'instagram') {
      return { ...acc, followers: acc.followers + (a.followersCount || 0), posts: acc.posts + (a.mediaCount || 0) };
    }
    return {
      ...acc,
      subscribers: acc.subscribers + (a.subscriberCount || 0),
      views: acc.views + (a.viewCount || 0),
      videos: acc.videos + (a.videoCount || 0),
    };
  }, { subscribers: 0, views: 0, videos: 0, followers: 0, posts: 0 });

  const totalAudience = totals.subscribers + totals.followers;

  const sorted = {
    byAudience: [...accounts].sort((a, b) =>
      (b.subscriberCount || b.followersCount || 0) - (a.subscriberCount || a.followersCount || 0)),
    byContent: [...accounts].sort((a, b) =>
      (b.viewCount || b.mediaCount || 0) - (a.viewCount || a.mediaCount || 0)),
  };

  const chartData = accounts.map(a => ({
    name: (a.title || '').slice(0, 14) + ((a.title || '').length > 14 ? '…' : ''),
    audience: a.subscriberCount || a.followersCount || 0,
  }));

  const pieData = accounts.map((a, i) => ({
    name: (a.title || '').slice(0, 14) + ((a.title || '').length > 14 ? '…' : ''),
    value: a.subscriberCount || a.followersCount || 0,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const handleViewChannel = (acc) => {
    if (acc.platform === 'instagram') navigate(`/instagram/${acc.id}`);
    else navigate(`/channel/${acc.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {accounts.length === 0
              ? 'Add your first account to start tracking'
              : `Tracking ${accounts.length} account${accounts.length !== 1 ? 's' : ''} · ${ytAccounts.length} YouTube · ${igAccounts.length} Instagram`}
          </p>
        </div>
        <Button
          onClick={refreshAll}
          disabled={loading || accounts.length === 0}
          size="sm"
          className="gap-2 shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing…' : 'Refresh All'}
        </Button>
      </div>

      {/* Loading bar */}
      {loading && <Progress className="h-1" value={undefined} />}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { icon: <Users />, label: 'Total Audience', value: fmtNum(totalAudience), subtitle: `${fmtNum(totals.subscribers)} subs · ${fmtNum(totals.followers)} followers`, gradient: 'purple' },
          { icon: <Eye />,   label: 'Total Views',    value: fmtNum(totals.views),  subtitle: fmtNumFull(totals.views), gradient: 'red' },
          { icon: <VideoIcon />, label: 'Total Content', value: fmtNum(totals.videos + totals.posts), subtitle: `${fmtNum(totals.videos)} videos · ${fmtNum(totals.posts)} posts`, gradient: 'blue' },
          { icon: <BarChart3 />, label: 'Accounts',   value: accounts.length,       subtitle: `${ytAccounts.length} YouTube · ${igAccounts.length} Instagram`, gradient: 'orange' },
        ].map((card, i) => (
          <StatCard key={i} {...card} loading={loading} />
        ))}
      </div>

      {accounts.length === 0 ? (
        <MainCard>
          <div className="flex flex-col items-center text-center py-12 gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Welcome to Twiligent</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Add your first YouTube channel or Instagram account to start tracking analytics
              </p>
            </div>
            <Button onClick={() => navigate('/accounts')}>Add Account</Button>
          </div>
        </MainCard>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <MainCard title="Audience Comparison" className="xl:col-span-2">
              <ResponsiveContainer width="100%" height={260} debounce={200}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="audGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(221.2,83.2%,53.3%)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(221.2,83.2%,53.3%)" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={fmtNum} axisLine={false} tickLine={false} width={48} />
                  <ReTooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [fmtNumFull(v), 'Audience']}
                  />
                  <Area type="monotone" dataKey="audience" stroke="hsl(221.2,83.2%,53.3%)" strokeWidth={2} fill="url(#audGrad)" dot={{ fill: 'hsl(221.2,83.2%,53.3%)', r: 4, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </MainCard>

            <MainCard title="Audience Share">
              <ResponsiveContainer width="100%" height={260} debounce={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="44%" outerRadius={85} innerRadius={48} paddingAngle={3} strokeWidth={0}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <ReTooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtNumFull(v)} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </MainCard>
          </div>

          {/* Leaderboards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                title: 'Top by Audience',
                list: sorted.byAudience,
                metric: a => fmtNum(a.platform === 'instagram' ? a.followersCount : a.subscriberCount),
                isIG: a => a.platform === 'instagram',
              },
              {
                title: 'Top by Content',
                list: sorted.byContent,
                metric: a => a.platform === 'instagram' ? `${fmtNum(a.mediaCount)} posts` : `${fmtNum(a.viewCount)} views`,
                isIG: a => a.platform === 'instagram',
              },
            ].map(({ title, list, metric, isIG }) => (
              <MainCard key={title} title={title}>
                <div className="space-y-1">
                  {list.map((a, i) => {
                    const ig = isIG(a);
                    const medalColor = i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-400' : 'text-muted-foreground';
                    return (
                      <button
                        key={a.id}
                        onClick={() => handleViewChannel(a)}
                        className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-muted/60 transition-colors text-left"
                      >
                        <span className={`w-5 text-xs font-bold tabular-nums ${medalColor}`}>{i + 1}</span>
                        <Avatar className="h-7 w-7 flex-shrink-0">
                          <AvatarImage src={a.thumbnail || a.profilePictureUrl || a.thumbnails?.default} />
                          <AvatarFallback className={`text-[0.55rem] font-bold text-white ${ig ? 'bg-pink-500' : 'bg-red-500'}`}>
                            {(a.title || '?').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm font-medium truncate">{a.title}</span>
                        <Badge variant="outline" className={`text-xs font-semibold ${ig ? 'border-pink-200 bg-pink-50 text-pink-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
                          {metric(a)}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </MainCard>
            ))}
          </div>

          {/* All accounts table */}
          <MainCard title="All Accounts" content={false}>
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
                {sorted.byAudience.map((a, i) => {
                  const ig = a.platform === 'instagram';
                  const medalColor = i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-400' : 'text-muted-foreground';
                  return (
                    <TableRow key={a.id} className="cursor-pointer" onClick={() => handleViewChannel(a)}>
                      <TableCell>
                        <span className={`text-xs font-bold ${medalColor}`}>{i + 1}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={a.thumbnail || a.profilePictureUrl || a.thumbnails?.default} />
                            <AvatarFallback className={`text-xs font-bold text-white ${ig ? 'bg-pink-500' : 'bg-red-500'}`}>
                              {(a.title || '?').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-semibold leading-none">{a.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {ig ? `@${a.username || ''}` : (a.customUrl || a.channelId || '')}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-xs ${ig ? 'border-pink-200 bg-pink-50 text-pink-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                          {ig ? 'Instagram' : 'YouTube'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="text-sm font-semibold">{fmtNum(ig ? a.followersCount : a.subscriberCount)}</p>
                        <p className="text-xs text-muted-foreground">{ig ? 'followers' : 'subscribers'}</p>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {ig ? `${fmtNum(a.mediaCount)} posts` : `${fmtNum(a.viewCount)} views · ${fmtNum(a.videoCount)} vids`}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {timeAgo(a.lastUpdated)}
                      </TableCell>
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
        </>
      )}
    </div>
  );
}
