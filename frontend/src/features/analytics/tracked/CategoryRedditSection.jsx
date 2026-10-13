import { useMemo } from 'react';
import { Eye, MessageSquare, MessagesSquare, TrendingUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import MetricBox from '@/components/MetricBox';
import SurfaceBox from '@/components/SurfaceBox';
import SectionHeader from '@/components/SectionHeader';
import MetricAreaChart from '@/components/MetricAreaChart';
import ImageLightbox from '@/components/ImageLightbox';
import ColumnHint from '@/components/ColumnHint';
import { RankNumber } from '@/components/ListRow';
import { PlatformIcon } from '@/components/platform';
import { PLATFORM_META } from '@/lib/accounts';
import { fmtDate, fmtNum } from '../../../utils/formatters';
import { hasTrackedViews, trackedViews } from '../../../utils/trackedContent';
import NumberCell from './NumberCell';
import OpenLink from './OpenLink';
import { chartDataOf, redditViewsMetric, sortedByKarma, upvoteRatioLabel } from './trackedCategoryStats.js';

function PostRow({ item, rank }) {
  return (
    <TableRow>
      <TableCell className="text-right"><RankNumber rank={rank} className="w-auto" /></TableCell>
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
  );
}

export default function CategoryRedditSection({ items, stats }) {
  const sorted = useMemo(() => sortedByKarma(items), [items]);
  const chartData = chartDataOf(sorted, 'karma', item => item.score ?? 0);
  const views = redditViewsMetric(stats);
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        className="mt-2"
        title={<span className="flex items-center gap-2"><PlatformIcon platform="reddit" className="text-ink-muted" />Reddit posts</span>}
        actions={<span className="text-small text-ink-faint">{items.length} post{items.length !== 1 ? 's' : ''}</span>}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricBox small icon={<MessagesSquare />} label="Post karma" value={fmtNum(stats.karma)} subtitle={`${fmtNum(stats.avgKarma)} per post on average`} />
        <MetricBox small icon={<Eye />} label="Post views" value={views.value} subtitle={views.subtitle} />
        <MetricBox small icon={<MessageSquare />} label="Post comments" value={fmtNum(stats.comments)} subtitle={`${fmtNum(stats.avgComments)} per post on average`} />
        <MetricBox small icon={<TrendingUp />} label="Average upvote ratio" value={upvoteRatioLabel(stats.avgRatio)} subtitle="Upvotes as a share of all votes" />
      </div>
      {chartData.length > 1 && (
        <SurfaceBox title="Post karma" subheader={`Top ${chartData.length} posts in this category ranked by karma`}>
          <MetricAreaChart data={chartData} dataKey="karma" label="Karma" color={PLATFORM_META.reddit.series} height={260} />
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
              <TableHead className="w-32 text-right"><ColumnHint label="Upvote rate" hint="Share of votes on a Reddit post that are upvotes. Shows a dash for YouTube videos and for posts under 10 karma, where the ratio is not meaningful." /></TableHead>
              <TableHead className="w-24 text-right">Comments</TableHead>
              <TableHead className="w-28 text-right">Fetched</TableHead>
              <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((item, i) => <PostRow key={item.id} item={item} rank={i + 1} />)}
          </TableBody>
        </Table>
      </SurfaceBox>
    </section>
  );
}
