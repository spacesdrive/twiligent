import { igContentTypeMeta } from '../../../utils/instagramContent';
import type { InstagramContentType } from '@shared/types/instagram.ts';

export interface TypeBadgeProps {
  type: InstagramContentType;
}

export default function TypeBadge({ type }: TypeBadgeProps) {
  const meta = igContentTypeMeta(type);
  return (
    <span className="inline-flex h-5 items-center gap-1.5 rounded-pill border border-line px-2 text-caption font-medium text-ink-muted">
      <span className="size-2 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}
