import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function DocsSidebarNav({ tab, onNavigate }) {
  return (
    <nav aria-label={`${tab.label} pages`} className="flex flex-col gap-6">
      {tab.groups.map((group, i) => (
        <div key={group.label || i} className="flex flex-col gap-0.5">
          {group.label && <p className="mb-1 px-2 text-small font-semibold text-ink">{group.label}</p>}
          {group.pages.map(page => {
            const path = page.slug ? `/docs/${page.slug}` : '/docs';
            return (
              <NavLink
                key={path}
                to={path}
                end
                onClick={onNavigate}
                className={({ isActive }) => cn(
                  'rounded-row px-2 py-2 text-sm leading-[1.1rem] transition-colors duration-(--duration-base)',
                  isActive ? 'bg-surface-selected font-medium text-ink' : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
                )}
              >
                {page.title}
              </NavLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
