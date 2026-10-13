import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SurfaceBox from '@/components/SurfaceBox';
import { RankNumber } from '@/components/ListRow';
import { fmtNum, fmtNumFull, timeAgo } from '../../../utils/formatters';
import AccountCell from './AccountCell';
import OpenAnalytics from './OpenAnalytics';

export default function YouTubeViewsTable({ accounts }) {
  return (
    <SurfaceBox title="YouTube views by channel" content={false} className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-right">#</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead className="text-right">Total views</TableHead>
            <TableHead className="text-right">Subscribers</TableHead>
            <TableHead className="text-right">Videos</TableHead>
            <TableHead className="text-right">Updated</TableHead>
            <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account, i) => (
            <TableRow key={account.id}>
              <TableCell className="text-right"><RankNumber rank={i + 1} className="w-auto" /></TableCell>
              <AccountCell account={account} name={account.title} />
              <TableCell className="text-right">
                <p className="font-semibold text-ink">{fmtNum(account.viewCount)}</p>
                <p className="text-caption text-ink-faint">{fmtNumFull(account.viewCount)}</p>
              </TableCell>
              <TableCell className="text-right text-ink-muted">{fmtNum(account.subscriberCount)}</TableCell>
              <TableCell className="text-right text-ink-muted">{fmtNum(account.videoCount)}</TableCell>
              <TableCell className="text-right text-small text-ink-faint">{timeAgo(account.lastUpdated)}</TableCell>
              <TableCell><OpenAnalytics account={account} name={account.title} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SurfaceBox>
  );
}
