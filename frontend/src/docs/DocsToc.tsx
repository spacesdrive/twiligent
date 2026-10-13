import React from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TocItem } from './useTableOfContents';

function jumpTo(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  history.replaceState(null, '', `#${id}`);
}

interface DocsTocProps {
  items: TocItem[];
  active: string | null;
}

export default function DocsToc({ items, active }: DocsTocProps) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="On this page" className="flex flex-col gap-3">
      <p className="text-sm font-medium text-ink-muted">On this page</p>
      <ul className="flex flex-col border-l border-line">
        {items.map(item => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={e => jumpTo(e, item.id)}
              className={cn(
                '-ml-px block border-l py-1 text-sm leading-5 transition-colors duration-(--duration-base)',
                item.level === 3 ? 'pl-6' : 'pl-3',
                active === item.id ? 'border-brand text-ink' : 'border-transparent text-ink-faint hover:text-ink',
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="mt-3 flex w-fit items-center gap-1.5 border-t border-line pt-4 text-sm text-ink-faint transition-colors hover:text-ink">
        Scroll to top <ArrowUp className="size-3.5" />
      </button>
    </nav>
  );
}
