import { Eye, Heart, MessageCircle } from 'lucide-react';
import MediaCard, { MediaChip } from '@/components/MediaCard';
import { fmtNum, timeAgo } from '../../../utils/formatters';
import { fmtIGViews, igContentTypeMeta, igThumbnail } from '../../../utils/instagramContent';
import type { LibraryMedia } from './reelsLibrary.ts';

export interface ReelsGridProps {
  items: LibraryMedia[];
}

export default function ReelsGrid({ items }: ReelsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {items.map((item, i) => (
        <MediaCard
          key={`${item.id}-${i}`}
          aspect="square"
          href={item.permalink}
          image={igThumbnail(item)}
          title={item.caption}
          topLeft={<MediaChip>{igContentTypeMeta(item.contentType).label}</MediaChip>}
          meta={
            <>
              <span className="flex items-center gap-1"><Eye />{fmtIGViews(item.viewCount)}</span>
              <span className="flex items-center gap-1"><Heart />{fmtNum(item.likeCount)}</span>
              <span className="flex items-center gap-1"><MessageCircle />{fmtNum(item.commentsCount)}</span>
              <span className="ml-auto">{timeAgo(item.timestamp)}</span>
            </>
          }
        />
      ))}
    </div>
  );
}
