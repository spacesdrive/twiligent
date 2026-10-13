import { igContentTypeMeta } from '../../../utils/instagramContent';

export default function TypeBadge({ type }) {
  const meta = igContentTypeMeta(type);
  return (
    <span className="inline-flex h-5 items-center gap-1.5 rounded-pill border border-line px-2 text-caption font-medium text-ink-muted">
      <span className="size-2 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}
