import React from 'react';
import { Eye, MessageSquare, ThumbsUp } from 'lucide-react';
import MediaCard, { MediaChip } from '@/components/MediaCard';
import { fmtNum, fmtDuration, fmtCount } from '../../../utils/formatters';
import type { LibraryVideo } from '../videos/videoLibrary.ts';

export interface ShortsGridProps {
  shorts: LibraryVideo[];
}

export default function ShortsGrid({ shorts }: ShortsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
      {shorts.map((video, i) => (
        <MediaCard
          key={`${video.videoId}-${i}`}
          aspect="vertical"
          href={`https://www.youtube.com/shorts/${video.videoId}`}
          image={video.thumbnail}
          title={video.title}
          topRight={<MediaChip><Eye />{fmtNum(video.viewCount)}</MediaChip>}
          bottomRight={<MediaChip>{fmtDuration(video.durationSeconds)}</MediaChip>}
          meta={
            <>
              <span className="flex items-center gap-1"><ThumbsUp />{fmtCount(video.likeCount)}</span>
              <span className="flex items-center gap-1"><MessageSquare />{fmtCount(video.commentCount)}</span>
            </>
          }
        />
      ))}
    </div>
  );
}
