import PageHeader from '@/components/PageHeader';
import RefreshButton from '@/components/RefreshButton';
import DataFreshness from '@/components/DataFreshness';
import LiveStatus from '@/components/LiveStatus';
import { greetingTitle } from './greeting.ts';
import { overviewDescription } from './overviewLabels.ts';
import type { OverviewAccountFields } from './overviewStats.ts';

export interface OverviewHeaderProps {
  accounts: OverviewAccountFields[];
  email: string | null | undefined;
  isSyncing: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  fetchedAt: string | null;
}

export default function OverviewHeader({ accounts, email, isSyncing, refreshing, onRefresh, fetchedAt }: OverviewHeaderProps) {
  return (
    <PageHeader
      size="display"
      title={greetingTitle(email)}
      description={
        <span className="flex flex-col gap-1">
          <span>{overviewDescription(accounts)}</span>
          {fetchedAt && <DataFreshness fetchedAt={fetchedAt} qualifier="oldest account" />}
          <LiveStatus message={isSyncing ? 'Loading analytics for new accounts' : ''} visible={isSyncing} className="text-small text-ink-muted" />
        </span>
      }
      actions={
        <RefreshButton refreshing={refreshing} onRefresh={onRefresh} disabled={accounts.length === 0} target="all accounts" />
      }
    />
  );
}
