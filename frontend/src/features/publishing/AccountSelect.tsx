import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AccountAvatar } from '@/components/platform';
import type { AppAccount } from '../../utils/formatters';

interface AccountSelectProps {
  accounts: AppAccount[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function AccountSelect({ accounts, value, onChange, disabled }: AccountSelectProps) {
  const selected = accounts.find(account => account.id === value);
  return (
    <Select value={value} onValueChange={onChange as (value: string | null) => void} disabled={disabled}>
      <SelectTrigger className="h-(--control-h-lg) w-full" aria-label="Instagram account">
        {selected ? (
          <span className="flex min-w-0 items-center gap-2">
            <AccountAvatar account={selected} size="xs" />
            <span className="truncate text-sm">{selected.title || selected.username}</span>
            {selected.username && <span className="shrink-0 text-caption text-ink-faint">@{selected.username}</span>}
          </span>
        ) : (
          <SelectValue placeholder="Choose an account" />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {accounts.map(account => (
            <SelectItem key={account.id} value={account.id}>
              <span className="flex items-center gap-2">
                <AccountAvatar account={account} size="xs" />
                <span className="truncate text-sm font-medium">{account.title || account.username}</span>
                {account.username && <span className="shrink-0 text-caption text-ink-faint">@{account.username}</span>}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
