import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Copy, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import SurfaceBox from '@/components/SurfaceBox';
import RowAction from '@/components/RowAction';
import SearchField from '@/components/SearchField';
import FilterChips from '@/components/FilterChips';
import ActiveFilters from '@/components/ActiveFilters';
import NoResults from '@/components/NoResults';
import Pager from '@/components/Pager';
import { EmptyState } from '@/components/StateViews';
import { pageSlice, resultCountLabel } from '@/lib/library';
import { useLibraryParams } from '@/features/analytics/useLibraryParams';
import { matchModeLabel, ruleScopeLabel } from './automationData.ts';
import {
  RULES_PER_PAGE, RULE_APPLIES_FILTERS, RULE_APPLIES_LABELS, RULE_FILTERS_FROM, RULE_STATE_FILTERS, RULE_STATE_LABELS,
  filterRules, readRuleFilters, ruleFilterCounts,
} from './ruleList.ts';
import type { AutomationAccountState, AutomationRule } from '@shared/types/automation.ts';
import type { AutomationsState } from './useAutomations';

interface AutomationRulesProps {
  rules: AutomationRule[];
  accounts: AutomationAccountState[];
  automations: AutomationsState;
  newRulePath: string;
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
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Keywords and replies of ${rule.name}`}>
          {rule.matchMode === 'any'
            ? <Badge variant="warning">Any comment</Badge>
            : rule.keywords.map(keyword => <Badge key={keyword} variant="secondary">{keyword}</Badge>)}
          {rule.privateReplyEnabled && <Badge variant="info">Private reply</Badge>}
          {rule.publicReplyEnabled && <Badge variant="info">Public reply</Badge>}
          {rule.requireFollow && <Badge variant="info">Link after reply, followers only, testing</Badge>}
          {!rule.requireFollow && rule.linkAfterReply && <Badge variant="info">Link after reply, testing</Badge>}
          {rule.replyVariants.length > 0 && <Badge variant="secondary">{rule.replyVariants.length + 1} wordings</Badge>}
        </div>
        <p className="text-small text-ink-muted">
          {matchModeLabel(rule)} &middot; {ruleScopeLabel(rule)}{rule.hourlyLimit ? ` · at most ${rule.hourlyLimit} an hour` : ''}
        </p>
        {rule.privateReplyEnabled && <p className="line-clamp-2 max-w-2xl text-small text-ink">{rule.replyText}{rule.linkUrl ? ` ${rule.linkUrl}` : ''}</p>}
        {rule.publicReplyEnabled && (
          <p className="line-clamp-2 max-w-2xl text-small text-ink-muted">
            In public: {rule.publicReplyTexts[0]}{rule.publicReplyTexts.length > 1 ? ` (and ${rule.publicReplyTexts.length - 1} more wording${rule.publicReplyTexts.length > 2 ? 's' : ''})` : ''}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <div className="mr-2 flex items-center gap-2 text-small text-ink-muted">
          <span aria-hidden="true">{rule.enabled ? 'On' : 'Off'}</span>
          <Switch
            id={switchId}
            aria-label={`Rule ${rule.name}`}
            checked={rule.enabled}
            disabled={busy}
            onCheckedChange={checked => automations.setRuleEnabled(rule, checked)}
          />
        </div>
        <RowAction label={`Edit ${rule.name}`} onClick={() => onEdit(rule)} disabled={busy}><Pencil /></RowAction>
        <RowAction label={`Copy ${rule.name}`} onClick={() => automations.duplicateRule(rule)} disabled={busy}><Copy /></RowAction>
        <span className="ml-2 border-l border-divider pl-2">
          <RowAction label={`Delete ${rule.name}`} onClick={() => onDelete(rule)} disabled={busy} danger><Trash2 /></RowAction>
        </span>
      </div>
    </li>
  );
}

const RESULTS_ID = 'automation-rules';
const DEFAULTS = { q: '', state: 'all', applies: 'all' };

export default function AutomationRules({ rules, accounts, automations, newRulePath, onEdit, onDelete }: AutomationRulesProps) {
  const username = (accountId: string) => accounts.find(account => account.accountId === accountId)?.username ?? 'removed account';
  const { values, page, update, clear, setPage } = useLibraryParams(DEFAULTS);
  const { q, state, applies } = values;
  const filters = useMemo(() => readRuleFilters({ q, state, applies }), [q, state, applies]);
  const showFilters = rules.length >= RULE_FILTERS_FROM;
  const shownRules = useMemo(() => (showFilters ? filterRules(rules, filters) : rules), [rules, filters, showFilters]);
  const counts = useMemo(() => ruleFilterCounts(rules, filters), [rules, filters]);
  const paged = pageSlice(shownRules, page, RULES_PER_PAGE);

  const clearFilters = () => clear(['q', 'state', 'applies']);
  const activeFilters = [
    filters.query.trim() && { key: 'q', label: `"${filters.query.trim()}"`, onRemove: () => update({ q: '' }) },
    filters.state !== 'all' && { key: 'state', label: RULE_STATE_LABELS[filters.state], onRemove: () => update({ state: 'all' }) },
    filters.applies !== 'all' && { key: 'applies', label: RULE_APPLIES_LABELS[filters.applies], onRemove: () => update({ applies: 'all' }) },
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

  return (
    <SurfaceBox
      title="Rules"
      subheader="A comment is answered by the first rule that matches it, in private, in public or both. Rules for chosen posts are checked before rules for every post."
    >
      {showFilters && (
        <div className="mb-4 flex flex-col gap-3">
          <SearchField
            value={values.q}
            onChange={value => update({ q: value }, { replace: true })}
            placeholder="Search rules, keywords or replies"
            aria-label="Search rules"
            className="w-full sm:max-w-md"
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <FilterChips
              label="Rule status"
              options={RULE_STATE_FILTERS.map(option => ({ value: option, label: RULE_STATE_LABELS[option], count: counts.state[option] }))}
              value={filters.state}
              onChange={value => update({ state: value })}
            />
            <FilterChips
              label="Posts the rule answers"
              options={RULE_APPLIES_FILTERS.map(option => ({ value: option, label: RULE_APPLIES_LABELS[option], count: counts.applies[option] }))}
              value={filters.applies}
              onChange={value => update({ applies: value })}
            />
          </div>
          <ActiveFilters countLabel={resultCountLabel(shownRules.length, rules.length, 'rules')} filters={activeFilters} onClearAll={clearFilters} />
        </div>
      )}
      {rules.length === 0 ? (
        <EmptyState
          compact
          icon={<ListChecks />}
          title="No rules yet"
          description="Create a rule with a keyword, such as GUIDE, and how to answer anyone who comments it: a private reply, a public reply or both."
          action={<Button render={<Link to={newRulePath} />}><Plus data-icon="inline-start" />New rule</Button>}
        />
      ) : shownRules.length === 0 ? (
        <NoResults noun="rules" query={filters.query} onClear={clearFilters} />
      ) : (
        <div className="flex flex-col gap-4">
          <ul id={RESULTS_ID} tabIndex={-1} aria-label="Rules" className="flex flex-col divide-y divide-divider outline-none">
            {paged.items.map(rule => (
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
          {paged.pageCount > 1 && (
            <Pager
              page={paged.page}
              pageCount={paged.pageCount}
              onPageChange={setPage}
              total={shownRules.length}
              shown={paged.items.length}
              pageSize={RULES_PER_PAGE}
              noun="rules"
              resultsId={RESULTS_ID}
            />
          )}
        </div>
      )}
    </SurfaceBox>
  );
}
