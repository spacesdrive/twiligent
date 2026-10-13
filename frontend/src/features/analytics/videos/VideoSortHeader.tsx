import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { ariaSortOf } from './videoLibrary.ts';
import type { VideoSort, VideoSortField } from './videoLibrary.ts';

export interface VideoSortHeaderProps {
  field: VideoSortField;
  label: ReactNode;
  sort: VideoSort;
  onSort: (field: VideoSortField) => void;
  align?: 'left' | 'right';
}

export default function VideoSortHeader({ field, label, sort, onSort, align = 'left' }: VideoSortHeaderProps) {
  const active = sort.field === field;
  const Arrow = sort.order === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      aria-sort={ariaSortOf(sort, field)}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm transition-colors hover:text-ink',
        align === 'right' && 'flex-row-reverse',
        active ? 'text-ink' : 'text-ink-muted',
      )}
    >
      {label}
      <Arrow className={cn('size-3', !active && 'invisible')} />
    </button>
  );
}
