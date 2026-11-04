import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pageRangeLabel } from '@/lib/library';

export interface PagerProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  total: number;
  shown: number;
  pageSize?: number;
  noun?: string;
  // the element that holds the results; a page change moves focus there so the new page is read from the top
  resultsId?: string;
}

export default function Pager({ page, pageCount, onPageChange, total, shown, pageSize, noun = 'items', resultsId }: PagerProps) {
  const label = pageRangeLabel({ page, pageCount, total, shown, pageSize, noun });

  const goTo = (next: number) => {
    onPageChange(next);
    if (!resultsId) return;
    requestAnimationFrame(() => {
      const results = document.getElementById(resultsId);
      if (!results) return;
      results.scrollIntoView({ block: 'start' });
      results.focus({ preventScroll: true });
    });
  };

  if (pageCount <= 1) {
    return (
      <p role="status" aria-live="polite" className="text-center text-caption text-ink-faint">
        {total > 0 ? label : ''}
      </p>
    );
  }
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p role="status" aria-live="polite" className="text-caption text-ink-faint">{label}</p>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="icon-sm" onClick={() => goTo(1)} disabled={page <= 1} aria-label="First page">
          <ChevronsLeft />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => goTo(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <span className="min-w-20 text-center text-small text-ink-muted tabular-nums">
          Page {page} of {pageCount}
        </span>
        <Button variant="outline" size="icon-sm" onClick={() => goTo(page + 1)} disabled={page >= pageCount} aria-label="Next page">
          <ChevronRight />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => goTo(pageCount)} disabled={page >= pageCount} aria-label="Last page">
          <ChevronsRight />
        </Button>
      </div>
    </nav>
  );
}
