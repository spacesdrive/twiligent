import React from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import { accountName, groupByPlatform, platformSummary } from '@/lib/accounts';
import { cn } from '@/lib/utils';
import { useAppContext } from '../../context/AppContext';
import { visibleSections } from './accountManagerData';
import { useAddAccount } from './useAddAccount';
import { useAccountRefresh } from './useAccountRefresh';
import { useAccountDelete } from './useAccountDelete';
import { useInstagramOAuthReturn } from './useInstagramOAuthReturn';
import AccountsEmptyState from './AccountsEmptyState';
import AccountSection from './AccountSection';
import AddAccountDialog from './AddAccountDialog';

export default function AccountManager() {
  const { accounts, showToast, loadAccounts } = useAppContext();
  const addFlow = useAddAccount({ showToast, loadAccounts });
  const { refreshingId, refreshOne, refreshAll } = useAccountRefresh({ showToast, loadAccounts });
  const { pendingDelete, setPendingDelete, deleting, handleDelete } = useAccountDelete({ showToast, loadAccounts });
  useInstagramOAuthReturn({ showToast, loadAccounts, setDialogOpen: addFlow.setDialogOpen });

  const groups = groupByPlatform(accounts);
  const sections = visibleSections(groups);
  const refreshingAll = refreshingId === 'all';

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
          />
        ))
      )}

      <AddAccountDialog flow={addFlow} />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={open => { if (!open) setPendingDelete(null); }}
        title={pendingDelete ? `Remove ${accountName(pendingDelete)}?` : 'Remove account?'}
        description="Its cached analytics are deleted. Scheduled posts for this account are removed with it. You can add the account again later."
        confirmLabel="Remove"
        onConfirm={handleDelete}
        busy={deleting}
        hold
      />
    </div>
  );
}
