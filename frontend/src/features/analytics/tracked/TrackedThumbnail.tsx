import type { TrackedContentItem } from '@shared/types/domain.ts';

export interface TrackedThumbnailProps {
  item: TrackedContentItem;
}

export default function TrackedThumbnail({ item }: TrackedThumbnailProps) {
  if (!item.thumbnail) return null;
  return <img src={item.thumbnail} alt="" loading="lazy" className="mt-0.5 h-10 w-16 shrink-0 rounded-sm object-cover" />;
}
