import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import StatCard from '../../../components/ui/StatCard';
import MainCard from '../../../components/MainCard';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, fmtNumFull, fmtDate } from '../../../utils/formatters';
import {
  ArrowLeft, CirclePlay, Flame, ExternalLink, Eye,
  ThumbsUp, MessageSquare, Tag, TrendingUp, BarChart2,
} from 'lucide-react';

function ContentTypeBadge({ type }) {
  if (type === 'youtube') {
    return (
      <Badge variant="outline" className="text-[10px] border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400 gap-1 px-1.5 py-0">
        <CirclePlay className="h-2.5 w-2.5" />
        YouTube
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-400 gap-1 px-1.5 py-0">
      <Flame className="h-2.5 w-2.5" />
      Reddit
    </Badge>
  );
}

export default function TrackedCategory() {
  const { name } = useParams();
  const navigate = useNavigate();
  const { showToast } = useAppContext();

  const categoryName = decodeURIComponent(name || '');

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTrackedContent()
      .then(data => {
        const all = Array.isArray(data) ? data : [];
        setItems(all.filter(p => p.category === categoryName));
      })
      .catch(err => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [categoryName, showToast]);

  const ytItems = useMemo(() => items.filter(p => p.contentType === 'youtube'), [items]);
  const rdItems = useMemo(() => items.filter(p => (p.contentType || 'reddit') === 'reddit'), [items]);

  const ytStats = useMemo(() => {
    const count    = ytItems.length;
    const views    = ytItems.reduce((s, p) => s + (p.viewCount    ?? 0), 0);
    const likes    = ytItems.reduce((s, p) => s + (p.likeCount    ?? 0), 0);
    const comments = ytItems.reduce((s, p) => s + (p.commentCount ?? 0), 0);
    return {
      count,
      views,
      likes,
      comments,
      avgViews: count ? Math.round(views / count)    : 0,
      avgLikes: count ? Math.round(likes / count)    : 0,
      likeRatio: views > 0 ? ((likes / views) * 100).toFixed(2) : '0',
    };
  }, [ytItems]);

  const rdStats = useMemo(() => {
    const count    = rdItems.length;
    const score    = rdItems.reduce((s, p) => s + (p.score       ?? 0), 0);
    const comments = rdItems.reduce((s, p) => s + (p.numComments ?? 0), 0);
    const ratioSum = rdItems.reduce((s, p) => s + (p.upvoteRatio ?? 0), 0);
    return {
      count,
      score,
      comments,
      avgScore:  count ? Math.round(score / count)    : 0,
      avgRatio:  count ? ratioSum / count              : 0,
    };
  }, [rdItems]);

  const ytChartData = useMemo(() =>
    [...ytItems]
      .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
      .slice(0, 10)
      .map(p => ({
        name:  (p.title || p.url || '').slice(0, 30),
        views: p.viewCount ?? 0,
      })),
    [ytItems]
  );

  const rdChartData = useMemo(() =>
    [...rdItems]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 10)
      .map(p => ({
        name:  (p.title || p.url || '').slice(0, 30),
        score: p.score ?? 0,
      })),
    [rdItems]
  );

  const medalColor = (i) =>
    i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-400' : 'text-muted-foreground';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="space-y-1">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate('/tracked-content')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{categoryName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">No items in this category</p>
          </div>
        </div>
        <MainCard>
          <div className="flex flex-col items-center text-center py-12 gap-3">
            <div className="h-14 w-14 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Tag className="h-7 w-7 text-purple-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">No tracked items in "{categoryName}"</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add content and assign this category in Tracked Content to see analytics here
              </p>
            </div>
            <Button size="sm" onClick={() => navigate('/tracked-content')}>Manage Tracked Content</Button>
          </div>
        </MainCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={() => navigate('/tracked-content')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{categoryName}</h1>
            <Badge variant="outline" className="text-xs border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-400">
              <Tag className="h-3 w-3 mr-1" />
              Category
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {items.length} item{items.length !== 1 ? 's' : ''}
            {ytItems.length > 0 && ` · ${ytItems.length} YouTube`}
            {rdItems.length > 0 && ` · ${rdItems.length} Reddit`}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate('/tracked-content')} className="shrink-0">
          Manage Content
        </Button>
      </div>

      {/* Summary StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Tag />}
          label="Total Items"
          value={items.length}
          subtitle={[
            ytItems.length > 0 ? `${ytItems.length} YouTube` : null,
            rdItems.length > 0 ? `${rdItems.length} Reddit`  : null,
          ].filter(Boolean).join(' · ')}
          gradient="purple"
        />
        <StatCard
          icon={<Eye />}
          label="Total Views"
          value={ytItems.length > 0 ? fmtNum(ytStats.views) : '-'}
          subtitle={ytItems.length > 0 ? `avg ${fmtNum(ytStats.avgViews)} per video` : 'no YouTube videos'}
          gradient="red"
        />
        <StatCard
          icon={<Flame />}
          label="Total Score"
          value={rdItems.length > 0 ? fmtNum(rdStats.score) : '-'}
          subtitle={rdItems.length > 0 ? `avg ${fmtNum(rdStats.avgScore)} per post` : 'no Reddit posts'}
          gradient="orange"
        />
        <StatCard
          icon={<MessageSquare />}
          label="Total Comments"
          value={fmtNum(ytStats.comments + rdStats.comments)}
          subtitle={[
            ytItems.length > 0 ? 'YouTube' : null,
            rdItems.length > 0 ? 'Reddit'  : null,
          ].filter(Boolean).join(' + ') + ' combined'}
          gradient="blue"
        />
      </div>

      {/* YouTube section */}
      {ytItems.length > 0 && (
        <>
          <div className="flex items-center gap-3 pt-2">
            <CirclePlay className="h-5 w-5 text-red-500 shrink-0" />
            <h2 className="text-base font-semibold">YouTube Videos</h2>
            <Separator className="flex-1" />
            <span className="text-sm text-muted-foreground shrink-0">
              {ytItems.length} video{ytItems.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<Eye />}
              label="Total Views"
              value={fmtNum(ytStats.views)}
              subtitle={`avg ${fmtNum(ytStats.avgViews)} per video`}
              gradient="red"
            />
            <StatCard
              icon={<ThumbsUp />}
              label="Total Likes"
              value={fmtNum(ytStats.likes)}
              subtitle={`avg ${fmtNum(ytStats.avgLikes)} per video`}
              gradient="orange"
            />
            <StatCard
              icon={<MessageSquare />}
              label="Total Comments"
              value={fmtNum(ytStats.comments)}
              subtitle="across all videos"
              gradient="blue"
            />
            <StatCard
              icon={<TrendingUp />}
              label="Like-to-View Ratio"
              value={ytStats.likeRatio + '%'}
              subtitle="likes as share of views"
              gradient="purple"
            />
          </div>

          {ytChartData.length > 1 && (
            <MainCard title="Top Videos by Views">
              <ResponsiveContainer
                width="100%"
                height={Math.max(ytChartData.length * 44, 200)}
                debounce={200}
              >
                <BarChart
                  data={ytChartData}
                  layout="vertical"
                  margin={{ top: 0, right: 56, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                    tickFormatter={fmtNum}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={196}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ReTooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [fmtNumFull(v), 'Views']}
                  />
                  <Bar dataKey="views" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {ytChartData.map((_, i) => (
                      <Cell key={i} fill="#ef4444" fillOpacity={Math.max(1 - i * 0.07, 0.4)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </MainCard>
          )}

          <MainCard content={false}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Video</TableHead>
                  <TableHead className="text-right w-32">Views</TableHead>
                  <TableHead className="text-right w-24">Likes</TableHead>
                  <TableHead className="text-right w-24">Comments</TableHead>
                  <TableHead className="text-right w-28">Fetched</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...ytItems]
                  .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
                  .map((item, i) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className={`text-xs font-bold tabular-nums ${medalColor(i)}`}>{i + 1}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-2.5">
                          {item.thumbnail ? (
                            <img
                              src={item.thumbnail}
                              alt=""
                              className="h-10 w-16 rounded object-cover flex-shrink-0 mt-0.5"
                            />
                          ) : (
                            <div className="h-10 w-16 rounded bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <CirclePlay className="h-4 w-4 text-red-500" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-snug line-clamp-2">
                              {item.title || item.url}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {item.channelTitle && (
                                <span className="text-xs text-muted-foreground">{item.channelTitle}</span>
                              )}
                              {item.isShort && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Short</Badge>
                              )}
                              {item.label && (
                                <span className="text-xs text-muted-foreground italic">{item.label}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="text-sm font-bold tabular-nums">{fmtNum(item.viewCount ?? 0)}</p>
                        <p className="text-xs text-muted-foreground">{fmtNumFull(item.viewCount ?? 0)}</p>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums text-red-500">
                        {fmtNum(item.likeCount ?? 0)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {fmtNum(item.commentCount ?? 0)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {item.lastFetchedAt ? fmtDate(item.lastFetchedAt) : '-'}
                      </TableCell>
                      <TableCell>
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
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
        </>
      )}

      {/* Reddit section */}
      {rdItems.length > 0 && (
        <>
          <div className="flex items-center gap-3 pt-2">
            <Flame className="h-5 w-5 text-orange-500 shrink-0" />
            <h2 className="text-base font-semibold">Reddit Posts</h2>
            <Separator className="flex-1" />
            <span className="text-sm text-muted-foreground shrink-0">
              {rdItems.length} post{rdItems.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<Flame />}
              label="Total Score"
              value={fmtNum(rdStats.score)}
              subtitle={`avg ${fmtNum(rdStats.avgScore)} per post`}
              gradient="orange"
            />
            <StatCard
              icon={<MessageSquare />}
              label="Total Comments"
              value={fmtNum(rdStats.comments)}
              subtitle="across all posts"
              gradient="blue"
            />
            <StatCard
              icon={<TrendingUp />}
              label="Avg Upvote Ratio"
              value={rdStats.avgRatio > 0 ? Math.round(rdStats.avgRatio * 100) + '%' : '-'}
              subtitle="upvotes as share of total votes"
              gradient="green"
            />
            <StatCard
              icon={<BarChart2 />}
              label="Avg Score"
              value={fmtNum(rdStats.avgScore)}
              subtitle={`${rdItems.length} post${rdItems.length !== 1 ? 's' : ''} tracked`}
              gradient="purple"
            />
          </div>

          {rdChartData.length > 1 && (
            <MainCard title="Top Posts by Score">
              <ResponsiveContainer
                width="100%"
                height={Math.max(rdChartData.length * 44, 200)}
                debounce={200}
              >
                <BarChart
                  data={rdChartData}
                  layout="vertical"
                  margin={{ top: 0, right: 56, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                    tickFormatter={fmtNum}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={196}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ReTooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [fmtNumFull(v), 'Score']}
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {rdChartData.map((_, i) => (
                      <Cell key={i} fill="#f97316" fillOpacity={Math.max(1 - i * 0.07, 0.4)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </MainCard>
          )}

          <MainCard content={false}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Post</TableHead>
                  <TableHead className="text-right w-28">Score</TableHead>
                  <TableHead className="text-right w-20">Upvote %</TableHead>
                  <TableHead className="text-right w-24">Comments</TableHead>
                  <TableHead className="text-right w-28">Fetched</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...rdItems]
                  .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                  .map((item, i) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className={`text-xs font-bold tabular-nums ${medalColor(i)}`}>{i + 1}</span>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-snug line-clamp-2">
                            {item.title || item.url}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {item.subredditPrefixed && (
                              <span className="text-xs text-muted-foreground">{item.subredditPrefixed}</span>
                            )}
                            {item.label && (
                              <span className="text-xs text-muted-foreground italic">{item.label}</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="text-sm font-bold tabular-nums text-orange-500">
                          {fmtNum(item.score ?? 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">{fmtNumFull(item.score ?? 0)}</p>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {(item.upvoteRatio != null && (item.score ?? 0) >= 10)
                          ? Math.round(item.upvoteRatio * 100) + '%'
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {fmtNum(item.numComments ?? 0)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {item.lastFetchedAt ? fmtDate(item.lastFetchedAt) : '-'}
                      </TableCell>
                      <TableCell>
                        <a href={item.permalink || item.url} target="_blank" rel="noopener noreferrer">
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
        </>
      )}
    </div>
  );
}
