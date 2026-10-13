import { AlertCircle, Calendar, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import SurfaceBox from '@/components/SurfaceBox';

export default function BulkResults({ stats, processing }) {
  const finished = stats.done + stats.scheduled + stats.errors;
  return (
    <SurfaceBox title={processing ? 'Working through the files' : 'Results'}>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">{stats.total} total</Badge>
        {stats.done > 0 && <Badge variant="success"><CheckCircle2 />{stats.done} published</Badge>}
        {stats.scheduled > 0 && <Badge variant="warning"><Calendar />{stats.scheduled} scheduled</Badge>}
        {stats.errors > 0 && <Badge variant="destructive"><AlertCircle />{stats.errors} failed</Badge>}
        {stats.pending > 0 && <Badge variant="secondary">{stats.pending} pending</Badge>}
      </div>
      {processing && (
        <Progress value={(finished / Math.max(1, stats.total)) * 100} className="mt-3" aria-label="Overall progress" />
      )}
    </SurfaceBox>
  );
}
