import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Pager({ page, pageCount, onPageChange, total, shown, noun = 'items' }) {
  if (pageCount <= 1) {
    return total > 0 ? <p className="text-center text-caption text-ink-faint">{total} {noun}</p> : null;
  }
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-caption text-ink-faint">
        Showing {shown} of {total} {noun}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <span className="min-w-20 text-center text-small text-ink-muted tabular-nums">
          {page} of {pageCount}
        </span>
        <Button variant="outline" size="icon-sm" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
