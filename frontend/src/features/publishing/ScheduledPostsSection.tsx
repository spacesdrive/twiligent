import { Calendar, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SurfaceBox from '@/components/SurfaceBox';
import FilterChips from '@/components/FilterChips';
import { EmptyState } from '@/components/StateViews';
import OverdueAlert from './OverdueAlert';
import ScheduledPostRow from './ScheduledPostRow';
import { filterScheduledPosts, overduePostsOf, scheduledStatusChips } from './scheduleHelpers.ts';
import type { AppAccount } from '../../utils/formatters';
import type { ScheduledPostRemoval } from './useScheduledPostDelete';
import type { ScheduledPostEditor } from './useScheduledPostEdit';
import type { ScheduledPostsState } from './useScheduledPosts';

interface ScheduledPostsSectionProps {
  schedule: ScheduledPostsState;
  editor: ScheduledPostEditor;
  removal: ScheduledPostRemoval;
  igAccounts: AppAccount[];
}

function ScheduledPostsHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-10 text-right">#</TableHead>
        <TableHead>Account</TableHead>
        <TableHead>Type</TableHead>
        <TableHead className="min-w-48">Caption</TableHead>
        <TableHead className="min-w-40">Scheduled for</TableHead>
        <TableHead className="min-w-40">Published</TableHead>
        <TableHead>Status</TableHead>
        <TableHead className="min-w-40">Error</TableHead>
        <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
      </TableRow>
    </TableHeader>
  );
}

export default function ScheduledPostsSection({ schedule, editor, removal, igAccounts }: ScheduledPostsSectionProps) {
  const { scheduledPosts, statusFilter } = schedule;
  const filteredScheduled = filterScheduledPosts(scheduledPosts, statusFilter);
  const overdueCount = overduePostsOf(scheduledPosts).length;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-section font-semibold text-ink">Scheduled posts</h2>
          <p className="text-small text-ink-muted">Posts waiting to go out, and the history of ones that already did.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={schedule.loadScheduledPosts}><RefreshCw data-icon="inline-start" />Refresh</Button>
          <Button size="sm" variant="outline" onClick={() => removal.setConfirmDeleteAll(true)} className="hover:bg-danger-soft hover:text-danger"><Trash2 data-icon="inline-start" />Delete all</Button>
        </div>
      </div>
      {overdueCount > 0 && <OverdueAlert count={overdueCount} />}
      <FilterChips label="Status" options={scheduledStatusChips(scheduledPosts)} value={statusFilter} onChange={schedule.setStatusFilter} />
      <SurfaceBox content={false} className="overflow-hidden">
        <Table>
          <ScheduledPostsHeader />
          <TableBody>
            {filteredScheduled.map((post, index) => (
              <ScheduledPostRow
                key={post.id}
                post={post}
                position={index + 1}
                account={igAccounts.find(account => account.id === post.accountId)}
                editor={editor}
                onDelete={removal.setPendingDelete}
              />
            ))}
            {filteredScheduled.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9}>
                  <EmptyState compact icon={<Calendar />} title={`No ${statusFilter} posts`} description="Choose a different status to see other posts." />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </SurfaceBox>
    </section>
  );
}
