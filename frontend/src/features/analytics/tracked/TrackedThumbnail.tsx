import ImageLightbox from '@/components/ImageLightbox';
import type { TrackedContentItem } from '@shared/types/domain.ts';

export interface TrackedThumbnailProps {
  item: TrackedContentItem;
  title: string;
  isYT: boolean;
}

export default function TrackedThumbnail({ item, title, isYT }: TrackedThumbnailProps) {
  if (isYT && item.thumbnail) {
    return <img src={item.thumbnail} alt="" loading="lazy" className="mt-0.5 h-10 w-16 shrink-0 rounded-sm object-cover" />;
  }
  if (!isYT && item.imageUrl) {
    return <ImageLightbox src={item.imageUrl} alt={title || 'Reddit post'} className="mt-0.5" />;
  }
  return null;
}
