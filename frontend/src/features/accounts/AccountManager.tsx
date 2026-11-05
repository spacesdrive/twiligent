import React, { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import { accountName, groupByPlatform, platformSummary } from '@/lib/accounts';
import { docsUrl } from '@/lib/docs';
import { cn } from '@/lib/utils';
import { useAppContext } from '../../context/AppContext';
import { visibleSections } from './accountManagerData';
import { useAddAccount } from './useAddAccount';
import { useAccountRefresh } from './useAccountRefresh';
import { useAccountDelete } from './useAccountDelete';
import { useInstagramOAuthReturn } from './useInstagramOAuthReturn';
import { useYouTubeConnections } from './useYouTubeConnections';
import { cardPublishing } from './youtubePublishingState';
import AccountsEmptyState from './AccountsEmptyState';
import AccountSection from './AccountSection';
import AddAccountDialog from './AddAccountDialog';
import YouTubePublishingRow from './YouTubePublishingRow';
import type { AppAccount } from '../../utils/formatters';
import type { YouTubeConnectionSummary } from '@shared/types/youtubePublishing.ts';

const REMOVE_DESCRIPTION = 'Its cached analytics are deleted. Scheduled posts for this account are removed with it. You can add the account again later.';

export default function AccountManager() {
  const { accounts, showToast, loadAccounts } = useAppContext();
  const addFlow = useAddAccount({ showToast, loadAccounts });
  const { refreshingId, refreshOne, refreshAll } = useAccountRefresh({ showToast, loadAccounts });
  const { pendingDelete, setPendingDelete, deleting, handleDelete } = useAccountDelete({ showToast, loadAccounts });
  useInstagramOAuthReturn({ showToast, loadAccounts, setDialogOpen: addFlow.setDialogOpen });
  const youtube = useYouTubeConnections(showToast);
  const [pendingTurnOff, setPendingTurnOff] = useState<YouTubeConnectionSummary | null>(null);

  const groups = groupByPlatform(accounts);
  const sections = visibleSections(groups);
  const refreshingAll = refreshingId === 'all';
  const publishingStatus = { loading: youtube.loading, failed: youtube.error !== null, configured: youtube.configured, connections: youtube.connections };
  const publishingOf = (acct: AppAccount) => cardPublishing(acct, publishingStatus);
  const pendingPublishing = pendingDelete ? publishingOf(pendingDelete).kind : 'hidden';
  const deletingVerified = pendingPublishing === 'verified' || pendingPublishing === 'needs_sign_in';

  const youtubeNotice = youtube.error ? (
    <Alert variant="destructive" role="alert">
      <AlertDescription>Couldn't load which channels can publish. {youtube.error}</AlertDescription>
      <AlertAction><Button size="xs" variant="outline" onClick={() => { void youtube.reload(); }}>Try again</Button></AlertAction>
    </Alert>
  ) : !youtube.loading && !youtube.configured ? (
    <p className="max-w-prose text-sm text-ink-muted">
      Publishing to YouTube is not set up on this server, so channels can't be verified yet. Analytics work without it.{' '}
      <a href={docsUrl('/self-host/youtube-publishing')} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-text underline underline-offset-4">
        How to set it up<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </p>
  ) : null;

  const youtubeExtra = (acct: AppAccount) => {
    const publishing = publishingOf(acct);
    return (
      <YouTubePublishingRow
        publishing={publishing}
        channelName={accountName(acct)}
        verifying={youtube.verifyingId === acct.id}
        onVerify={() => { void youtube.verify(acct.id); }}
        onTurnOff={() => { if (publishing.kind === 'verified') setPendingTurnOff(publishing.connection); }}
      />
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Accounts"
        description={accounts.length > 0 ? platformSummary(accounts) : 'No accounts added yet'}
        actions={
          <>
            {accounts.length > 0 && (
              <Button variant="outline" onClick={refreshAll} disabled={refreshingAll}>
                <RefreshCw data-icon="inline-start" className={cn(refreshingAll && 'animate-spin')} />
                {refreshingAll ? 'Refreshing' : 'Refresh all'}
              </Button>
            )}
            <Button onClick={() => addFlow.setDialogOpen(true)}>
              <Plus data-icon="inline-start" />
              Add account
            </Button>
          </>
        }
      />

      {accounts.length === 0 ? (
        <AccountsEmptyState onChoose={addFlow.openWithPlatform} />
      ) : (
        sections.map(section => (
          <AccountSection
            key={section.key}
            section={section}
            accounts={groups[section.key]}
            refreshingId={refreshingId}
            onRefresh={refreshOne}
            onDelete={setPendingDelete}
            notice={section.key === 'youtube' ? youtubeNotice : undefined}
            extraFor={section.key === 'youtube' ? youtubeExtra : undefined}
          />
        ))
      )}

      <AddAccountDialog flow={addFlow} />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={open => { if (!open) setPendingDelete(null); }}
        title={pendingDelete ? `Remove ${accountName(pendingDelete)}?` : 'Remove account?'}
        description={deletingVerified
          ? `${REMOVE_DESCRIPTION} Its publishing is turned off too: Google is told to drop Twiligent's access, and its upload queue is removed. Videos already on YouTube stay there.`
          : REMOVE_DESCRIPTION}
        confirmLabel="Remove account"
        busyLabel="Removing"
        onConfirm={() => { void handleDelete().then(youtube.reload); }}
        busy={deleting}
        hold
      />

      <ConfirmDialog
        open={pendingTurnOff !== null}
        onOpenChange={open => { if (!open) setPendingTurnOff(null); }}
        title={`Turn off publishing for ${pendingTurnOff?.channelTitle || 'this channel'}?`}
        description="Google is told to drop Twiligent's access, and this channel's upload queue and history are removed. Videos already on YouTube stay there, and its analytics are not affected. You can verify it again later."
        confirmLabel="Turn off publishing"
        busyLabel="Turning off"
        busy={pendingTurnOff !== null && youtube.removingId === pendingTurnOff.id}
        onConfirm={() => {
          if (pendingTurnOff) void youtube.turnOff(pendingTurnOff).then(done => { if (done) setPendingTurnOff(null); });
        }}
        hold
      />
    </div>
  );
}
