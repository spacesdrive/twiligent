import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SurfaceBox from '@/components/SurfaceBox';
import Num from '@/components/Num';
import { reportedViews } from './instagramAnalyticsData.ts';
import type { InstagramTypeRow } from './instagramAnalyticsData.ts';
import TypeBadge from './TypeBadge';

export interface InstagramTypeSummaryTableProps {
  rows: InstagramTypeRow[];
}

export default function InstagramTypeSummaryTable({ rows }: InstagramTypeSummaryTableProps) {
  return (
    <SurfaceBox title="Summary by content type" content={false} className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Count</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Total views</TableHead>
            <TableHead className="text-right">Average views</TableHead>
            <TableHead className="hidden text-right md:table-cell">Average likes</TableHead>
            <TableHead className="hidden text-right md:table-cell">Average comments</TableHead>
            <TableHead className="text-right">Average interactions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.type}>
              <TableCell><TypeBadge type={row.type} /></TableCell>
              <TableCell className="text-right text-ink">{row.count}</TableCell>
              <TableCell className="hidden text-right text-ink-muted sm:table-cell">{reportedViews(row, 'totalViews')}</TableCell>
              <TableCell className="text-right text-ink-muted">{reportedViews(row, 'avgViews')}</TableCell>
              <TableCell className="hidden text-right text-ink-muted md:table-cell"><Num value={row.avgLikes} /></TableCell>
              <TableCell className="hidden text-right text-ink-muted md:table-cell"><Num value={row.avgComments} /></TableCell>
              <TableCell className="text-right font-semibold text-ink"><Num value={row.avgEngagement} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SurfaceBox>
  );
}
