import { ExternalLink, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { PlatformBadge } from '@/components/platform';
import Num from '@/components/Num';
import RelativeTime from '@/components/RelativeTime';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { cn } from '@/lib/utils';
import { hasTrackedViews, trackedViews } from '../../../utils/trackedContent';
import RowAction from '@/components/RowAction';
import TrackedThumbnail from './TrackedThumbnail';
import type { TrackedContentItem } from '@shared/types/domain.ts';

const Views = METRIC_ICONS.views;

interface ViewsCellProps {
  item: TrackedContentItem;
  title: string;
  isYT: boolean;
  onEdit: (item: TrackedContentItem) => void;
}

// the reason views are missing is part of the button's name, so it reaches touch and screen reader users too
function ViewsCell({ item, title, isYT, onEdit }: ViewsCellProps) {
  if (hasTrackedViews(item)) return <span className="text-ink"><Num value={trackedViews(item)} /></span>;
  if (isYT) return <span className="text-ink-faint">-</span>;
  return (
    <Button variant="ghost" size="xs" onClick={() => onEdit(item)} title="Reddit does not report views. Enter them by hand.">
      <Views aria-hidden="true" />Add
      <span className="sr-only"> views for {title}. Reddit does not report views, so they are entered by hand.</span>
    </Button>
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
      <TableCell className="sticky left-0 z-[1] bg-surface-raised whitespace-normal">
        <div className="flex max-w-56 items-start gap-3 sm:max-w-sm">
          <TrackedThumbnail item={item} title={title} isYT={isYT} />
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-medium leading-snug text-ink" title={title}>{title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <PlatformBadge platform={item.contentType || 'reddit'} className="h-5" />
              <span className="text-caption text-ink-faint">{isYT ? item.channelTitle : item.subredditPrefixed}</span>
              {item.label && <span className="text-caption text-ink-faint italic">{item.label}</span>}
              {isYT && item.isShort && <Badge variant="outline">Short</Badge>}
              {item.category && <Badge variant="secondary" className="lg:hidden">{item.category}</Badge>}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        {item.category ? <Badge variant="secondary">{item.category}</Badge> : <span className="text-ink-faint">-</span>}
      </TableCell>
      <TableCell className="hidden text-right sm:table-cell">
        <ViewsCell item={item} title={title} isYT={isYT} onEdit={onEdit} />
      </TableCell>
      <TableCell className="text-right font-semibold text-ink">{engagement !== undefined ? <Num value={engagement} /> : '-'}</TableCell>
      <TableCell className="hidden text-right text-ink-muted md:table-cell">{comments !== undefined ? <Num value={comments} /> : '-'}</TableCell>
      <TableCell className="hidden text-right text-ink-muted lg:table-cell">
        {!isYT && item.upvoteRatio !== undefined && (item.score ?? 0) >= 10 ? `${Math.round(item.upvoteRatio * 100)}%` : '-'}
      </TableCell>
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
