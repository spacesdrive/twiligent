import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SurfaceBox from '@/components/SurfaceBox';
import { fmtNum } from '../../../utils/formatters';
import { reportedViews } from './instagramAnalyticsData.js';
import TypeBadge from './TypeBadge';

export default function InstagramTypeSummaryTable({ rows }) {
  return (
    <SurfaceBox title="Summary by content type" content={false} className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Count</TableHead>
            <TableHead className="text-right">Total views</TableHead>
            <TableHead className="text-right">Average views</TableHead>
            <TableHead className="text-right">Average likes</TableHead>
            <TableHead className="text-right">Average comments</TableHead>
            <TableHead className="text-right">Average engagement</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.type}>
              <TableCell><TypeBadge type={row.type} /></TableCell>
              <TableCell className="text-right text-ink">{row.count}</TableCell>
              <TableCell className="text-right text-ink-muted">{reportedViews(row, 'totalViews')}</TableCell>
              <TableCell className="text-right text-ink-muted">{reportedViews(row, 'avgViews')}</TableCell>
              <TableCell className="text-right text-ink-muted">{fmtNum(row.avgLikes)}</TableCell>
              <TableCell className="text-right text-ink-muted">{fmtNum(row.avgComments)}</TableCell>
              <TableCell className="text-right font-semibold text-ink">{fmtNum(row.avgEngagement)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SurfaceBox>
  );
}
