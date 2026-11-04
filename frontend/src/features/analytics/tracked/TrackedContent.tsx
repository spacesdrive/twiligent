import { Bookmark, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/PageHeader';
import SurfaceBox from '@/components/SurfaceBox';
import ActiveFilters from '@/components/ActiveFilters';
import NoResults from '@/components/NoResults';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { resultCountLabel } from '@/lib/library';
import { useAppContext } from '../../../context/AppContext';
import AddTrackedDialog from './AddTrackedDialog';
import BulkCategoryBar from './BulkCategoryBar';
import EditTrackedDialog from './EditTrackedDialog';
import TrackedFilters from './TrackedFilters';
import TrackedMetrics from './TrackedMetrics';
import TrackedTable from './TrackedTable';
import { typeChipsOf } from './trackedList.ts';
import { useAddTracked } from './useAddTracked';
import { useBulkCategory } from './useBulkCategory';
import { useTrackedDelete } from './useTrackedDelete';
import { useTrackedEditor } from './useTrackedEditor';
import { useTrackedFilters } from './useTrackedFilters';
import { useTrackedItems } from './useTrackedItems';
import { useTrackedSelection } from './useTrackedSelection';

const RESULTS_ID = 'tracked-results';

export default function TrackedContent() {
  const { showToast } = useAppContext();
  const tracked = useTrackedItems(showToast);
  const { setItems, replaceItem } = tracked;
  const filters = useTrackedFilters(tracked.items);
  const selection = useTrackedSelection(filters.filtered);
  const bulk = useBulkCategory({ selection, setItems, showToast });
  const removal = useTrackedDelete({ setItems, dropSelection: selection.drop, showToast });
  const add = useAddTracked({ setItems, showToast });
  const editor = useTrackedEditor({ replaceItem, showToast });
  const isEmpty = !tracked.loading && !tracked.error && tracked.items.length === 0;

  const typeLabel = typeChipsOf(filters.stats).find(chip => chip.value === filters.typeFilter && chip.value !== 'all')?.label;
  const activeFilters = [
    filters.query && { key: 'q', label: `"${filters.query}"`, onRemove: () => filters.setQuery('') },
    typeLabel && { key: 'type', label: typeLabel, onRemove: () => filters.setTypeFilter('all') },
    filters.categoryFilter !== 'all' && { key: 'category', label: filters.categoryFilter, onRemove: () => filters.setCategoryFilter('all') },
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

  // the empty state carries the one primary action, so the header does not repeat it
  const header = (
    <PageHeader
      title="Tracked content"
      description="YouTube videos you follow, with their views, likes and comments."
      actions={!isEmpty && (
        <Button onClick={() => add.setOpen(true)}>
          <Plus data-icon="inline-start" aria-hidden="true" />
          Track content
        </Button>
      )}
    />
  );

  if (tracked.loading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-card" />)}
        </div>
        <Skeleton className="h-10 rounded-field" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    );
  }

  if (tracked.error) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <SurfaceBox>
          <ErrorState title="Tracked content could not load" description={tracked.error} onRetry={tracked.retry} />
        </SurfaceBox>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      {isEmpty ? (
        <SurfaceBox>
          <EmptyState
            icon={<Bookmark />}
            title="Nothing tracked yet"
            description="Paste a YouTube video or Shorts link to follow its views, likes and comments."
            action={<Button onClick={() => add.setOpen(true)}><Plus data-icon="inline-start" aria-hidden="true" />Track content</Button>}
          />
        </SurfaceBox>
      ) : (
        <>
          <TrackedMetrics stats={filters.stats} />
          <TrackedFilters filters={filters} />
          <ActiveFilters countLabel={resultCountLabel(filters.filtered.length, tracked.items.length, 'videos')} filters={activeFilters} onClearAll={filters.clearFilters} />
          {selection.someSelected && <BulkCategoryBar selectedCount={selection.selected.size} bulk={bulk} onClear={selection.clear} />}
          <div id={RESULTS_ID} tabIndex={-1} className="outline-none">
            {filters.filtered.length === 0 ? (
              <SurfaceBox><NoResults noun="videos" query={filters.query} onClear={filters.clearFilters} /></SurfaceBox>
            ) : (
              <TrackedTable
                filtered={filters.filtered}
                selection={selection}
                refreshingIds={tracked.refreshingIds}
                onRefresh={tracked.handleRefresh}
                onEdit={editor.openEdit}
                onDelete={removal.remove}
              />
            )}
          </div>
        </>
      )}

      <AddTrackedDialog add={add} categories={filters.categories} />
      <EditTrackedDialog editor={editor} categories={filters.categories} />
    </div>
  );
}
