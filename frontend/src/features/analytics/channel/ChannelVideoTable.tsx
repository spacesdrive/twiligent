import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SurfaceBox from '@/components/SurfaceBox';
import { fmtCount, fmtDate, fmtDuration, fmtNum, fmtPercent } from '../../../utils/formatters';
import type { YouTubeVideoSummary } from '@shared/types/youtube.ts';
import { watchUrl } from './channelChartData.ts';

interface VideoRowProps {
  video: YouTubeVideoSummary;
  rank: number;
}

export interface ChannelVideoTableProps {
  videos: YouTubeVideoSummary[] | null | undefined;
}

function VideoRow({ video, rank }: VideoRowProps) {
  return (
    <TableRow>
      <TableCell className="text-right font-mono text-caption text-ink-faint">{rank}</TableCell>
      <TableCell className="max-w-[280px]">
        <a href={watchUrl(video.videoId)} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-ink hover:underline">{video.title}</a>
      </TableCell>
      <TableCell className="text-right font-semibold text-ink">{fmtNum(video.viewCount)}</TableCell>
      <TableCell className="text-right text-ink-muted">{fmtCount(video.likeCount)}</TableCell>
      <TableCell className="text-right text-ink-muted">{fmtCount(video.commentCount)}</TableCell>
      <TableCell className="text-right">
        <Badge variant={parseFloat(video.engagementRate as string) > 5 ? 'success' : 'secondary'}>{fmtPercent(video.engagementRate)}</Badge>
      </TableCell>
      <TableCell className="text-right text-ink-muted">{fmtDuration(video.durationSeconds)}</TableCell>
      <TableCell className="text-right text-small text-ink-faint">{fmtDate(video.publishedAt)}</TableCell>
      <TableCell>
        <Button variant="ghost" size="icon-xs" render={<a href={watchUrl(video.videoId)} target="_blank" rel="noopener noreferrer" aria-label={`Watch ${video.title} on YouTube`} />}>
          <Play />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function ChannelVideoTable({ videos }: ChannelVideoTableProps) {
  const rows = (videos || []).filter(Boolean);
  return (
    <SurfaceBox content={false} className="overflow-hidden">
      <div className="max-h-[480px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-surface-raised">
            <TableRow>
              <TableHead className="w-10 text-right">#</TableHead>
              <TableHead>Video</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Likes</TableHead>
              <TableHead className="text-right">Comments</TableHead>
              <TableHead className="text-right">Engagement</TableHead>
              <TableHead className="text-right">Length</TableHead>
              <TableHead className="text-right">Published</TableHead>
              <TableHead className="w-10"><span className="sr-only">Watch</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((video, i) => <VideoRow key={video.videoId} video={video} rank={i + 1} />)}
          </TableBody>
        </Table>
      </div>
    </SurfaceBox>
  );
}
