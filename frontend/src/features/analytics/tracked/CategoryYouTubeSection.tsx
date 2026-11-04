import { useMemo } from 'react';
import { CirclePlay } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SurfaceBox from '@/components/SurfaceBox';
import MetricAreaChart from '@/components/MetricAreaChart';
import RelativeTime from '@/components/RelativeTime';
import Num from '@/components/Num';
import { RankNumber } from '@/components/ListRow';
import { PLATFORM_META } from '@/lib/accounts';
import { pointsOf, rankingSummary } from '@/lib/chart';
import { fmtNumFull } from '../../../utils/formatters';
import NumberCell from './NumberCell';
import OpenLink from './OpenLink';
import { chartDataOf, sortedByViews } from './trackedCategoryStats.ts';
import type { TrackedContentItem } from '@shared/types/domain.ts';

interface VideoRowProps {
  item: TrackedContentItem;
  rank: number;
}

function VideoRow({ item, rank }: VideoRowProps) {
  return (
    <TableRow>
      <TableCell className="text-right"><RankNumber rank={rank} className="w-auto" /></TableCell>
      <TableCell className="whitespace-normal">
        <div className="flex items-start gap-3">
          {item.thumbnail ? (
            <img src={item.thumbnail} alt="" loading="lazy" className="mt-0.5 h-10 w-16 shrink-0 rounded-sm object-cover" />
          ) : (
            <span className="mt-0.5 flex h-10 w-16 shrink-0 items-center justify-center rounded-sm bg-surface-sunken text-ink-faint"><CirclePlay className="size-4" aria-hidden="true" /></span>
          )}
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-medium leading-snug text-ink" title={item.title || item.url}>{item.title || item.url}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {item.channelTitle && <span className="text-caption text-ink-faint">{item.channelTitle}</span>}
              {item.isShort && <Badge variant="outline">Short</Badge>}
              {item.label && <span className="text-caption text-ink-faint italic">{item.label}</span>}
            </div>
          </div>
        </div>
      </TableCell>
      <NumberCell value={item.viewCount} />
      <TableCell className="hidden text-right text-ink-muted sm:table-cell"><Num value={item.likeCount ?? 0} /></TableCell>
      <TableCell className="hidden text-right text-ink-muted sm:table-cell"><Num value={item.commentCount ?? 0} /></TableCell>
      <TableCell className="hidden text-right text-small text-ink-faint md:table-cell">{item.lastFetchedAt ? <RelativeTime date={item.lastFetchedAt} /> : '-'}</TableCell>
      <TableCell><OpenLink href={item.url} label={`Open "${item.title || 'video'}" on YouTube`} /></TableCell>
    </TableRow>
  );
}

export interface CategoryYouTubeSectionProps {
  items: TrackedContentItem[];
}

export default function CategoryYouTubeSection({ items }: CategoryYouTubeSectionProps) {
  const sorted = useMemo(() => sortedByViews(items), [items]);
  const chartData = chartDataOf(sorted, 'views', item => item.viewCount ?? 0);
  return (
    <section className="flex flex-col gap-4">
      {chartData.length > 1 && (
        <SurfaceBox title="Video views" subheader={`Top ${chartData.length} videos in this category ranked by views`}>
          <MetricAreaChart
            data={chartData}
            dataKey="views"
            label="Views"
            title="Video views"
            description={rankingSummary(pointsOf(chartData, 'name', 'views'), fmtNumFull, 'views')}
            color={PLATFORM_META.youtube.series}
            height={260}
          />
        </SurfaceBox>
      )}
      <SurfaceBox title="All videos in this category" content={false} className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-right">#</TableHead>
              <TableHead>Video</TableHead>
              <TableHead className="w-32 text-right">Views</TableHead>
              <TableHead className="hidden w-24 text-right sm:table-cell">Likes</TableHead>
              <TableHead className="hidden w-24 text-right sm:table-cell">Comments</TableHead>
              <TableHead className="hidden w-28 text-right md:table-cell">Fetched</TableHead>
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
