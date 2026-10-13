import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import StatusBadge from './StatusBadge';
import { ACTIVE_BULK, BULK_STATUS } from './publishConstants';
import { fileSizeMb, isVideoFile } from './queueHelpers.ts';

export default function BulkFileItem({ item, position, processing, onCaptionChange, onRemove }) {
  const isActive = ACTIVE_BULK.includes(item.status);
  return (
    <li className={cn('flex items-start gap-3 rounded-field border p-3', isActive ? 'border-brand/40 bg-brand-soft/20' : 'border-line')}>
      <div className="relative size-14 shrink-0 overflow-hidden rounded-control bg-surface-sunken">
        {isVideoFile(item.file)
          ? <video src={item.preview} muted className="size-full object-cover" />
          : <img src={item.preview} alt="" className="size-full object-cover" />}
        <span className="absolute top-0.5 left-0.5 rounded-sm bg-[#0C0809]/75 px-1 font-mono text-[0.5625rem] font-semibold text-white">{position}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="truncate text-sm font-medium text-ink">{item.file.name}</span>
          <span className="shrink-0 text-caption text-ink-faint">{fileSizeMb(item.file, 1)} MB</span>
        </div>
        {item.status === 'pending' ? (
          <Textarea value={item.caption} onChange={e => onCaptionChange(item.id, e.target.value)} placeholder={`Caption for file ${position}`} rows={1} className="min-h-9 text-small" aria-label={`Caption for file ${position}`} />
        ) : (
          <p className="truncate text-caption text-ink-muted">{item.caption || 'No caption'}</p>
        )}
        {item.status === 'uploading' && <Progress value={item.progress} className="mt-1.5" aria-label={`Upload progress for file ${position}`} />}
        {item.error && <p className="mt-1 text-caption text-danger">Error: {item.error}</p>}
        {item.mediaId && <p className="mt-1 font-mono text-caption text-success">Media ID {item.mediaId}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {isActive && <Spinner className="size-3.5 text-brand" />}
        <StatusBadge status={item.status} map={BULK_STATUS} />
        {item.status === 'pending' && !processing && (
          <Button variant="ghost" size="icon-xs" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.file.name}`}><X /></Button>
        )}
      </div>
    </li>
  );
}
