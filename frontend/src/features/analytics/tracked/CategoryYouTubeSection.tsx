import { useMemo } from 'react';
import { CirclePlay, Eye, MessageSquare, ThumbsUp, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import MetricBox from '@/components/MetricBox';
import SurfaceBox from '@/components/SurfaceBox';
import SectionHeader from '@/components/SectionHeader';
import MetricAreaChart from '@/components/MetricAreaChart';
import { RankNumber } from '@/components/ListRow';
import { PlatformIcon } from '@/components/platform';
import { PLATFORM_META } from '@/lib/accounts';
import { fmtDate, fmtNum } from '../../../utils/formatters';
import NumberCell from './NumberCell';
import OpenLink from './OpenLink';
import { chartDataOf, sortedByViews } from './trackedCategoryStats.ts';

function VideoRow({ item, rank }) {
  return (
    <TableRow>
      <TableCell className="text-right"><RankNumber rank={rank} className="w-auto" /></TableCell>
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
  );
}

export default function CategoryYouTubeSection({ items, stats }) {
  const sorted = useMemo(() => sortedByViews(items), [items]);
  const chartData = chartDataOf(sorted, 'views', item => item.viewCount ?? 0);
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        className="mt-2"
        title={<span className="flex items-center gap-2"><PlatformIcon platform="youtube" className="text-ink-muted" />YouTube videos</span>}
        actions={<span className="text-small text-ink-faint">{items.length} video{items.length !== 1 ? 's' : ''}</span>}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricBox small icon={<Eye />} label="Video views" value={fmtNum(stats.views)} subtitle={`${fmtNum(stats.avgViews)} per video on average`} />
        <MetricBox small icon={<ThumbsUp />} label="Video likes" value={fmtNum(stats.likes)} subtitle={`${fmtNum(stats.avgLikes)} per video on average`} />
        <MetricBox small icon={<MessageSquare />} label="Video comments" value={fmtNum(stats.comments)} subtitle={`${fmtNum(stats.avgComments)} per video on average`} />
        <MetricBox small icon={<TrendingUp />} label="Likes per view" value={`${stats.likeRatio}%`} subtitle="Likes as a share of views" />
      </div>
      {chartData.length > 1 && (
        <SurfaceBox title="Video views" subheader={`Top ${chartData.length} videos in this category ranked by views`}>
          <MetricAreaChart data={chartData} dataKey="views" label="Views" color={PLATFORM_META.youtube.series} height={260} />
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
            {sorted.map((item, i) => <VideoRow key={item.id} item={item} rank={i + 1} />)}
          </TableBody>
        </Table>
      </SurfaceBox>
    </section>
  );
}
