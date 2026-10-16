import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquareReply, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/StateViews';
import { useAppContext } from '../../context/AppContext';
import AutomationAccounts from './AutomationAccounts';
import AutomationActivity from './AutomationActivity';
import AutomationMetrics from './AutomationMetrics';
import AutomationNotices from './AutomationNotices';
import AutomationRules from './AutomationRules';
import RuleDialog from './RuleDialog';
import { useAutomationActivity } from './useAutomationActivity';
import { useAutomations } from './useAutomations';
import { useRuleForm } from './useRuleForm';
import type { AutomationRule } from '@shared/types/automation.ts';

export default function Automations() {
  const { accounts } = useAppContext();
  const igAccounts = useMemo(() => accounts.filter(account => account.platform === 'instagram'), [accounts]);
  const automations = useAutomations();
  const activity = useAutomationActivity();
  const rule = useRuleForm({ saveRule: automations.saveRule });
  const [pendingDelete, setPendingDelete] = useState<AutomationRule | null>(null);
  const { overview } = automations;

  const header = (
    <PageHeader
      title="Automations"
      description="Answer comments on your posts and reels with a private reply, a public reply under the comment, or both."
      actions={overview && overview.accounts.length > 0 && (
        <Button onClick={() => rule.openNew(overview.accounts[0].accountId)}><Plus data-icon="inline-start" />New rule</Button>
      )}
    />
  );

  if (!overview && !automations.loadError) return <PageSkeleton metrics={3} />;

  if (!overview) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <ErrorState title="Automations could not load" description={automations.loadError} onRetry={automations.load} />
      </div>
    );
  }

  if (overview.accounts.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <EmptyState
          icon={<MessageSquareReply />}
          title="Connect an Instagram account first"
          description="Automations reply from an Instagram professional account connected with Instagram sign-in."
          action={<Button render={<Link to="/accounts?add=1" />}>Connect Instagram</Button>}
        />
      </div>
    );
  }

  async function confirmDelete() {
    if (pendingDelete && await automations.deleteRule(pendingDelete)) setPendingDelete(null);
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
        onNew={() => rule.openNew(overview.accounts[0].accountId)}
        onEdit={rule.openEdit}
        onDelete={setPendingDelete}
      />
      <AutomationActivity activity={activity} accounts={overview.accounts} rules={overview.rules} />
      <RuleDialog rule={rule} igAccounts={igAccounts} />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={open => !open && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name ?? 'this rule'}?`}
        description="Comments stop getting this reply. Replies already sent stay sent, and the rule's past activity stays in the list."
        confirmLabel="Delete rule"
        busy={automations.busyId === pendingDelete?.id}
        hold
        onConfirm={confirmDelete}
      />
    </div>
  );
}
