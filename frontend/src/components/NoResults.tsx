import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/StateViews';

export interface NoResultsProps {
  noun: string;
  query?: string;
  onClear: () => void;
}

// echoes what was searched, so the person can see why nothing matched and undo it in one step
export default function NoResults({ noun, query, onClear }: NoResultsProps) {
  const trimmed = query?.trim();
  return (
    <EmptyState
      icon={<SearchX />}
      title={trimmed ? `No ${noun} match "${trimmed}"` : `No ${noun} match these filters`}
      description="Try a different search or clear the filters."
      action={<Button variant="outline" size="sm" onClick={onClear}>Clear filters</Button>}
    />
  );
}
