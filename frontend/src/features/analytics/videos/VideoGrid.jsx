import { Eye, MessageSquare, ThumbsUp } from 'lucide-react';
import MediaCard, { MediaChip } from '@/components/MediaCard';
import { fmtCount, fmtDuration, fmtNum, timeAgo } from '../../../utils/formatters';
import { watchUrl } from './videoLibrary.js';

export default function VideoGrid({ items, showChannel }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {items.map((video, i) => (
        <MediaCard
          key={`${video.videoId}-${i}`}
          href={watchUrl(video.videoId)}
          image={video.thumbnail}
          title={video.title}
          topRight={<MediaChip><Eye />{fmtNum(video.viewCount)}</MediaChip>}
          bottomRight={video.durationSeconds > 0 && <MediaChip>{fmtDuration(video.durationSeconds)}</MediaChip>}
          meta={
            <>
              <span className="flex items-center gap-1"><ThumbsUp />{fmtCount(video.likeCount)}</span>
              <span className="flex items-center gap-1"><MessageSquare />{fmtCount(video.commentCount)}</span>
              <span className="ml-auto">{showChannel ? video.channelTitle : timeAgo(video.publishedAt)}</span>
            </>
          }
        />
      ))}
    </div>
  );
}
