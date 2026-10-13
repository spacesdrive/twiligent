import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { DocPageEntry } from './nav';

interface DocsPagerProps {
  prev: DocPageEntry | null;
  next: DocPageEntry | null;
}

export default function DocsPager({ prev, next }: DocsPagerProps) {
  return (
    <nav aria-label="Previous and next page" className="mt-16 grid grid-cols-1 gap-3 border-t border-line pt-8 sm:grid-cols-2">
      {prev ? (
        <Link to={prev.path} className="group flex flex-col gap-1 rounded-card border border-line p-4 transition-colors hover:border-line-strong/50">
          <span className="flex items-center gap-1 text-caption text-ink-faint"><ArrowLeft className="size-3.5" />Previous</span>
          <span className="text-sm font-medium text-ink">{prev.title}</span>
        </Link>
      ) : <span />}
      {next && (
        <Link to={next.path} className="group flex flex-col items-end gap-1 rounded-card border border-line p-4 text-right transition-colors hover:border-line-strong/50">
          <span className="flex items-center gap-1 text-caption text-ink-faint">Next<ArrowRight className="size-3.5" /></span>
          <span className="text-sm font-medium text-ink">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}
