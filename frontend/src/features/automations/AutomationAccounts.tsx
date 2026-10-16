import { Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import SurfaceBox from '@/components/SurfaceBox';
import { AccountAvatar } from '@/components/platform';
import { accountStatus } from './automationData.ts';
import type { AutomationAccountState } from '@shared/types/automation.ts';
import type { AppAccount } from '../../utils/formatters';
import type { AutomationsState } from './useAutomations';

interface AutomationAccountsProps {
  accounts: AutomationAccountState[];
  appAccounts: AppAccount[];
  automations: AutomationsState;
}

interface AccountRowProps {
  account: AutomationAccountState;
  appAccount: AppAccount | undefined;
  busy: boolean;
  automations: AutomationsState;
}

function AccountRow({ account, appAccount, busy, automations }: AccountRowProps) {
  const status = accountStatus(account, automations.checkedAt);
  const switchId = `pause-${account.accountId}`;
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {appAccount && <AccountAvatar account={appAccount} size="sm" />}
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink">@{account.username}</span>
            <Badge variant={status.tone}>{status.label}</Badge>
          </div>
          <p className="text-small text-ink-muted">{status.detail}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {!account.subscribedAt && (
          <Button size="sm" variant="outline" onClick={() => automations.subscribeAccount(account)} disabled={busy}>
            {busy ? <Spinner className="size-4" /> : <Radio data-icon="inline-start" />}
            Turn on comment events
          </Button>
        )}
        <label htmlFor={switchId} className="flex items-center gap-2 text-small text-ink-muted">
          Replies
          <Switch id={switchId} checked={!account.paused} disabled={busy} onCheckedChange={checked => automations.setAccountPaused(account, !checked)} />
        </label>
      </div>
    </li>
  );
}

export default function AutomationAccounts({ accounts, appAccounts, automations }: AutomationAccountsProps) {
  return (
    <SurfaceBox title="Instagram accounts" subheader="Pause an account to hold its replies. Comments keep arriving and wait for you to resume.">
      <ul className="flex flex-col divide-y divide-divider">
        {accounts.map(account => (
          <AccountRow
            key={account.accountId}
            account={account}
            appAccount={appAccounts.find(item => item.id === account.accountId)}
            busy={automations.busyId === account.accountId}
            automations={automations}
          />
        ))}
      </ul>
    </SurfaceBox>
  );
}
