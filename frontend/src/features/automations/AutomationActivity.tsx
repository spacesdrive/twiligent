import { History, RefreshCw, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import FilterChips from '@/components/FilterChips';
import RowAction from '@/components/RowAction';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState } from '@/components/StateViews';
import { fmtDate, timeAgo } from '../../utils/formatters';
import { ACTIVITY_FILTERS, STATS_PERIODS, canRetry, statusDisplay } from './automationData.ts';
import type { ActivityFilter, StatsPeriod } from './automationData.ts';
import type { AutomationAccountState, AutomationActivityItem, AutomationRule } from '@shared/types/automation.ts';
import type { AutomationActivityState } from './useAutomationActivity';

interface AutomationActivityProps {
  activity: AutomationActivityState;
  accounts: AutomationAccountState[];
  rules: AutomationRule[];
}

interface ActivityRowProps {
  item: AutomationActivityItem;
  now: number;
  ruleName: string | null;
  username: string;
  retrying: boolean;
  onRetry: (item: AutomationActivityItem) => void;
}

const ALL = 'all';
const FILTER_OPTIONS = (Object.keys(ACTIVITY_FILTERS) as ActivityFilter[]).map(value => ({ value, label: ACTIVITY_FILTERS[value].label }));
const PERIOD_OPTIONS = (Object.keys(STATS_PERIODS) as StatsPeriod[]).map(value => ({ value, label: STATS_PERIODS[value].label }));

function ActivityRow({ item, now, ruleName, username, retrying, onRetry }: ActivityRowProps) {
  const status = statusDisplay(item);
  const waitingUntil = item.nextAttemptAt && ['queued', 'retry_wait'].includes(item.status) ? `Next try ${fmtDate(item.nextAttemptAt)}` : null;
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-small text-ink-muted" title={fmtDate(item.createdAt)}>{timeAgo(item.createdAt)}</TableCell>
      <TableCell className="whitespace-nowrap text-small">@{username}</TableCell>
      <TableCell className="min-w-56 max-w-sm whitespace-normal">
        <p className="truncate text-sm text-ink">{item.text ?? <span className="text-ink-faint">Not kept for comments no rule answered</span>}</p>
        {item.fromUsername && <p className="text-caption text-ink-faint">@{item.fromUsername}</p>}
      </TableCell>
      <TableCell className="whitespace-nowrap text-small text-ink-muted">{ruleName ?? '-'}</TableCell>
      <TableCell><Badge variant={status.tone}>{status.label}</Badge></TableCell>
      <TableCell className="min-w-64 max-w-md whitespace-normal text-small text-ink-muted">
        {item.errorMessage ?? waitingUntil ?? (item.acceptedAt ? `Accepted ${fmtDate(item.acceptedAt)}` : '-')}
      </TableCell>
      <TableCell className="text-right">
        {canRetry(item, now) && (
          <RowAction label={item.status === 'needs_review' ? 'Send again after checking Instagram' : 'Try again'} onClick={() => onRetry(item)} disabled={retrying}>
            {retrying ? <Spinner /> : <RotateCcw />}
          </RowAction>
        )}
      </TableCell>
    </TableRow>
  );
}

export default function AutomationActivity({ activity, accounts, rules }: AutomationActivityProps) {
  const { filters, setFilter, items } = activity;
  const username = (accountId: string) => accounts.find(account => account.accountId === accountId)?.username ?? 'removed account';
  const ruleName = (ruleId: string | null) => rules.find(rule => rule.id === ruleId)?.name ?? null;
  const accountItems = [{ value: ALL, label: 'All accounts' }, ...accounts.map(account => ({ value: account.accountId, label: `@${account.username}` }))];
  const ruleItems = [{ value: ALL, label: 'All rules' }, ...rules.map(rule => ({ value: rule.id, label: rule.name }))];
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-section font-semibold text-ink">Activity</h2>
          <p className="text-small text-ink-muted">Every comment received on an account with an active rule, and what happened to its reply.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={activity.load}><RefreshCw data-icon="inline-start" />Refresh</Button>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips label="Status" options={FILTER_OPTIONS} value={filters.filter} onChange={value => setFilter('filter', value)} />
        <div className="flex flex-wrap gap-2">
          <Select value={filters.accountId || ALL} onValueChange={value => setFilter('accountId', !value || value === ALL ? '' : value)} items={accountItems}>
            <SelectTrigger size="sm" className="w-44" aria-label="Account"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {accountItems.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={filters.ruleId || ALL} onValueChange={value => setFilter('ruleId', !value || value === ALL ? '' : value)} items={ruleItems}>
            <SelectTrigger size="sm" className="w-44" aria-label="Rule"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {ruleItems.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={filters.period} onValueChange={value => value && setFilter('period', value as StatsPeriod)} items={PERIOD_OPTIONS}>
            <SelectTrigger size="sm" className="w-40" aria-label="Period"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {PERIOD_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
      <SurfaceBox content={false} className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead>Rule</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => (
              <ActivityRow
                key={item.id}
                item={item}
                now={activity.checkedAt}
                ruleName={ruleName(item.ruleId)}
                username={username(item.accountId)}
                retrying={activity.retryingId === item.id}
                onRetry={activity.retry}
              />
            ))}
            {items.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7}>
                  {activity.loading
                    ? <div className="flex justify-center py-8"><Spinner className="size-5" /></div>
                    : <EmptyState compact icon={<History />} title="No activity for these filters" description="Comments appear here as Instagram sends them." />}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </SurfaceBox>
      {activity.nextBefore && (
        <Button variant="outline" size="sm" className="self-center" onClick={activity.loadMore} disabled={activity.loadingMore}>
          {activity.loadingMore && <Spinner className="size-4" />}
          Show older activity
        </Button>
      )}
    </section>
  );
}
