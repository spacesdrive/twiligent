import { ExternalLink, Eye, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PlatformBadge } from '@/components/platform';
import { cn } from '@/lib/utils';
import { fmtDate, fmtNum } from '../../../utils/formatters';
import { hasTrackedViews, trackedViews } from '../../../utils/trackedContent';
import RowAction from '@/components/RowAction';
import TrackedThumbnail from './TrackedThumbnail';
import type { TrackedContentItem } from '@shared/types/domain.ts';

interface ViewsCellProps {
  item: TrackedContentItem;
  isYT: boolean;
  onEdit: (item: TrackedContentItem) => void;
}

function ViewsCell({ item, isYT, onEdit }: ViewsCellProps) {
  if (hasTrackedViews(item)) return <span className="text-ink">{fmtNum(trackedViews(item))}</span>;
  if (isYT) return <span className="text-ink-faint">-</span>;
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="xs" onClick={() => onEdit(item)} />}>
        <Eye />Add
      </TooltipTrigger>
      <TooltipContent>Reddit does not report views. Enter them by hand.</TooltipContent>
    </Tooltip>
  );
}

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
  const isYT = item.contentType === 'youtube';
  const title = item.title || item.label || item.url;
  const engagement = isYT ? item.likeCount : item.score;
  const comments = isYT ? item.commentCount : item.numComments;
  return (
    <TableRow data-state={isSelected ? 'selected' : undefined}>
      <TableCell>
        <Checkbox checked={isSelected} onCheckedChange={() => onToggle(item.id)} aria-label={`Select ${title}`} />
      </TableCell>
      <TableCell className="whitespace-normal">
        <div className="flex max-w-sm items-start gap-3">
          <TrackedThumbnail item={item} title={title} isYT={isYT} />
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-medium leading-snug text-ink">{title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <PlatformBadge platform={item.contentType || 'reddit'} className="h-5" />
              <span className="text-caption text-ink-faint">{isYT ? item.channelTitle : item.subredditPrefixed}</span>
              {item.label && <span className="text-caption text-ink-faint italic">{item.label}</span>}
              {isYT && item.isShort && <Badge variant="outline">Short</Badge>}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {item.category ? <Badge variant="secondary">{item.category}</Badge> : <span className="text-ink-faint">-</span>}
      </TableCell>
      <TableCell className="text-right">
        <ViewsCell item={item} isYT={isYT} onEdit={onEdit} />
      </TableCell>
      <TableCell className="text-right font-semibold text-ink">{engagement !== undefined ? fmtNum(engagement) : '-'}</TableCell>
      <TableCell className="text-right text-ink-muted">{comments !== undefined ? fmtNum(comments) : '-'}</TableCell>
      <TableCell className="text-right text-ink-muted">
        {!isYT && item.upvoteRatio !== undefined && (item.score ?? 0) >= 10 ? `${Math.round(item.upvoteRatio * 100)}%` : '-'}
      </TableCell>
      <TableCell className="text-right text-small text-ink-faint">{item.lastFetchedAt ? fmtDate(item.lastFetchedAt) : '-'}</TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-0.5">
          <RowAction label="Refresh live data" onClick={() => onRefresh(item.id)} disabled={isRefreshing}>
            <RefreshCw className={cn(isRefreshing && 'animate-spin')} />
          </RowAction>
          <RowAction label="Edit" onClick={() => onEdit(item)}><Pencil /></RowAction>
          <RowAction label="Open original" href={item.permalink || item.url}><ExternalLink /></RowAction>
          <RowAction label="Stop tracking" onClick={() => onDelete(item)} danger><Trash2 /></RowAction>
        </div>
      </TableCell>
    </TableRow>
  );
}
