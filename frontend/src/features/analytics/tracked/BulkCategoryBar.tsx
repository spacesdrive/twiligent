import { Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
      className="sticky top-[calc(var(--topbar-h)+0.75rem)] z-10 flex flex-wrap items-center gap-3 rounded-card border border-brand/30 bg-surface-raised px-4 py-3 shadow-md"
      aria-label="Bulk actions"
    >
      <span className="text-sm font-medium text-ink">{selectedCount} selected</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Tag className="size-4 shrink-0 text-ink-faint" />
        <Input
          placeholder="Category name"
          aria-label="Category to assign"
          value={bulk.bulkCategory}
          onChange={e => bulk.setBulkCategory(e.target.value)}
          className="h-(--control-h-sm) max-w-xs"
        />
        <Button type="submit" size="sm" disabled={!bulk.bulkCategory.trim()}>Assign category</Button>
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={onClear}>Clear selection</Button>
    </form>
  );
}
