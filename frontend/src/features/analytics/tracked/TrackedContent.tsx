import { Bookmark, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/PageHeader';
import SurfaceBox from '@/components/SurfaceBox';
import ConfirmDialog from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/StateViews';
import { useAppContext } from '../../../context/AppContext';
import { useCloudinaryConfig } from '../../../hooks/use-cloudinary-config';
import AddTrackedDialog from './AddTrackedDialog';
import BulkCategoryBar from './BulkCategoryBar';
import EditTrackedDialog from './EditTrackedDialog';
import TrackedFilters from './TrackedFilters';
import TrackedMetrics from './TrackedMetrics';
import TrackedTable from './TrackedTable';
import { useAddTracked } from './useAddTracked';
import { useBulkCategory } from './useBulkCategory';
import { useTrackedDelete } from './useTrackedDelete';
import { useTrackedEditor } from './useTrackedEditor';
import { useTrackedFilters } from './useTrackedFilters';
import { useTrackedItems } from './useTrackedItems';
import { useTrackedSelection } from './useTrackedSelection';
import type { TrackedContentItem } from '@shared/types/domain.ts';

function deleteDescription(item: TrackedContentItem | null): string {
  if (!item) return '';
  return `"${item.title || item.label || item.url}" and its saved views, image and category are removed from Twiligent. The original post or video is not affected.`;
}

export default function TrackedContent() {
  const { accounts, showToast } = useAppContext();
  const redditAccounts = accounts.filter(account => account.platform === 'reddit');
  const tracked = useTrackedItems(showToast);
  const { setItems, replaceItem } = tracked;
  const cloudConfig = useCloudinaryConfig();
  const filters = useTrackedFilters(tracked.items);
  const selection = useTrackedSelection(filters.filtered);
  const bulk = useBulkCategory({ selection, setItems, showToast });
  const removal = useTrackedDelete({ setItems, dropSelection: selection.drop, showToast });
  const add = useAddTracked({ redditAccounts, setItems, showToast });
  const editor = useTrackedEditor({ cloudConfig, replaceItem, showToast });

  const header = (
    <PageHeader
      title="Tracked content"
      description="Reddit posts and YouTube videos you follow, with karma, likes and comments."
      actions={
        <Button onClick={() => add.setOpen(true)}>
          <Plus data-icon="inline-start" />
          Track content
        </Button>
      }
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

  return (
    <div className="flex flex-col gap-6">
      {header}

      <TrackedMetrics stats={filters.stats} />

      {tracked.items.length === 0 ? (
        <SurfaceBox>
          <EmptyState
            icon={<Bookmark />}
            title="Nothing tracked yet"
            description="Paste a Reddit post or YouTube video link to follow its karma, likes and comments."
            action={<Button onClick={() => add.setOpen(true)}><Plus data-icon="inline-start" />Track your first item</Button>}
          />
        </SurfaceBox>
      ) : (
        <>
          <TrackedFilters filters={filters} />
          {selection.someSelected && <BulkCategoryBar selectedCount={selection.selected.size} bulk={bulk} onClear={selection.clear} />}
          <TrackedTable
            filtered={filters.filtered}
            selection={selection}
            refreshingIds={tracked.refreshingIds}
            onRefresh={tracked.handleRefresh}
            onEdit={editor.openEdit}
            onDelete={removal.setDeleteItem}
          />
        </>
      )}

      <AddTrackedDialog add={add} redditAccounts={redditAccounts} categories={filters.categories} />
      <EditTrackedDialog editor={editor} categories={filters.categories} />

      <ConfirmDialog
        open={Boolean(removal.deleteItem)}
        onOpenChange={open => { if (!open) removal.setDeleteItem(null); }}
        title="Stop tracking this content?"
        description={deleteDescription(removal.deleteItem)}
        confirmLabel="Stop tracking"
        onConfirm={removal.handleDelete}
        busy={removal.deleting}
        hold
      />
    </div>
  );
}
