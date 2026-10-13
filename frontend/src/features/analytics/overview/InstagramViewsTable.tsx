import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SurfaceBox from '@/components/SurfaceBox';
import { accountName } from '@/lib/accounts';
import { fmtNum } from '../../../utils/formatters';
import { IG_CONTENT_TYPES, IG_CONTENT_TYPE_META } from '../../../utils/instagramContent';
import AccountCell from './AccountCell';
import OpenAnalytics from './OpenAnalytics';
import type { AppAccount } from '../../../utils/formatters';
import type { AccountCacheFields, IGAccountRow } from './overviewStats.ts';

interface InstagramViewsRowProps {
  account: AppAccount;
  cache: AccountCacheFields | undefined;
  isSyncing: boolean;
}

export interface InstagramViewsTableProps {
  rows: IGAccountRow<AppAccount>[];
  isSyncing: boolean;
}

function InstagramViewsRow({ account, cache, isSyncing }: InstagramViewsRowProps) {
  const warmed = cache?.cacheWarmed;
  const pendingLabel = isSyncing ? 'Syncing' : '-';
  return (
    <TableRow>
      <AccountCell account={account} name={accountName(account)} />
      {IG_CONTENT_TYPES.map(type => (
        <TableCell key={type} className="text-right">
          {warmed ? (
            <>
              <p className="text-sm font-medium text-ink">{fmtNum(cache.contentTypes?.[type]?.views)}</p>
              <p className="text-caption text-ink-faint">{fmtNum(cache.contentTypes?.[type]?.count)} {IG_CONTENT_TYPE_META[type].plural.toLowerCase()}</p>
            </>
          ) : <span className="text-ink-faint">-</span>}
        </TableCell>
      ))}
      <TableCell className="text-right font-semibold text-ink">
        {warmed ? fmtNum(cache.totalViews) : <span className="font-normal text-ink-faint">{pendingLabel}</span>}
      </TableCell>
      <TableCell>
        <OpenAnalytics account={account} name={accountName(account)} />
      </TableCell>
    </TableRow>
  );
}

export default function InstagramViewsTable({ rows, isSyncing }: InstagramViewsTableProps) {
  return (
    <SurfaceBox title="Instagram views by content type" content={false} className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account</TableHead>
            {IG_CONTENT_TYPES.map(type => (
              <TableHead key={type} className="text-right">{IG_CONTENT_TYPE_META[type].plural}</TableHead>
            ))}
            <TableHead className="text-right">Total views</TableHead>
            <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ account, cache }) => (
            <InstagramViewsRow key={account.id} account={account} cache={cache} isSyncing={isSyncing} />
          ))}
        </TableBody>
      </Table>
    </SurfaceBox>
  );
}
