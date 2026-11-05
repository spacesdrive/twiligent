import React, { useState } from 'react';
import { ExternalLink, RotateCcw, Upload, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import ConfirmDialog from '@/components/ConfirmDialog';
import RelativeTime from '@/components/RelativeTime';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState } from '@/components/StateViews';
import { STATE_DISPLAY, uploadPercent } from './youtubeUploadData';
import type { StateTone } from './youtubeUploadData';
import type { YouTubeUploadState, YouTubeUploadSummary } from '@shared/types/youtubePublishing.ts';

export interface YouTubeUploadListProps {
  uploads: YouTubeUploadSummary[];
  busyId: string | null;
  onCancel: (id: string) => Promise<void>;
  onRetry: (id: string) => Promise<void>;
}

const BADGE: Record<StateTone, 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  secondary: 'secondary', info: 'outline', success: 'success', warning: 'warning', danger: 'destructive',
};
const CANCELLABLE: YouTubeUploadState[] = ['queued', 'uploading', 'waiting_quota', 'needs_reconnect', 'failed', 'needs_review'];
const RETRYABLE: YouTubeUploadState[] = ['failed', 'needs_review'];

function UploadRow({ upload, busy, onAskCancel, onRetry }: { upload: YouTubeUploadSummary; busy: boolean; onAskCancel: () => void; onRetry: () => void }) {
  const display = STATE_DISPLAY[upload.state];
  const percent = uploadPercent(upload);
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-ink">{upload.title}</p>
            <Badge variant={BADGE[display.tone]}>{display.label}</Badge>
            {upload.isShort && <Badge variant="outline">Short</Badge>}
            <Badge variant="outline">{upload.publishAt ? 'Scheduled' : upload.privacy[0].toUpperCase() + upload.privacy.slice(1)}</Badge>
          </div>
          <p className="text-caption text-ink-muted">
            <RelativeTime date={upload.createdAt} prefix="Queued " />
            {upload.publishAt && <> <span aria-hidden="true">·</span><span className="sr-only">,</span> <RelativeTime date={upload.publishAt} prefix="publishes " /></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {upload.videoId && (
            <Button variant="outline" size="sm" render={<a href={`https://www.youtube.com/watch?v=${encodeURIComponent(upload.videoId)}`} target="_blank" rel="noopener noreferrer" />}>
              <ExternalLink data-icon="inline-start" />
              Open on YouTube<span className="sr-only"> (opens in a new tab)</span>
            </Button>
          )}
          {RETRYABLE.includes(upload.state) && (
            <Button variant="outline" size="sm" onClick={onRetry} disabled={busy} aria-label={`Try again: ${upload.title}`}>
              <RotateCcw data-icon="inline-start" />
              Try again
            </Button>
          )}
          {CANCELLABLE.includes(upload.state) && (
            <Button variant="ghost" size="sm" onClick={onAskCancel} disabled={busy} aria-label={`Cancel upload: ${upload.title}`}>
              <X data-icon="inline-start" />
              Cancel
            </Button>
          )}
        </div>
      </div>
      {upload.state === 'uploading' && <Progress value={percent} aria-label={`Upload progress for ${upload.title}: ${percent} percent`} />}
      <p className="max-w-prose text-sm text-ink-muted">{upload.lastError ?? display.help}</p>
    </li>
  );
}

export default function YouTubeUploadList({ uploads, busyId, onCancel, onRetry }: YouTubeUploadListProps) {
  const [pending, setPending] = useState<YouTubeUploadSummary | null>(null);

  return (
    <SurfaceBox title="Your uploads" headingLevel="h2" content={false}>
      {uploads.length === 0 ? (
        <EmptyState compact icon={<Upload />} title="No uploads yet" description="Queue a video above; it appears here with its progress." />
      ) : (
        <ul className="divide-y divide-divider">
          {uploads.map(upload => (
            <UploadRow
              key={upload.id}
              upload={upload}
              busy={busyId === upload.id}
              onAskCancel={() => setPending(upload)}
              onRetry={() => { void onRetry(upload.id); }}
            />
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={open => { if (!open) setPending(null); }}
        title={`Cancel ${pending?.title ?? 'this upload'}?`}
        description="YouTube has not finished the video, so nothing appears on the channel. Queue it again later if you change your mind."
        confirmLabel="Cancel upload"
        cancelLabel="Keep it"
        busyLabel="Cancelling"
        busy={pending !== null && busyId === pending.id}
        onConfirm={() => {
          if (pending) void onCancel(pending.id).then(() => setPending(null));
        }}
      />
    </SurfaceBox>
  );
}
