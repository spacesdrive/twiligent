import { TableCell } from '@/components/ui/table';
import { AccountAvatar } from '@/components/platform';
import { accountHandle } from '@/lib/accounts';

export default function AccountCell({ account, name }) {
  return (
    <TableCell>
      <div className="flex items-center gap-2.5">
        <AccountAvatar account={account} />
        <div>
          <p className="text-sm font-medium text-ink">{name}</p>
          <p className="text-caption text-ink-faint">{accountHandle(account)}</p>
        </div>
      </div>
    </TableCell>
  );
}
