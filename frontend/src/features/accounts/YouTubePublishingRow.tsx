import React from 'react';
import { Check, CheckCircle2, CircleDashed, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import type { CardPublishing } from './youtubePublishingState';

export interface YouTubePublishingRowProps {
  publishing: CardPublishing;
  channelName: string;
  verifying: boolean;
  onVerify: () => void;
  onTurnOff: () => void;
}

// publishing status for one YouTube card: whether Google confirmed the channel is the person's, and the one action that fits
export default function YouTubePublishingRow({ publishing, channelName, verifying, onVerify, onTurnOff }: YouTubePublishingRowProps) {
  if (publishing.kind === 'hidden') return null;
  if (publishing.kind === 'loading') return <Skeleton className="h-8 rounded-control" />;

  const verifyButton = (label: string) => (
    <Button variant="outline" size="sm" onClick={onVerify} disabled={verifying} aria-label={verifying ? undefined : `${label} for publishing: ${channelName}`}>
      {verifying ? <Spinner className="size-4" /> : <Check data-icon="inline-start" />}
      {verifying ? 'Opening Google' : label}
    </Button>
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-divider pt-3">
      {publishing.kind === 'verified' && (
        <>
          <Badge variant="success"><CheckCircle2 />Verified for publishing</Badge>
          <Button variant="ghost" size="sm" className="text-ink-muted" onClick={onTurnOff} aria-label={`Turn off publishing for ${channelName}`}>
            Turn off
          </Button>
        </>
      )}
      {publishing.kind === 'needs_sign_in' && (
        <>
          <Badge variant="warning"><TriangleAlert />Needs a new sign-in</Badge>
          {verifyButton('Verify again')}
        </>
      )}
      {publishing.kind === 'unverified' && (
        <>
          <span className="flex items-center gap-1.5 text-sm text-ink-muted">
            <CircleDashed className="size-4" aria-hidden="true" />
            Not verified for publishing
          </span>
          {verifyButton('Verify')}
        </>
      )}
    </div>
  );
}
