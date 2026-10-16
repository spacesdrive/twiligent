import { History, MessageCircle, RefreshCw, RotateCcw, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import FilterChips from '@/components/FilterChips';
import RowAction from '@/components/RowAction';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState } from '@/components/StateViews';
import type { ReactNode } from 'react';
import { fmtDate, timeAgo } from '../../utils/formatters';
import { ACTIVITY_FILTERS, STATS_PERIODS, canRetry, canRetryPublic, gateDetail, publicStatusDisplay, statusDisplay } from './automationData.ts';
import type { ActivityFilter, StatsPeriod, StatusDisplay } from './automationData.ts';
import type { AutomationAccountState, AutomationActivityItem, AutomationRule } from '@shared/types/automation.ts';
import type { AutomationActivityState, RetryAction } from './useAutomationActivity';

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
  // which of the item's replies is being retried, if any
  retrying: RetryAction | null;
  onRetry: (item: AutomationActivityItem) => void;
  onRetryPublic: (item: AutomationActivityItem) => void;
}

interface ReplyLineProps {
  icon: ReactNode;
  label: string;
  status: StatusDisplay;
  detail: string;
}

// one of a comment's replies: which one, where it stands and why
function ReplyLine({ icon, label, status, detail }: ReplyLineProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1 text-caption text-ink-faint [&_svg]:size-3.5">{icon}{label}</span>
        <Badge variant={status.tone}>{status.label}</Badge>
      </div>
      <p className="text-small text-ink-muted">{detail}</p>
    </div>
  );
}

const ALL = 'all';
const FILTER_OPTIONS = (Object.keys(ACTIVITY_FILTERS) as ActivityFilter[]).map(value => ({ value, label: ACTIVITY_FILTERS[value].label }));
const PERIOD_OPTIONS = (Object.keys(STATS_PERIODS) as StatsPeriod[]).map(value => ({ value, label: STATS_PERIODS[value].label }));

function ActivityRow({ item, now, ruleName, username, retrying, onRetry, onRetryPublic }: ActivityRowProps) {
  const waitingUntil = item.nextAttemptAt && ['queued', 'retry_wait'].includes(item.status) ? `Next try ${fmtDate(item.nextAttemptAt)}` : null;
  const privateOff = item.status === 'skipped' && item.statusReason === 'private_reply_off';
  const privateDetail = privateOff
    ? 'This rule does not send a private reply.'
    : gateDetail(item) ?? item.errorMessage ?? waitingUntil ?? (item.acceptedAt ? `Accepted ${fmtDate(item.acceptedAt)}` : '-');
  const publicReply = item.publicReply;
  const publicWaiting = publicReply?.nextAttemptAt && ['queued', 'retry_wait'].includes(publicReply.status) ? `Next try ${fmtDate(publicReply.nextAttemptAt)}` : null;
  const publicDetail = publicReply
    ? publicReply.errorMessage ?? publicWaiting ?? (publicReply.acceptedAt ? `Posted ${fmtDate(publicReply.acceptedAt)}: ${publicReply.text}` : publicReply.text)
    : '';
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-small text-ink-muted" title={fmtDate(item.createdAt)}>{timeAgo(item.createdAt)}</TableCell>
      <TableCell className="whitespace-nowrap text-small">@{username}</TableCell>
      <TableCell className="min-w-56 max-w-sm whitespace-normal">
        <p className="truncate text-sm text-ink">{item.text ?? <span className="text-ink-faint">Not kept for comments no rule answered</span>}</p>
        {item.fromUsername && <p className="text-caption text-ink-faint">@{item.fromUsername}</p>}
      </TableCell>
      <TableCell className="whitespace-nowrap text-small text-ink-muted">{ruleName ?? '-'}</TableCell>
      <TableCell className="min-w-72 max-w-md whitespace-normal">
        <div className="flex flex-col gap-2.5">
          {item.status === 'ignored' && <Badge variant="secondary" className="self-start">{statusDisplay(item).label}</Badge>}
          {item.status !== 'ignored' && (!privateOff || !publicReply) && <ReplyLine icon={<Send />} label="Private reply" status={statusDisplay(item)} detail={privateDetail} />}
          {publicReply && <ReplyLine icon={<MessageCircle />} label="Public reply" status={publicStatusDisplay(publicReply)} detail={publicDetail} />}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {canRetry(item, now) && (
            <RowAction
              label={item.status === 'needs_review' || item.followup?.status === 'needs_review' ? 'Send the private reply again after checking Instagram' : 'Try the private reply again'}
              onClick={() => onRetry(item)}
              disabled={retrying !== null}
            >
              {retrying === 'private' ? <Spinner /> : <RotateCcw />}
            </RowAction>
          )}
          {canRetryPublic(item, now) && (
            <RowAction
              label={publicReply?.status === 'needs_review' ? 'Post the public reply again after checking the comment' : 'Try the public reply again'}
              onClick={() => onRetryPublic(item)}
              disabled={retrying !== null}
            >
              {retrying === 'public' ? <Spinner /> : <MessageCircle />}
            </RowAction>
          )}
        </div>
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
          <p className="text-small text-ink-muted">Every comment received on an account with an active rule, and what happened to its private and public replies. The status filter follows the private reply.</p>
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
              <TableHead>Replies</TableHead>
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
                retrying={activity.retrying?.id === item.id ? activity.retrying.action : null}
                onRetry={activity.retry}
                onRetryPublic={activity.retryPublic}
              />
            ))}
            {items.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6}>
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
