import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SurfaceBox from '@/components/SurfaceBox';
import ColumnHint from '@/components/ColumnHint';
import Num from '@/components/Num';
import { fmtCount, fmtDate, fmtDuration, fmtPercent } from '../../../utils/formatters';
import { isStrongEngagement, STRONG_ENGAGEMENT_HINT } from '@/lib/library';
import type { YouTubeVideoSummary } from '@shared/types/youtube.ts';
import { watchUrl } from './channelChartData.ts';

interface VideoRowProps {
  video: YouTubeVideoSummary;
  rank: number;
}

export interface ChannelVideoTableProps {
  title: string;
  videos: YouTubeVideoSummary[] | null | undefined;
}

function VideoRow({ video, rank }: VideoRowProps) {
  const strong = isStrongEngagement(video.engagementRate);
  return (
    <TableRow>
      <TableCell className="text-right font-mono text-caption text-ink-faint">{rank}</TableCell>
      <TableCell className="sticky left-0 z-[1] max-w-56 bg-surface-raised sm:max-w-72">
        <a href={watchUrl(video.videoId)} target="_blank" rel="noopener noreferrer" title={video.title} className="block truncate text-sm font-medium text-ink underline-offset-4 hover:underline">
          {video.title}<span className="sr-only"> (opens on YouTube in a new tab)</span>
        </a>
      </TableCell>
      <TableCell className="text-right font-semibold text-ink"><Num value={video.viewCount} /></TableCell>
      <TableCell className="hidden text-right text-ink-muted sm:table-cell">{fmtCount(video.likeCount)}</TableCell>
      <TableCell className="hidden text-right text-ink-muted md:table-cell">{fmtCount(video.commentCount)}</TableCell>
      <TableCell className="text-right">
        <Badge variant={strong ? 'success' : 'secondary'}>
          {fmtPercent(video.engagementRate)}
          {strong && <span className="sr-only"> (strong)</span>}
        </Badge>
      </TableCell>
      <TableCell className="hidden text-right text-ink-muted lg:table-cell">{fmtDuration(video.durationSeconds)}</TableCell>
      <TableCell className="hidden text-right text-small text-ink-faint md:table-cell">{fmtDate(video.publishedAt)}</TableCell>
      <TableCell>
        <Button variant="ghost" size="icon-xs" render={<a href={watchUrl(video.videoId)} target="_blank" rel="noopener noreferrer" aria-label={`Watch ${video.title} on YouTube (opens in a new tab)`} />}>
          <Play aria-hidden="true" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// the scroll box is the table's own container, so the header row can stick while the list scrolls
export default function ChannelVideoTable({ title, videos }: ChannelVideoTableProps) {
  const rows = (videos || []).filter(Boolean);
  return (
    <SurfaceBox title={title} content={false} className="overflow-hidden">
      <Table containerClassName="max-h-[30rem] overflow-y-auto">
        <TableHeader className="sticky top-0 z-[2] bg-surface-raised">
          <TableRow>
            <TableHead className="w-10 text-right">#</TableHead>
            <TableHead className="sticky left-0 z-[1] bg-surface-raised">Video</TableHead>
            <TableHead className="text-right">Views</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Likes</TableHead>
            <TableHead className="hidden text-right md:table-cell">Comments</TableHead>
            <TableHead className="text-right"><ColumnHint label="Engagement rate (%)" hint={STRONG_ENGAGEMENT_HINT} /></TableHead>
            <TableHead className="hidden text-right lg:table-cell">Length</TableHead>
            <TableHead className="hidden text-right md:table-cell">Published</TableHead>
            <TableHead className="w-10"><span className="sr-only">Watch</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((video, i) => <VideoRow key={video.videoId} video={video} rank={i + 1} />)}
        </TableBody>
      </Table>
    </SurfaceBox>
  );
}
