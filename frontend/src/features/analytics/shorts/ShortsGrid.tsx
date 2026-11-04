import MediaCard, { MediaChip } from '@/components/MediaCard';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtNum, fmtDuration, fmtCount } from '../../../utils/formatters';
import type { LibraryVideo } from '../videos/videoLibrary.ts';

const { views: Views, likes: Likes, comments: Comments } = METRIC_ICONS;

export interface ShortsGridProps {
  shorts: LibraryVideo[];
}

export default function ShortsGrid({ shorts }: ShortsGridProps) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
      {shorts.map((video, i) => (
        <li key={`${video.videoId}-${i}`} className="flex">
          <MediaCard
            className="w-full"
            aspect="vertical"
            href={`https://www.youtube.com/shorts/${video.videoId}`}
            image={video.thumbnail}
            title={video.title}
            topRight={<MediaChip><Views aria-hidden="true" />{fmtNum(video.viewCount)}<span className="sr-only"> views</span></MediaChip>}
            bottomRight={<MediaChip><span className="sr-only">Length </span>{fmtDuration(video.durationSeconds)}</MediaChip>}
            meta={
              <>
                <span className="flex items-center gap-1"><Likes aria-hidden="true" />{fmtCount(video.likeCount)}<span className="sr-only"> likes</span></span>
                <span className="flex items-center gap-1"><Comments aria-hidden="true" />{fmtCount(video.commentCount)}<span className="sr-only"> comments</span></span>
                <span className="sr-only"> (opens on YouTube in a new tab)</span>
              </>
            }
          />
        </li>
      ))}
    </ul>
  );
}
