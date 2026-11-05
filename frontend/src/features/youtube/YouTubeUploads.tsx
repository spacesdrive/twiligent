import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/PageHeader';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { docsUrl } from '@/lib/docs';
import { useAppContext } from '../../context/AppContext';
import { useCloudinaryConfig } from '../../hooks/use-cloudinary-config';
import YouTubeComposer from './YouTubeComposer';
import YouTubeUploadList from './YouTubeUploadList';
import { useYouTubePublishing } from './useYouTubePublishing';

const DESCRIPTION = 'Upload videos and Shorts to your YouTube channels verified for publishing.';

export default function YouTubeUploads() {
  const { accounts, showToast } = useAppContext();
  const cloudinary = useCloudinaryConfig(accounts);
  const youtube = useYouTubePublishing(showToast);
  const active = youtube.connections.filter(connection => connection.status === 'active');

  if (youtube.loading) {
    return (
      <div role="status" className="flex flex-col gap-6">
        <PageHeader title="YouTube uploads" description={DESCRIPTION} />
        <span className="sr-only">Loading YouTube uploads</span>
        <Skeleton className="h-64 rounded-card" />
        <Skeleton className="h-40 rounded-card" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="YouTube uploads" description={DESCRIPTION} />

      {youtube.error ? (
        <SurfaceBox><ErrorState title="YouTube uploads could not load" description={youtube.error} onRetry={() => { void youtube.reload(); }} /></SurfaceBox>
      ) : !youtube.configured ? (
        <Alert variant="warning">
          <AlertCircle />
          <AlertDescription>
            YouTube publishing is not set up on this server. The owner needs to add a Google OAuth client and <code>TOKEN_ENCRYPTION_KEY</code>.{' '}
            <a href={docsUrl('/self-host/youtube-publishing')} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">How to set it up<span className="sr-only"> (opens in a new tab)</span></a>
          </AlertDescription>
        </Alert>
      ) : active.length === 0 ? (
        <SurfaceBox>
          <EmptyState
            icon={<ShieldCheck />}
            title={youtube.connections.length > 0 ? 'Your channel needs a new sign-in' : 'Verify a YouTube channel first'}
            description="On the Accounts page, choose Verify on the channel's card and sign in with the Google account that manages it. Twiligent can then upload to it, never change or delete videos already there."
            action={<Button render={<Link to="/accounts#youtube" />}>Go to Accounts</Button>}
          />
        </SurfaceBox>
      ) : (
        <>
          {cloudinary.error && (
            <Alert variant="warning">
              <AlertCircle />
              <AlertDescription>Uploads can't start: the upload settings did not load. {cloudinary.error}</AlertDescription>
              <AlertAction><Button size="xs" variant="outline" onClick={cloudinary.retry} disabled={cloudinary.loading}>{cloudinary.loading ? 'Trying again' : 'Try again'}</Button></AlertAction>
            </Alert>
          )}
          <YouTubeComposer connections={youtube.connections} cloudConfig={cloudinary.config} cloudLoading={cloudinary.loading} onQueue={youtube.queue} showError={message => showToast(message, 'error')} />
        </>
      )}

      {!youtube.error && youtube.configured && (
        <YouTubeUploadList uploads={youtube.uploads} busyId={youtube.busyId} onCancel={youtube.cancel} onRetry={youtube.retry} />
      )}
    </div>
  );
}
