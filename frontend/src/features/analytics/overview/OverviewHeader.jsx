import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import { greetingTitle } from './greeting.js';
import { overviewDescription } from './overviewLabels.js';

export default function OverviewHeader({ accounts, email, isSyncing, loading, onRefresh }) {
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
