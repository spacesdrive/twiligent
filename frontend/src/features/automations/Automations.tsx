import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquareReply, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/StateViews';
import { useAppContext } from '../../context/AppContext';
import AutomationAccounts from './AutomationAccounts';
import AutomationActivity from './AutomationActivity';
import AutomationMetrics from './AutomationMetrics';
import AutomationNotices from './AutomationNotices';
import AutomationRules from './AutomationRules';
import { useAutomationActivity } from './useAutomationActivity';
import { useAutomations } from './useAutomations';
import type { AutomationRule } from '@shared/types/automation.ts';

export default function Automations() {
  const navigate = useNavigate();
  const { accounts } = useAppContext();
  const igAccounts = useMemo(() => accounts.filter(account => account.platform === 'instagram'), [accounts]);
  const automations = useAutomations();
  const activity = useAutomationActivity();
  const { overview } = automations;
  const newRulePath = overview?.accounts[0] ? `/automations/rules/new?account=${encodeURIComponent(overview.accounts[0].accountId)}` : '/automations/rules/new';
  const openEdit = (rule: AutomationRule) => navigate(`/automations/rules/${encodeURIComponent(rule.id)}`);

  // the empty rules list carries its own New rule button, so the header does not repeat it
  const hasRules = Boolean(overview && overview.rules.length > 0);
  const header = (
    <PageHeader
      title="Automations"
      description="Answer comments on your posts and reels with a private reply, a public reply under the comment, or both."
      actions={hasRules && (
        <Button render={<Link to={newRulePath} />}><Plus data-icon="inline-start" />New rule</Button>
      )}
    />
  );

  if (!overview && !automations.loadError) return <PageSkeleton metrics={3} />;

  if (!overview) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <SurfaceBox>
          <ErrorState title="Automations could not load" description={automations.loadError} onRetry={automations.load} />
        </SurfaceBox>
      </div>
    );
  }

  if (overview.accounts.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <SurfaceBox>
          <EmptyState
            icon={<MessageSquareReply />}
            title="Connect an Instagram account first"
            description="Automations reply from an Instagram professional account connected with Instagram sign-in."
            action={<Button render={<Link to="/accounts?add=1" />}>Add account</Button>}
          />
        </SurfaceBox>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}
      <AutomationNotices settings={overview.settings} />
      <AutomationMetrics summary={activity.summary} loading={activity.loading && !activity.summary} />
      <AutomationAccounts accounts={overview.accounts} rules={overview.rules} appAccounts={igAccounts} automations={automations} />
      <AutomationRules
        rules={overview.rules}
        accounts={overview.accounts}
        automations={automations}
        newRulePath={newRulePath}
        onEdit={openEdit}
        onDelete={automations.deleteRule}
      />
      <AutomationActivity activity={activity} accounts={overview.accounts} rules={overview.rules} />
    </div>
  );
}
