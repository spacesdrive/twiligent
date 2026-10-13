import { useNavigate } from 'react-router-dom';
import ListRow, { RankNumber } from '@/components/ListRow';
import { AccountAvatar } from '@/components/platform';
import type { ReactNode } from 'react';
import { accountHandle, accountName, accountPath } from '@/lib/accounts';
import type { AccountFields } from '@/lib/accounts';

export interface AccountRankRowProps {
  account: AccountFields;
  rank: number;
  trailing: ReactNode;
}

export default function AccountRankRow({ account, rank, trailing }: AccountRankRowProps) {
  const navigate = useNavigate();
  return (
    <ListRow
      onClick={() => navigate(accountPath(account))}
      leading={<><RankNumber rank={rank} /><AccountAvatar account={account} showPlatform /></>}
      title={accountName(account)}
      meta={accountHandle(account)}
      trailing={trailing}
    />
  );
}
