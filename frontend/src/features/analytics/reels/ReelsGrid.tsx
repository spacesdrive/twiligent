import MediaCard, { MediaChip } from '@/components/MediaCard';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtNum, timeAgo } from '../../../utils/formatters';
import { fmtIGViews, igContentTypeMeta, igThumbnail } from '../../../utils/instagramContent';
import type { LibraryMedia } from './reelsLibrary.ts';

const { views: Views, instagramLikes: Likes, comments: Comments } = METRIC_ICONS;

export interface ReelsGridProps {
  items: LibraryMedia[];
}

export default function ReelsGrid({ items }: ReelsGridProps) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {items.map((item, i) => (
        <li key={`${item.id}-${i}`} className="flex">
          <MediaCard
            className="w-full"
            aspect="square"
            href={item.permalink}
            image={igThumbnail(item)}
            title={item.caption}
            topLeft={<MediaChip>{igContentTypeMeta(item.contentType).label}</MediaChip>}
            meta={
              <>
                <span className="flex items-center gap-1"><Views aria-hidden="true" />{fmtIGViews(item.viewCount)}<span className="sr-only"> views</span></span>
                <span className="flex items-center gap-1"><Likes aria-hidden="true" />{fmtNum(item.likeCount)}<span className="sr-only"> likes</span></span>
                <span className="flex items-center gap-1"><Comments aria-hidden="true" />{fmtNum(item.commentsCount)}<span className="sr-only"> comments</span></span>
                <span className="ml-auto" title={item.timestamp ? new Date(item.timestamp).toLocaleString('en-US') : undefined}>{timeAgo(item.timestamp)}</span>
                <span className="sr-only"> (opens on Instagram in a new tab)</span>
              </>
            }
          />
        </li>
      ))}
    </ul>
  );
}
