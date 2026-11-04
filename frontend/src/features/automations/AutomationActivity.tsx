import { useState } from 'react';
import { AlertCircle, History, MessageCircle, RefreshCw, RotateCcw, Send } from 'lucide-react';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ConfirmDialog from '@/components/ConfirmDialog';
import FilterChips from '@/components/FilterChips';
import LiveStatus from '@/components/LiveStatus';
import RelativeTime from '@/components/RelativeTime';
import RowAction from '@/components/RowAction';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { fmtDateTime } from '../../utils/formatters';
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

// past this length a comment is clamped, with a button to read the rest
const LONG_COMMENT_CHARS = 160;

// the comment in full for screen readers, clamped on screen until the person asks for the rest
function CommentText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > LONG_COMMENT_CHARS;
  return (
    <div className="flex flex-col items-start gap-0.5">
      <p className={cn('text-sm break-words whitespace-pre-wrap text-ink', long && !expanded && 'line-clamp-3')}>{text}</p>
      {long && (
        <Button type="button" variant="link" size="sm" className="h-auto py-0.5 text-small" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show less' : 'Show the whole comment'}
        </Button>
      )}
    </div>
  );
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
  const waitingUntil = item.nextAttemptAt && ['queued', 'retry_wait'].includes(item.status) ? `Next try ${fmtDateTime(item.nextAttemptAt)}` : null;
  const privateOff = item.status === 'skipped' && item.statusReason === 'private_reply_off';
  const privateDetail = privateOff
    ? 'This rule does not send a private reply.'
    : gateDetail(item) ?? item.errorMessage ?? waitingUntil ?? (item.acceptedAt ? `Accepted ${fmtDateTime(item.acceptedAt)}` : '-');
  const publicReply = item.publicReply;
  const publicWaiting = publicReply?.nextAttemptAt && ['queued', 'retry_wait'].includes(publicReply.status) ? `Next try ${fmtDateTime(publicReply.nextAttemptAt)}` : null;
  const publicDetail = publicReply
    ? publicReply.errorMessage ?? publicWaiting ?? (publicReply.acceptedAt ? `Posted ${fmtDateTime(publicReply.acceptedAt)}: ${publicReply.text}` : publicReply.text)
    : '';
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-small text-ink-muted"><RelativeTime date={item.createdAt} /></TableCell>
      <TableCell className="whitespace-nowrap text-small">@{username}</TableCell>
      <TableCell className="min-w-56 max-w-sm whitespace-normal">
        {item.text ? <CommentText text={item.text} /> : <p className="text-sm text-ink-faint">Not kept for comments no rule answered</p>}
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
              label={needsReview(item) ? 'Send the private reply again after checking Instagram' : 'Try the private reply again'}
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

// a private reply Instagram did not confirm may have arrived, so sending it again is the person's decision
function needsReview(item: AutomationActivityItem): boolean {
  return item.status === 'needs_review' || item.followup?.status === 'needs_review';
}

export default function AutomationActivity({ activity, accounts, rules }: AutomationActivityProps) {
  const { filters, setFilter, items } = activity;
  const [pendingResend, setPendingResend] = useState<AutomationActivityItem | null>(null);
  const handleRetry = (item: AutomationActivityItem) => {
    if (needsReview(item)) setPendingResend(item);
    else activity.retry(item);
  };
  const count = `${items.length} ${items.length === 1 ? 'comment' : 'comments'} shown${activity.nextBefore ? ', older ones available' : ''}`;
  const status = activity.loading ? 'Loading activity' : activity.error ? '' : count;
  const username = (accountId: string) => accounts.find(account => account.accountId === accountId)?.username ?? 'removed account';
  const ruleName = (ruleId: string | null) => rules.find(rule => rule.id === ruleId)?.name ?? null;
  const accountItems = [{ value: ALL, label: 'All accounts' }, ...accounts.map(account => ({ value: account.accountId, label: `@${account.username}` }))];
  const ruleItems = [{ value: ALL, label: 'All rules' }, ...rules.map(rule => ({ value: rule.id, label: rule.name }))];
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-section font-semibold text-ink">Activity</h2>
          <p className="max-w-prose text-small text-ink-muted">Every comment received on an account with an active rule, and what happened to its private and public replies. The status filter follows the private reply.</p>
        </div>
        <Button size="sm" variant="outline" onClick={activity.load} disabled={activity.loading}>
          <RefreshCw data-icon="inline-start" className={cn(activity.loading && 'animate-spin')} />
          {activity.loading ? 'Refreshing' : 'Refresh'}
        </Button>
      </div>
      <LiveStatus message={status} />
      {activity.error && items.length > 0 && (
        <Alert variant="destructive" role="alert">
          <AlertCircle />
          <AlertDescription><span className="sr-only">Error: </span>{activity.error} The list below is from the last successful load.</AlertDescription>
          <AlertAction><Button size="sm" variant="outline" onClick={activity.load}>Try again</Button></AlertAction>
        </Alert>
      )}
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
        <Table aria-label="Reply activity" aria-busy={activity.loading || undefined}>
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
                onRetry={handleRetry}
                onRetryPublic={activity.retryPublic}
              />
            ))}
            {items.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6}>
                  {activity.loading
                    ? <div className="flex items-center justify-center gap-2 py-8 text-small text-ink-muted"><Spinner className="size-5" />Loading activity</div>
                    : activity.error
                      ? <ErrorState title="The reply activity could not load" description={activity.error} onRetry={activity.load} />
                      : <EmptyState compact icon={<History />} title="No activity for these filters" description="Comments appear here as Instagram sends them. Choose All, a longer period or all accounts to see more." />}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </SurfaceBox>
      {activity.nextBefore && (
        <Button variant="outline" size="sm" className="self-center" onClick={activity.loadMore} disabled={activity.loadingMore}>
          {activity.loadingMore && <Spinner className="size-4" />}
          {activity.loadingMore ? 'Loading older activity' : 'Show older activity'}
        </Button>
      )}
      <ConfirmDialog
        open={Boolean(pendingResend)}
        onOpenChange={open => { if (!open) setPendingResend(null); }}
        icon={<Send />}
        title="Send the private reply again?"
        description={`Instagram did not confirm the first one, so it may have arrived. If it did, @${pendingResend?.fromUsername ?? 'this person'} gets the message twice. Check the conversation in Instagram first.`}
        cancelLabel="Do not send"
        confirmLabel="Send again"
        onConfirm={() => {
          if (pendingResend) activity.retry(pendingResend);
          setPendingResend(null);
        }}
      />
    </section>
  );
}
