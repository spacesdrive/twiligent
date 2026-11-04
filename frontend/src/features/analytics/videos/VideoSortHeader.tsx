import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ariaSortOf } from './videoLibrary.ts';
import type { VideoSort, VideoSortField } from './videoLibrary.ts';

export interface VideoSortHeaderProps {
  field: VideoSortField;
  label: string;
  sort: VideoSort;
  onSort: (field: VideoSortField) => void;
  align?: 'left' | 'right';
  className?: string;
}

// aria-sort belongs on the column header, so the header cell is part of this component, not just the button
export default function VideoSortHeader({ field, label, sort, onSort, align = 'left', className }: VideoSortHeaderProps) {
  const active = sort.field === field;
  const Arrow = !active ? ArrowUpDown : sort.order === 'asc' ? ArrowUp : ArrowDown;
  const state = active ? `, sorted ${sort.order === 'asc' ? 'ascending' : 'descending'}` : '';
  return (
    <TableHead aria-sort={ariaSortOf(sort, field) ?? 'none'} className={cn(align === 'right' && 'text-right', className)}>
      <button
        type="button"
        onClick={() => onSort(field)}
        aria-label={`${label}${state}. Sort by ${label.toLowerCase()}`}
        className={cn(
          'inline-flex items-center gap-1 rounded-sm transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-ring',
          align === 'right' && 'flex-row-reverse',
          active ? 'text-ink' : 'text-ink-muted',
        )}
      >
        {label}
        <Arrow className={cn('size-3', !active && 'opacity-50')} aria-hidden="true" />
      </button>
    </TableHead>
  );
}
