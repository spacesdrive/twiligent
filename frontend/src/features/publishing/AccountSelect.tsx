import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AccountAvatar } from '@/components/platform';

export default function AccountSelect({ accounts, value, onChange, disabled }) {
  const selected = accounts.find(account => account.id === value);
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
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
