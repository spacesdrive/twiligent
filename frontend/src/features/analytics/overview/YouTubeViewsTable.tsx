import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SurfaceBox from '@/components/SurfaceBox';
import { RankNumber } from '@/components/ListRow';
import Num from '@/components/Num';
import RelativeTime from '@/components/RelativeTime';
import AccountCell from './AccountCell';
import OpenAnalytics from './OpenAnalytics';
import type { AppAccount } from '../../../utils/formatters';

export interface YouTubeViewsTableProps {
  accounts: AppAccount[];
}

export default function YouTubeViewsTable({ accounts }: YouTubeViewsTableProps) {
  return (
    <SurfaceBox title="YouTube views by channel" subheader="Lifetime channel views" content={false} className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-right">#</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead className="text-right">Total views</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Subscribers</TableHead>
            <TableHead className="hidden text-right md:table-cell">Videos</TableHead>
            <TableHead className="hidden text-right md:table-cell">Updated</TableHead>
            <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account, i) => (
            <TableRow key={account.id}>
              <TableCell className="text-right"><RankNumber rank={i + 1} className="w-auto" /></TableCell>
              <AccountCell account={account} name={account.title} />
              <TableCell className="text-right font-semibold text-ink"><Num value={account.viewCount} /></TableCell>
              <TableCell className="hidden text-right text-ink-muted sm:table-cell"><Num value={account.subscriberCount} /></TableCell>
              <TableCell className="hidden text-right text-ink-muted md:table-cell"><Num value={account.videoCount} /></TableCell>
              <TableCell className="hidden text-right text-small text-ink-faint md:table-cell"><RelativeTime date={account.lastUpdated} /></TableCell>
              <TableCell><OpenAnalytics account={account} name={account.title} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SurfaceBox>
  );
}
