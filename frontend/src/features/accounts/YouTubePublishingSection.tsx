import React, { useState } from 'react';
import { CheckCircle2, Link2, Trash2, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import ConfirmDialog from '@/components/ConfirmDialog';
import RelativeTime from '@/components/RelativeTime';
import RowAction from '@/components/RowAction';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { useAppContext } from '../../context/AppContext';
import { useYouTubeConnections } from './useYouTubeConnections';
import type { YouTubeConnectionSummary } from '@shared/types/youtubePublishing.ts';

export default function YouTubePublishingSection() {
  const { showToast } = useAppContext();
  const youtube = useYouTubeConnections(showToast);
  const [pending, setPending] = useState<YouTubeConnectionSummary | null>(null);

  const connectButton = (
    <Button variant="outline" onClick={() => { void youtube.connect(); }} disabled={youtube.connecting || !youtube.configured}>
      {youtube.connecting ? <Spinner className="size-4" /> : <Link2 data-icon="inline-start" />}
      {youtube.connecting ? 'Opening Google' : 'Connect a channel'}
    </Button>
  );

  return (
    <section id="youtube-publishing" aria-labelledby="youtube-publishing-title" className="flex scroll-mt-20 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="youtube-publishing-title" className="font-heading text-section font-semibold text-ink">YouTube publishing</h2>
          <p className="max-w-prose text-body text-ink-muted">
            Connect a channel with Google to upload videos to it. Twiligent asks only to upload and to read the channel, never to change or delete what is there.
          </p>
        </div>
        {youtube.connections.length > 0 && connectButton}
      </div>

      {youtube.loading ? (
        <Skeleton className="h-24 rounded-card" />
      ) : youtube.error ? (
        <SurfaceBox><ErrorState title="YouTube connections could not load" description={youtube.error} onRetry={() => { void youtube.reload(); }} /></SurfaceBox>
      ) : !youtube.configured ? (
        <SurfaceBox>
          <EmptyState compact icon={<TriangleAlert />} title="Not set up on this server" description="The owner needs to add a Google OAuth client and TOKEN_ENCRYPTION_KEY before channels can be connected." />
        </SurfaceBox>
      ) : youtube.connections.length === 0 ? (
        <SurfaceBox>
          <EmptyState compact icon={<Link2 />} title="No channel connected for publishing" description="Analytics work without this; publishing needs the channel owner to sign in once." action={connectButton} />
        </SurfaceBox>
      ) : (
        <SurfaceBox content={false}>
          <ul className="divide-y divide-divider">
            {youtube.connections.map(connection => (
              <li key={connection.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-ink">{connection.channelTitle || connection.channelId}</p>
                    {connection.status === 'active'
                      ? <Badge variant="success"><CheckCircle2 />Connected</Badge>
                      : <Badge variant="warning"><TriangleAlert />Needs a new sign-in</Badge>}
                  </div>
                  <p className="text-caption text-ink-muted"><RelativeTime date={connection.createdAt} prefix="Connected " /></p>
                </div>
                <div className="flex items-center gap-2">
                  {connection.status !== 'active' && (
                    <Button variant="outline" size="sm" onClick={() => { void youtube.connect(); }} disabled={youtube.connecting} aria-label={`Sign in again: ${connection.channelTitle}`}>
                      Sign in again
                    </Button>
                  )}
                  <RowAction label="Disconnect" target={connection.channelTitle || connection.channelId} onClick={() => setPending(connection)} danger>
                    <Trash2 />
                  </RowAction>
                </div>
              </li>
            ))}
          </ul>
        </SurfaceBox>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={open => { if (!open) setPending(null); }}
        title={`Disconnect ${pending?.channelTitle || 'this channel'}?`}
        description="Google is told to drop Twiligent's access, and this channel's upload queue and history are removed. Videos already on YouTube stay there. Its analytics are not affected."
        confirmLabel="Disconnect"
        busyLabel="Disconnecting"
        busy={pending !== null && youtube.removingId === pending.id}
        onConfirm={() => {
          if (pending) void youtube.disconnect(pending).then(done => { if (done) setPending(null); });
        }}
        hold
      />
    </section>
  );
}
