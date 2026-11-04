import { Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { fieldErrorId } from '@/lib/fieldIds';
import type { BulkCategory } from './useBulkCategory';

export interface BulkCategoryBarProps {
  selectedCount: number;
  bulk: BulkCategory;
  onClear: () => void;
}

export default function BulkCategoryBar({ selectedCount, bulk, onClear }: BulkCategoryBarProps) {
  return (
    <form
      onSubmit={bulk.handleBulkCategory}
      noValidate
      className="sticky top-[calc(var(--topbar-h)+0.75rem)] z-10 flex flex-wrap items-center gap-3 rounded-card border border-brand/30 bg-surface-raised px-4 py-3 shadow-md"
      aria-label="Bulk actions"
    >
      {/* the bar mounts with the first selection, so the count is announced as it changes after that */}
      <span className="text-sm font-medium text-ink" role="status" aria-live="polite">{selectedCount} selected</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <Tag className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
        <label htmlFor="bulk-category" className="text-sm font-medium text-ink">Category</label>
        <Input
          id="bulk-category"
          placeholder="Campaign A"
          value={bulk.bulkCategory}
          onChange={e => bulk.setBulkCategory(e.target.value)}
          aria-invalid={bulk.categoryError ? true : undefined}
          aria-describedby={bulk.categoryError ? fieldErrorId('bulk-category') : undefined}
          className="h-(--control-h-sm) max-w-xs"
        />
        <Button type="submit" size="sm" disabled={bulk.assigning}>
          {bulk.assigning && <Spinner className="size-4" />}
          {bulk.assigning ? 'Assigning' : 'Assign category'}
        </Button>
        {bulk.categoryError && (
          <p id={fieldErrorId('bulk-category')} className="basis-full text-sm text-danger"><span className="sr-only">Error: </span>{bulk.categoryError}</p>
        )}
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={onClear} disabled={bulk.assigning}>Clear selection</Button>
    </form>
  );
}
