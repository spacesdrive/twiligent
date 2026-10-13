import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CirclePlay, ExternalLink, Eye, ThumbsUp, MessageSquare, Tag, TrendingUp, MessagesSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageHeader from '@/components/PageHeader';
import MetricBox from '@/components/MetricBox';
import SurfaceBox from '@/components/SurfaceBox';
import SectionHeader from '@/components/SectionHeader';
import MetricAreaChart from '@/components/MetricAreaChart';
import ImageLightbox from '@/components/ImageLightbox';
import { RankNumber } from '@/components/ListRow';
import { EmptyState, PageSkeleton } from '@/components/StateViews';
import { PlatformIcon } from '@/components/platform';
import { PLATFORM_META } from '@/lib/accounts';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, fmtNumFull, fmtDate } from '../../../utils/formatters';
import { trackedViews, hasTrackedViews, isRedditItem } from '../../../utils/trackedContent';

// fmtNum abbreviates only at 1000 and above, so the full value is redundant below that
function showsFullValue(n) {
  return Math.abs(Number(n) || 0) >= 1000;
}

function NumberCell({ value }) {
  return (
    <TableCell className="text-right">
      <p className="font-semibold text-ink">{fmtNum(value ?? 0)}</p>
      {showsFullValue(value) && <p className="text-caption text-ink-faint">{fmtNumFull(value)}</p>}
    </TableCell>
  );
}

function OpenLink({ href, label }) {
  return (
    <Button variant="ghost" size="icon-xs" render={<a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} />}>
      <ExternalLink />
    </Button>
  );
}

export default function TrackedCategory() {
  const { name } = useParams();
  const { showToast } = useAppContext();
  const categoryName = decodeURIComponent(name || '');

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTrackedContent()
      .then(data => setItems((Array.isArray(data) ? data : []).filter(p => p.category === categoryName)))
      .catch(err => showToast(`Couldn't load this category. ${err.message}`, 'error'))
      .finally(() => setLoading(false));
  }, [categoryName, showToast]);

  const ytItems = useMemo(() => items.filter(p => p.contentType === 'youtube'), [items]);
  const rdItems = useMemo(() => items.filter(isRedditItem), [items]);

  const ytStats = useMemo(() => {
    const count = ytItems.length;
    const views = ytItems.reduce((s, p) => s + trackedViews(p), 0);
    const likes = ytItems.reduce((s, p) => s + (p.likeCount ?? 0), 0);
    const comments = ytItems.reduce((s, p) => s + (p.commentCount ?? 0), 0);
    return {
      count, views, likes, comments,
      avgViews: count ? Math.round(views / count) : 0,
      avgLikes: count ? Math.round(likes / count) : 0,
      avgComments: count ? Math.round(comments / count) : 0,
      likeRatio: views > 0 ? ((likes / views) * 100).toFixed(2) : '0',
    };
  }, [ytItems]);

  // Reddit post score is karma, so it is named and labelled as karma throughout
  const rdStats = useMemo(() => {
    const count = rdItems.length;
    const karma = rdItems.reduce((s, p) => s + (p.score ?? 0), 0);
    const comments = rdItems.reduce((s, p) => s + (p.numComments ?? 0), 0);
    const ratioSum = rdItems.reduce((s, p) => s + (p.upvoteRatio ?? 0), 0);
    const views = rdItems.reduce((s, p) => s + trackedViews(p), 0);
    return {
      count, karma, comments, views,
      withViews: rdItems.filter(hasTrackedViews).length,
      avgKarma: count ? Math.round(karma / count) : 0,
      avgComments: count ? Math.round(comments / count) : 0,
      avgRatio: count ? ratioSum / count : 0,
    };
  }, [rdItems]);

  const totalViews = ytStats.views + rdStats.views;

  const ytSorted = useMemo(() => [...ytItems].sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0)), [ytItems]);
  const rdSorted = useMemo(() => [...rdItems].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)), [rdItems]);
  const ytChartData = ytSorted.slice(0, 12).map(p => ({ name: (p.title || p.url || '').slice(0, 16), views: p.viewCount ?? 0 }));
  const rdChartData = rdSorted.slice(0, 12).map(p => ({ name: (p.title || p.url || '').slice(0, 16), karma: p.score ?? 0 }));

  const back = { to: '/tracked-content', label: 'Tracked content' };
  const split = (yt, rd) => [ytItems.length > 0 ? yt : null, rdItems.length > 0 ? rd : null].filter(Boolean).join(', ');

  if (loading) return <PageSkeleton metrics={4} />;

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader back={back} eyebrow="Category" title={categoryName} description="No items in this category" />
        <SurfaceBox>
          <EmptyState
            icon={<Tag />}
            title={`Nothing tracked in ${categoryName}`}
            description="Assign this category to a Reddit post or YouTube video in Tracked content and its analytics appear here."
            action={<Button size="sm" render={<Link to="/tracked-content" />}>Open tracked content</Button>}
          />
        </SurfaceBox>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={back}
        eyebrow="Category"
        title={categoryName}
        description={[
          `${items.length} item${items.length !== 1 ? 's' : ''}`,
          ytItems.length > 0 ? `${ytItems.length} YouTube` : null,
          rdItems.length > 0 ? `${rdItems.length} Reddit` : null,
        ].filter(Boolean).join(', ')}
        actions={<Button variant="outline" render={<Link to="/tracked-content" />}>Manage content</Button>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricBox icon={<Tag />} label="Items" value={items.length} subtitle={split(`${ytItems.length} YouTube video${ytItems.length !== 1 ? 's' : ''}`, `${rdItems.length} Reddit post${rdItems.length !== 1 ? 's' : ''}`)} />
        <MetricBox icon={<Eye />} label="Views" value={totalViews > 0 ? fmtNum(totalViews) : '-'} subtitle={totalViews > 0 ? split(`${fmtNum(ytStats.views)} YouTube`, `${fmtNum(rdStats.views)} Reddit`) : 'No views recorded yet'} highlight />
        <MetricBox icon={<MessagesSquare />} label="Reddit karma" value={rdItems.length > 0 ? fmtNum(rdStats.karma) : '-'} subtitle={rdItems.length > 0 ? `${fmtNum(rdStats.avgKarma)} per post on average` : 'No Reddit posts in this category'} />
        <MetricBox icon={<MessageSquare />} label="Comments" value={fmtNum(ytStats.comments + rdStats.comments)} subtitle={split(`${fmtNum(ytStats.comments)} YouTube`, `${fmtNum(rdStats.comments)} Reddit`)} />
      </div>

      {ytItems.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionHeader
            className="mt-2"
            title={<span className="flex items-center gap-2"><PlatformIcon platform="youtube" className="text-ink-muted" />YouTube videos</span>}
            actions={<span className="text-small text-ink-faint">{ytItems.length} video{ytItems.length !== 1 ? 's' : ''}</span>}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricBox small icon={<Eye />} label="Video views" value={fmtNum(ytStats.views)} subtitle={`${fmtNum(ytStats.avgViews)} per video on average`} />
            <MetricBox small icon={<ThumbsUp />} label="Video likes" value={fmtNum(ytStats.likes)} subtitle={`${fmtNum(ytStats.avgLikes)} per video on average`} />
            <MetricBox small icon={<MessageSquare />} label="Video comments" value={fmtNum(ytStats.comments)} subtitle={`${fmtNum(ytStats.avgComments)} per video on average`} />
            <MetricBox small icon={<TrendingUp />} label="Likes per view" value={`${ytStats.likeRatio}%`} subtitle="Likes as a share of views" />
          </div>
          {ytChartData.length > 1 && (
            <SurfaceBox title="Video views" subheader={`Top ${ytChartData.length} videos in this category ranked by views`}>
              <MetricAreaChart data={ytChartData} dataKey="views" label="Views" color={PLATFORM_META.youtube.series} height={260} />
            </SurfaceBox>
          )}
          <SurfaceBox content={false} className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-right">#</TableHead>
                  <TableHead>Video</TableHead>
                  <TableHead className="w-32 text-right">Views</TableHead>
                  <TableHead className="w-24 text-right">Likes</TableHead>
                  <TableHead className="w-24 text-right">Comments</TableHead>
                  <TableHead className="w-28 text-right">Fetched</TableHead>
                  <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ytSorted.map((item, i) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-right"><RankNumber rank={i + 1} className="w-auto" /></TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="flex items-start gap-3">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt="" loading="lazy" className="mt-0.5 h-10 w-16 shrink-0 rounded-sm object-cover" />
                        ) : (
                          <span className="mt-0.5 flex h-10 w-16 shrink-0 items-center justify-center rounded-sm bg-surface-sunken text-ink-faint"><CirclePlay className="size-4" /></span>
                        )}
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-medium leading-snug text-ink">{item.title || item.url}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {item.channelTitle && <span className="text-caption text-ink-faint">{item.channelTitle}</span>}
                            {item.isShort && <Badge variant="outline">Short</Badge>}
                            {item.label && <span className="text-caption text-ink-faint italic">{item.label}</span>}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <NumberCell value={item.viewCount} />
                    <TableCell className="text-right text-ink-muted">{fmtNum(item.likeCount ?? 0)}</TableCell>
                    <TableCell className="text-right text-ink-muted">{fmtNum(item.commentCount ?? 0)}</TableCell>
                    <TableCell className="text-right text-small text-ink-faint">{item.lastFetchedAt ? fmtDate(item.lastFetchedAt) : '-'}</TableCell>
                    <TableCell><OpenLink href={item.url} label={`Open "${item.title || 'video'}" on YouTube`} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SurfaceBox>
        </section>
      )}

      {rdItems.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionHeader
            className="mt-2"
            title={<span className="flex items-center gap-2"><PlatformIcon platform="reddit" className="text-ink-muted" />Reddit posts</span>}
            actions={<span className="text-small text-ink-faint">{rdItems.length} post{rdItems.length !== 1 ? 's' : ''}</span>}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricBox small icon={<MessagesSquare />} label="Post karma" value={fmtNum(rdStats.karma)} subtitle={`${fmtNum(rdStats.avgKarma)} per post on average`} />
            <MetricBox small icon={<Eye />} label="Post views" value={rdStats.withViews > 0 ? fmtNum(rdStats.views) : '-'} subtitle={rdStats.withViews > 0 ? `Across ${rdItems.length} post${rdItems.length !== 1 ? 's' : ''}` : 'Reddit does not report views. Add them per post.'} />
            <MetricBox small icon={<MessageSquare />} label="Post comments" value={fmtNum(rdStats.comments)} subtitle={`${fmtNum(rdStats.avgComments)} per post on average`} />
            <MetricBox small icon={<TrendingUp />} label="Average upvote ratio" value={rdStats.avgRatio > 0 ? `${Math.round(rdStats.avgRatio * 100)}%` : '-'} subtitle="Upvotes as a share of all votes" />
          </div>
          {rdChartData.length > 1 && (
            <SurfaceBox title="Post karma" subheader={`Top ${rdChartData.length} posts in this category ranked by karma`}>
              <MetricAreaChart data={rdChartData} dataKey="karma" label="Karma" color={PLATFORM_META.reddit.series} height={260} />
            </SurfaceBox>
          )}
          <SurfaceBox content={false} className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-right">#</TableHead>
                  <TableHead>Post</TableHead>
                  <TableHead className="w-28 text-right">Karma</TableHead>
                  <TableHead className="w-24 text-right">Views</TableHead>
                  <TableHead className="w-20 text-right">Upvoted</TableHead>
                  <TableHead className="w-24 text-right">Comments</TableHead>
                  <TableHead className="w-28 text-right">Fetched</TableHead>
                  <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rdSorted.map((item, i) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-right"><RankNumber rank={i + 1} className="w-auto" /></TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="flex items-start gap-3">
                        {item.imageUrl && <ImageLightbox src={item.imageUrl} alt={item.title || 'Reddit post'} className="mt-0.5" />}
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-medium leading-snug text-ink">{item.title || item.url}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {item.subredditPrefixed && <span className="text-caption text-ink-faint">{item.subredditPrefixed}</span>}
                            {item.label && <span className="text-caption text-ink-faint italic">{item.label}</span>}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <NumberCell value={item.score} />
                    <TableCell className="text-right text-ink-muted">{hasTrackedViews(item) ? fmtNum(trackedViews(item)) : '-'}</TableCell>
                    <TableCell className="text-right text-ink-muted">{item.upvoteRatio != null && (item.score ?? 0) >= 10 ? `${Math.round(item.upvoteRatio * 100)}%` : '-'}</TableCell>
                    <TableCell className="text-right text-ink-muted">{fmtNum(item.numComments ?? 0)}</TableCell>
                    <TableCell className="text-right text-small text-ink-faint">{item.lastFetchedAt ? fmtDate(item.lastFetchedAt) : '-'}</TableCell>
                    <TableCell><OpenLink href={item.permalink || item.url} label={`Open "${item.title || 'post'}" on Reddit`} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SurfaceBox>
        </section>
      )}
    </div>
  );
}
