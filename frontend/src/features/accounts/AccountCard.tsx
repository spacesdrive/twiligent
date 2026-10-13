import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Lock, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AccountAvatar } from '@/components/platform';
import { accountName, accountPath } from '@/lib/accounts';
import { cn } from '@/lib/utils';
import { fmtNum, timeAgo } from '../../utils/formatters';
import { accountCardHandle, accountMetrics } from './accountManagerData';

function CookieStatus({ hasCookie }) {
  if (hasCookie) {
    return <span className="flex items-center gap-1 text-success"><Lock className="size-3" />Session cookie stored</span>;
  }
  return <span className="flex items-center gap-1 text-danger"><Lock className="size-3" />Error: no session cookie. Remove and add the account again.</span>;
}

export default function AccountCard({ acct, platform, refreshing, onRefresh, onDelete }) {
  const metrics = accountMetrics(platform, acct);
  return (
    <article className="flex flex-col gap-4 rounded-card border border-line bg-surface-raised p-4">
      <div className="flex items-center gap-3">
        <AccountAvatar account={acct} size="lg" showPlatform />
        <div className="min-w-0 flex-1">
          <Link to={accountPath(acct)} className="block truncate text-sm font-semibold text-ink hover:underline">{accountName(acct)}</Link>
          <p className="truncate text-caption text-ink-faint">{accountCardHandle(acct, platform)}</p>
        </div>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" render={<Link to={accountPath(acct)} aria-label={`Open analytics for ${accountName(acct)}`} />} />}>
            <ArrowUpRight />
          </TooltipTrigger>
          <TooltipContent>Open analytics</TooltipContent>
        </Tooltip>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-divider rounded-control bg-surface-sunken/60 py-2.5">
        {metrics.map(([label, value]) => (
          <div key={label} className="flex flex-col items-center gap-0.5 px-2 text-center">
            <dt className="text-caption text-ink-faint">{label}</dt>
            <dd className="font-heading text-base font-semibold text-ink tabular-nums">{fmtNum(value)}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-faint">
        {platform === 'reddit' && <CookieStatus hasCookie={acct.hasCookie} />}
        {acct.lastUpdated && <span>Updated {timeAgo(acct.lastUpdated).toLowerCase()}</span>}
      </div>

      <div className="mt-auto flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw data-icon="inline-start" className={cn(refreshing && 'animate-spin')} />
          {refreshing ? 'Refreshing' : 'Refresh'}
        </Button>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label={`Remove ${accountName(acct)}`} className="text-ink-muted hover:bg-danger-soft hover:text-danger" />}>
            <Trash2 />
          </TooltipTrigger>
          <TooltipContent>Remove account</TooltipContent>
        </Tooltip>
      </div>
    </article>
  );
}
