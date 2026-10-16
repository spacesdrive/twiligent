import { Copy, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import SurfaceBox from '@/components/SurfaceBox';
import RowAction from '@/components/RowAction';
import { EmptyState } from '@/components/StateViews';
import { matchModeLabel, ruleScopeLabel } from './automationData.ts';
import type { AutomationAccountState, AutomationRule } from '@shared/types/automation.ts';
import type { AutomationsState } from './useAutomations';

interface AutomationRulesProps {
  rules: AutomationRule[];
  accounts: AutomationAccountState[];
  automations: AutomationsState;
  onNew: () => void;
  onEdit: (rule: AutomationRule) => void;
  onDelete: (rule: AutomationRule) => void;
}

interface RuleRowProps {
  rule: AutomationRule;
  username: string;
  busy: boolean;
  automations: AutomationsState;
  onEdit: (rule: AutomationRule) => void;
  onDelete: (rule: AutomationRule) => void;
}

function RuleRow({ rule, username, busy, automations, onEdit, onDelete }: RuleRowProps) {
  const switchId = `rule-${rule.id}`;
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">{rule.name}</span>
          <span className="text-caption text-ink-faint">@{username}</span>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Keywords">
          {rule.matchMode === 'any'
            ? <Badge variant="warning">Any comment</Badge>
            : rule.keywords.map(keyword => <Badge key={keyword} variant="secondary">{keyword}</Badge>)}
          {rule.requireFollow && <Badge variant="info">Followers only</Badge>}
        </div>
        <p className="text-small text-ink-muted">
          {matchModeLabel(rule)} &middot; {ruleScopeLabel(rule)}{rule.hourlyLimit ? ` · at most ${rule.hourlyLimit} an hour` : ''}
        </p>
        <p className="line-clamp-2 max-w-2xl text-small text-ink">{rule.replyText}{rule.linkUrl ? ` ${rule.linkUrl}` : ''}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <label htmlFor={switchId} className="mr-2 flex items-center gap-2 text-small text-ink-muted">
          {rule.enabled ? 'On' : 'Off'}
          <Switch id={switchId} checked={rule.enabled} disabled={busy} onCheckedChange={checked => automations.setRuleEnabled(rule, checked)} />
        </label>
        <RowAction label="Edit rule" onClick={() => onEdit(rule)} disabled={busy}><Pencil /></RowAction>
        <RowAction label="Copy rule" onClick={() => automations.duplicateRule(rule)} disabled={busy}><Copy /></RowAction>
        <RowAction label="Delete rule" onClick={() => onDelete(rule)} disabled={busy} danger><Trash2 /></RowAction>
      </div>
    </li>
  );
}

export default function AutomationRules({ rules, accounts, automations, onNew, onEdit, onDelete }: AutomationRulesProps) {
  const username = (accountId: string) => accounts.find(account => account.accountId === accountId)?.username ?? 'removed account';
  return (
    <SurfaceBox
      title="Rules"
      subheader="A comment gets one private reply, from the first rule that matches it. Rules for chosen posts are checked before rules for every post."
    >
      {rules.length === 0 ? (
        <EmptyState
          compact
          icon={<ListChecks />}
          title="No rules yet"
          description="Create a rule with a keyword, such as GUIDE, and the reply to send to anyone who comments it."
          action={<Button size="sm" onClick={onNew}><Plus data-icon="inline-start" />New rule</Button>}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-divider">
          {rules.map(rule => (
            <RuleRow
              key={rule.id}
              rule={rule}
              username={username(rule.accountId)}
              busy={automations.busyId === rule.id}
              automations={automations}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </SurfaceBox>
  );
}
