import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SurfaceBox from '@/components/SurfaceBox';
import Num from '@/components/Num';
import { fmtCount, fmtDate, fmtDuration, fmtPercent } from '../../../utils/formatters';
import { isStrongEngagement, STRONG_ENGAGEMENT_HINT } from '@/lib/library';
import type { PageSlice } from '@/lib/library';
import { watchUrl } from './videoLibrary.ts';
import type { LibraryVideo, VideoSort, VideoSortField } from './videoLibrary.ts';
import VideoSortHeader from './VideoSortHeader';

interface VideoRowProps {
  video: LibraryVideo;
  rank: number;
  showChannel: boolean;
}

export interface VideoListTableProps {
  paged: PageSlice<LibraryVideo>;
  sort: VideoSort;
  onSort: (field: VideoSortField) => void;
  showChannel: boolean;
}

function VideoRow({ video, rank, showChannel }: VideoRowProps) {
  const strong = isStrongEngagement(video.engagementRate);
  return (
    <TableRow>
      <TableCell className="hidden text-right font-mono text-caption text-ink-faint sm:table-cell">{rank}</TableCell>
      <TableCell className="sticky left-0 z-[1] bg-surface-raised">
        <div className="flex items-center gap-3">
          {video.thumbnail
            ? <img src={video.thumbnail} alt="" loading="lazy" className="hidden h-9 w-16 shrink-0 rounded-sm object-cover sm:block" />
            : <span className="hidden h-9 w-16 shrink-0 rounded-sm bg-surface-sunken sm:block" />}
          <a href={watchUrl(video.videoId)} target="_blank" rel="noopener noreferrer" title={video.title} className="max-w-44 truncate text-sm font-medium text-ink underline-offset-4 hover:underline sm:max-w-72">
            {video.title}<span className="sr-only"> (opens on YouTube in a new tab)</span>
          </a>
        </div>
      </TableCell>
      {showChannel && <TableCell className="hidden max-w-36 truncate text-small text-ink-muted lg:table-cell" title={video.channelTitle}>{video.channelTitle}</TableCell>}
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

export default function VideoListTable({ paged, sort, onSort, showChannel }: VideoListTableProps) {
  return (
    <SurfaceBox title="Videos" headingLevel="h2" content={false} className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="hidden w-10 text-right sm:table-cell">#</TableHead>
            <VideoSortHeader field="title" label="Video" sort={sort} onSort={onSort} className="sticky left-0 z-[1] bg-surface-raised" />
            {showChannel && <TableHead className="hidden lg:table-cell">Channel</TableHead>}
            <VideoSortHeader field="viewCount" label="Views" sort={sort} onSort={onSort} align="right" />
            <VideoSortHeader field="likeCount" label="Likes" sort={sort} onSort={onSort} align="right" className="hidden sm:table-cell" />
            <VideoSortHeader field="commentCount" label="Comments" sort={sort} onSort={onSort} align="right" className="hidden md:table-cell" />
            <VideoSortHeader field="engagementRate" label="Engagement rate (%)" sort={sort} onSort={onSort} align="right" />
            <VideoSortHeader field="durationSeconds" label="Length" sort={sort} onSort={onSort} align="right" className="hidden lg:table-cell" />
            <VideoSortHeader field="publishedAt" label="Published" sort={sort} onSort={onSort} align="right" className="hidden md:table-cell" />
            <TableHead className="w-10"><span className="sr-only">Watch</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.items.map((video, i) => (
            <VideoRow key={`${video.videoId}-${i}`} video={video} rank={paged.offset + i + 1} showChannel={showChannel} />
          ))}
        </TableBody>
      </Table>
      <p className="border-t border-divider px-5 py-3 text-caption text-ink-faint">{STRONG_ENGAGEMENT_HINT}</p>
    </SurfaceBox>
  );
}
