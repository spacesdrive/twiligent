import { useNavigate } from 'react-router-dom';
import ListRow, { RankNumber } from '@/components/ListRow';
import { AccountAvatar } from '@/components/platform';
import { accountHandle, accountName, accountPath } from '@/lib/accounts';

export default function AccountRankRow({ account, rank, trailing }) {
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
