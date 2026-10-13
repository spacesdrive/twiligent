import { TableCell } from '@/components/ui/table';
import { AccountAvatar } from '@/components/platform';
import type { ReactNode } from 'react';
import { accountHandle } from '@/lib/accounts';
import type { AccountFields } from '@/lib/accounts';

export interface AccountCellProps {
  account: AccountFields;
  name: ReactNode;
}

export default function AccountCell({ account, name }: AccountCellProps) {
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
