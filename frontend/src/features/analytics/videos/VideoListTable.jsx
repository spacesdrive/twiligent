import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SurfaceBox from '@/components/SurfaceBox';
import { fmtCount, fmtDate, fmtDuration, fmtNum, fmtPercent } from '../../../utils/formatters';
import { watchUrl } from './videoLibrary.js';
import VideoSortHeader from './VideoSortHeader';

function VideoRow({ video, rank, showChannel }) {
  return (
    <TableRow>
      <TableCell className="text-right font-mono text-caption text-ink-faint">{rank}</TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          {video.thumbnail
            ? <img src={video.thumbnail} alt="" loading="lazy" className="h-9 w-16 shrink-0 rounded-sm object-cover" />
            : <span className="h-9 w-16 shrink-0 rounded-sm bg-surface-sunken" />}
          <a href={watchUrl(video.videoId)} target="_blank" rel="noopener noreferrer" className="max-w-[18rem] truncate text-sm font-medium text-ink hover:underline">
            {video.title}
          </a>
        </div>
      </TableCell>
      {showChannel && <TableCell className="max-w-36 truncate text-small text-ink-muted">{video.channelTitle}</TableCell>}
      <TableCell className="text-right font-semibold text-ink">{fmtNum(video.viewCount)}</TableCell>
      <TableCell className="text-right text-ink-muted">{fmtCount(video.likeCount)}</TableCell>
      <TableCell className="text-right text-ink-muted">{fmtCount(video.commentCount)}</TableCell>
      <TableCell className="text-right">
        <Badge variant={parseFloat(video.engagementRate) > 5 ? 'success' : 'secondary'}>{fmtPercent(video.engagementRate)}</Badge>
      </TableCell>
      <TableCell className="text-right text-ink-muted">{fmtDuration(video.durationSeconds)}</TableCell>
      <TableCell className="text-right text-small text-ink-faint">{fmtDate(video.publishedAt)}</TableCell>
      <TableCell>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-xs" render={<a href={watchUrl(video.videoId)} target="_blank" rel="noopener noreferrer" aria-label={`Watch ${video.title} on YouTube`} />} />}>
            <Play />
          </TooltipTrigger>
          <TooltipContent>Watch on YouTube</TooltipContent>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

export default function VideoListTable({ paged, sort, onSort, showChannel }) {
  return (
    <SurfaceBox content={false} className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-right">#</TableHead>
            <TableHead><VideoSortHeader field="title" label="Video" sort={sort} onSort={onSort} /></TableHead>
            {showChannel && <TableHead>Channel</TableHead>}
            <TableHead className="text-right"><VideoSortHeader field="viewCount" label="Views" sort={sort} onSort={onSort} align="right" /></TableHead>
            <TableHead className="text-right"><VideoSortHeader field="likeCount" label="Likes" sort={sort} onSort={onSort} align="right" /></TableHead>
            <TableHead className="text-right"><VideoSortHeader field="commentCount" label="Comments" sort={sort} onSort={onSort} align="right" /></TableHead>
            <TableHead className="text-right"><VideoSortHeader field="engagementRate" label="Engagement" sort={sort} onSort={onSort} align="right" /></TableHead>
            <TableHead className="text-right"><VideoSortHeader field="durationSeconds" label="Length" sort={sort} onSort={onSort} align="right" /></TableHead>
            <TableHead className="text-right"><VideoSortHeader field="publishedAt" label="Published" sort={sort} onSort={onSort} align="right" /></TableHead>
            <TableHead className="w-10"><span className="sr-only">Watch</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.items.map((video, i) => (
            <VideoRow key={`${video.videoId}-${i}`} video={video} rank={paged.offset + i + 1} showChannel={showChannel} />
          ))}
        </TableBody>
      </Table>
    </SurfaceBox>
  );
}
