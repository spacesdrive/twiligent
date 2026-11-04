import MediaCard, { MediaChip } from '@/components/MediaCard';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtCount, fmtDuration, fmtNum, timeAgo } from '../../../utils/formatters';
import { watchUrl } from './videoLibrary.ts';
import type { LibraryVideo } from './videoLibrary.ts';

const { views: Views, likes: Likes, comments: Comments } = METRIC_ICONS;

export interface VideoGridProps {
  items: LibraryVideo[];
  showChannel: boolean;
}

export default function VideoGrid({ items, showChannel }: VideoGridProps) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {items.map((video, i) => (
        <li key={`${video.videoId}-${i}`} className="flex">
          <MediaCard
            className="w-full"
            href={watchUrl(video.videoId)}
            image={video.thumbnail}
            title={video.title}
            topRight={<MediaChip><Views aria-hidden="true" />{fmtNum(video.viewCount)}<span className="sr-only"> views</span></MediaChip>}
            bottomRight={video.durationSeconds > 0 && <MediaChip><span className="sr-only">Length </span>{fmtDuration(video.durationSeconds)}</MediaChip>}
            meta={
              <>
                <span className="flex items-center gap-1"><Likes aria-hidden="true" />{fmtCount(video.likeCount)}<span className="sr-only"> likes</span></span>
                <span className="flex items-center gap-1"><Comments aria-hidden="true" />{fmtCount(video.commentCount)}<span className="sr-only"> comments</span></span>
                <span className="ml-auto truncate">{showChannel ? video.channelTitle : timeAgo(video.publishedAt)}</span>
                <span className="sr-only"> (opens on YouTube in a new tab)</span>
              </>
            }
          />
        </li>
      ))}
    </ul>
  );
}
