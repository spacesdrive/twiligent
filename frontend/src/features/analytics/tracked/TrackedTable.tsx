import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SurfaceBox from '@/components/SurfaceBox';
import ColumnHint from '@/components/ColumnHint';
import TrackedRow from './TrackedRow';
import type { TrackedContentItem } from '@shared/types/domain.ts';
import type { TrackedSelection } from './useTrackedSelection';

export interface TrackedTableProps {
  filtered: TrackedContentItem[];
  selection: TrackedSelection;
  refreshingIds: Set<string>;
  onRefresh: (id: string) => void;
  onEdit: (item: TrackedContentItem) => void;
  onDelete: (item: TrackedContentItem) => void;
}

export default function TrackedTable({ filtered, selection, refreshingIds, onRefresh, onEdit, onDelete }: TrackedTableProps) {
  return (
    <SurfaceBox title="Tracked items" content={false} className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox checked={selection.allSelected} onCheckedChange={selection.toggleAll} aria-label="Select all shown items" />
            </TableHead>
            <TableHead className="sticky left-0 z-[1] bg-surface-raised">Content</TableHead>
            <TableHead className="hidden w-32 lg:table-cell">Category</TableHead>
            <TableHead className="hidden w-24 text-right sm:table-cell">Views</TableHead>
            <TableHead className="w-28 text-right">Likes or karma</TableHead>
            <TableHead className="hidden w-24 text-right md:table-cell">Comments</TableHead>
            <TableHead className="hidden w-32 text-right lg:table-cell"><ColumnHint label="Upvote rate" hint="Share of votes on a Reddit post that are upvotes. Shows a dash for YouTube videos and for posts under 10 karma, where the ratio is not meaningful." /></TableHead>
            <TableHead className="hidden w-28 text-right md:table-cell">Fetched</TableHead>
            <TableHead className="w-32"><span className="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(item => (
            <TrackedRow
              key={item.id}
              item={item}
              isSelected={selection.selected.has(item.id)}
              isRefreshing={refreshingIds.has(item.id)}
              onToggle={selection.toggleOne}
              onRefresh={onRefresh}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </TableBody>
      </Table>
    </SurfaceBox>
  );
}
