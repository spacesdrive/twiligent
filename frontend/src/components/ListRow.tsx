import React from 'react';
import { cn } from '@/lib/utils';

// Rank shown in mono so digits align; the leader carries the brand accent.
export function RankNumber({ rank, className }) {
  return (
    <span
      className={cn(
        'w-5 shrink-0 text-right font-mono text-caption tabular-nums',
        rank === 1 ? 'font-semibold text-brand-text' : 'text-ink-faint',
        className,
      )}
    >
      {rank}
    </span>
  );
}

// Dense, clickable row: leading media, a title with one line of metadata, and trailing content.
export default function ListRow({
  leading,
  title,
  meta,
  trailing,
  onClick,
  selected = false,
  className,
}) {
  const Element = onClick ? 'button' : 'div';
  return (
    <Element
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick && selected ? true : undefined}
      className={cn(
        'flex w-full min-w-0 items-center gap-3 rounded-row px-2.5 py-2 text-left transition-colors duration-(--duration-fast)',
        onClick && 'hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
        selected && 'bg-surface-selected',
        className,
      )}
    >
      {leading}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-ink">{title}</span>
        {meta && <span className="truncate text-caption text-ink-faint">{meta}</span>}
      </span>
      {trailing && <span className="flex shrink-0 items-center gap-2 text-small text-ink-muted tabular-nums">{trailing}</span>}
    </Element>
  );
}
