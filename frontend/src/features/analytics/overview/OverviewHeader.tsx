import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import { greetingTitle } from './greeting.ts';
import { overviewDescription } from './overviewLabels.ts';
import type { OverviewAccountFields } from './overviewStats.ts';

export interface OverviewHeaderProps {
  accounts: OverviewAccountFields[];
  email: string | null | undefined;
  isSyncing: boolean;
  loading: boolean;
  onRefresh: () => void;
}

export default function OverviewHeader({ accounts, email, isSyncing, loading, onRefresh }: OverviewHeaderProps) {
  return (
    <PageHeader
      size="display"
      title={greetingTitle(email)}
      description={overviewDescription(accounts)}
      actions={
        <>
          {isSyncing && (
            <span className="flex items-center gap-1.5 text-small text-ink-muted" role="status">
              <RefreshCw className="size-3.5 animate-spin" />
              Syncing analytics
            </span>
          )}
          <Button onClick={onRefresh} disabled={loading || accounts.length === 0} variant="outline">
            <RefreshCw data-icon="inline-start" className={cn(loading && 'animate-spin')} />
            {loading ? 'Refreshing' : 'Refresh all'}
          </Button>
        </>
      }
    />
  );
}
