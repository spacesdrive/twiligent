import { ExternalLink, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import Num from '@/components/Num';
import RelativeTime from '@/components/RelativeTime';
import { cn } from '@/lib/utils';
import { hasTrackedViews, trackedViews } from '../../../utils/trackedContent';
import RowAction from '@/components/RowAction';
import TrackedThumbnail from './TrackedThumbnail';
import type { TrackedContentItem } from '@shared/types/domain.ts';

export interface TrackedRowProps {
  item: TrackedContentItem;
  isSelected: boolean;
  isRefreshing: boolean;
  onToggle: (id: string) => void;
  onRefresh: (id: string) => void;
  onEdit: (item: TrackedContentItem) => void;
  onDelete: (item: TrackedContentItem) => void;
}

export default function TrackedRow({ item, isSelected, isRefreshing, onToggle, onRefresh, onEdit, onDelete }: TrackedRowProps) {
  const title = item.title || item.label || item.url;
  return (
    <TableRow data-state={isSelected ? 'selected' : undefined}>
      <TableCell>
        <Checkbox checked={isSelected} onCheckedChange={() => onToggle(item.id)} aria-label={`Select ${title}`} />
      </TableCell>
      <TableCell className="sticky left-0 z-[1] bg-surface-raised whitespace-normal">
        <div className="flex max-w-56 items-start gap-3 sm:max-w-sm">
          <TrackedThumbnail item={item} />
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-medium leading-snug text-ink" title={title}>{title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {item.channelTitle && <span className="text-caption text-ink-faint">{item.channelTitle}</span>}
              {item.label && <span className="text-caption text-ink-faint italic">{item.label}</span>}
              {item.isShort && <Badge variant="outline">Short</Badge>}
              {item.category && <Badge variant="secondary" className="lg:hidden">{item.category}</Badge>}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        {item.category ? <Badge variant="secondary">{item.category}</Badge> : <span className="text-ink-faint">-</span>}
      </TableCell>
      <TableCell className="hidden text-right sm:table-cell">
        {hasTrackedViews(item) ? <span className="text-ink"><Num value={trackedViews(item)} /></span> : <span className="text-ink-faint">-</span>}
      </TableCell>
      <TableCell className="text-right font-semibold text-ink">{item.likeCount != null ? <Num value={item.likeCount} /> : '-'}</TableCell>
      <TableCell className="hidden text-right text-ink-muted md:table-cell">{item.commentCount != null ? <Num value={item.commentCount} /> : '-'}</TableCell>
      <TableCell className="hidden text-right text-small text-ink-faint md:table-cell">
        {item.lastFetchedAt ? <RelativeTime date={item.lastFetchedAt} /> : '-'}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-0.5">
          <RowAction label="Refresh live data" target={title} onClick={() => onRefresh(item.id)} disabled={isRefreshing}>
            <RefreshCw className={cn(isRefreshing && 'animate-spin')} aria-hidden="true" />
          </RowAction>
          <RowAction label="Edit" target={title} onClick={() => onEdit(item)}><Pencil aria-hidden="true" /></RowAction>
          <RowAction label="Open original" target={title} href={item.permalink || item.url}><ExternalLink aria-hidden="true" /></RowAction>
          <RowAction label="Stop tracking" target={title} onClick={() => onDelete(item)} danger><Trash2 aria-hidden="true" /></RowAction>
        </div>
      </TableCell>
    </TableRow>
  );
}
