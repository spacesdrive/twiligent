import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { List } from '@/components/icons';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export interface TocProps {
  // the rendered article, read once its MDX has loaded
  article: HTMLElement | null;
  // changes with each page, so the list is read again
  pageKey: string;
}

// "On this page": the h2 and h3 headings, with the one being read lit as the reader scrolls
export function Toc({ article, pageKey }: TocProps) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [active, setActive] = useState('');

  useEffect(() => {
    if (!article) return;
    const headings = [...article.querySelectorAll<HTMLElement>('[data-toc]')];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the list comes from the DOM the MDX rendered
    setItems(headings.map(h => ({ id: h.id, text: h.textContent?.trim() ?? '', level: Number(h.dataset.toc) })));
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-96px 0px -66% 0px' },
    );
    headings.forEach(h => observer.observe(h));
    return () => observer.disconnect();
  }, [article, pageKey]);

  if (items.length === 0) return null;
  return (
    <nav aria-label="On this page" className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <List className="size-4" />
        On this page
      </p>
      <ul className="flex flex-col gap-2.5 text-sm">
        {items.map(item => (
          <li key={item.id} className={cn(item.level === 3 && 'pl-4')}>
            <a
              href={`#${item.id}`}
              className={cn(
                'transition-colors',
                active === item.id ? 'font-medium text-accent-text' : 'text-ink-muted hover:text-ink',
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
