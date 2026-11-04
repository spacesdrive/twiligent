import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SurfaceBox from '@/components/SurfaceBox';
import { RankNumber } from '@/components/ListRow';
import { PlatformBadge } from '@/components/platform';
import { accountName, platformOf } from '@/lib/accounts';
import RelativeTime from '@/components/RelativeTime';
import type { AppAccount } from '../../../utils/formatters';
import { accountAudienceLabel, accountContentLabel } from './overviewLabels.ts';
import AccountCell from './AccountCell';
import OpenAnalytics from './OpenAnalytics';

export interface AccountsTabProps {
  accounts: AppAccount[];
}

export default function AccountsTab({ accounts }: AccountsTabProps) {
  return (
    <SurfaceBox title="All accounts" subheader="Ranked by audience" content={false} className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-right">#</TableHead>
            <TableHead>Account</TableHead>
            <TableHead className="hidden sm:table-cell">Platform</TableHead>
            <TableHead className="text-right">Audience</TableHead>
            <TableHead className="hidden text-right md:table-cell">Content</TableHead>
            <TableHead className="hidden text-right md:table-cell">Updated</TableHead>
            <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account, i) => (
            <TableRow key={account.id}>
              <TableCell className="text-right"><RankNumber rank={i + 1} className="w-auto" /></TableCell>
              <AccountCell account={account} name={accountName(account)} />
              <TableCell className="hidden sm:table-cell"><PlatformBadge platform={platformOf(account)} /></TableCell>
              <TableCell className="text-right text-ink">{accountAudienceLabel(account)}</TableCell>
              <TableCell className="hidden text-right text-ink-muted md:table-cell">{accountContentLabel(account)}</TableCell>
              <TableCell className="hidden text-right text-small text-ink-faint md:table-cell"><RelativeTime date={account.lastUpdated} /></TableCell>
              <TableCell><OpenAnalytics account={account} name={accountName(account)} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SurfaceBox>
  );
}
