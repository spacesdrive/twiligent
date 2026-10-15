import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import type { DocEntry, DocTab } from './nav';

export interface DocsSidebarProps {
  tab: DocTab;
  current: DocEntry | undefined;
  onNavigate?: () => void;
}

// the groups and pages of the open tab, as in the Activepieces docs: a label per group and an icon per page
export function DocsSidebar({ tab, current, onNavigate }: DocsSidebarProps) {
  return (
    <nav aria-label={`${tab.label} pages`} className="flex flex-col gap-7">
      {tab.groups.map(group => (
        <div key={group.label}>
          <p className="px-3 pb-2 text-sm font-semibold text-ink">{group.label}</p>
          <ul className="flex flex-col gap-0.5">
            {group.pages.map(page => {
              const Icon = page.icon;
              const active = current?.slug === page.slug;
              return (
                <li key={page.slug}>
                  <Link
                    to={page.slug ? `/docs/${page.slug}` : '/docs'}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-1.5 text-[15px] transition-colors',
                      active
                        ? 'bg-accent-soft font-medium text-accent-text'
                        : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" />
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
