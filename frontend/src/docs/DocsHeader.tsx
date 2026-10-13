import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, Moon, Search, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';
import { DOC_TABS, firstPagePath } from './nav';
import type { DocTab } from './nav';

interface DocsHeaderProps {
  tab: DocTab;
  signedIn: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenMenu: () => void;
  onOpenSearch: () => void;
}

export default function DocsHeader({ tab, signedIn, isDark, onToggleTheme, onOpenMenu, onOpenSearch }: DocsHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onOpenMenu} aria-label="Open navigation">
          <Menu />
        </Button>
        <Link to="/docs" className="flex shrink-0 items-center gap-2.5" aria-label="Twiligent documentation home">
          <Logo className="h-6" />
          <span className="hidden border-l border-line pl-2.5 text-sm font-medium text-ink-muted sm:inline">Docs</span>
        </Link>
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search documentation"
          className="ml-auto flex size-9 shrink-0 items-center justify-center gap-2 rounded-field border border-line-control bg-surface text-sm text-ink-faint transition-colors hover:border-line-strong/60 hover:text-ink-muted sm:mx-auto sm:w-full sm:max-w-md sm:shrink sm:justify-start sm:px-3"
        >
          <Search className="size-4 stroke-[1.75]" />
          <span className="hidden flex-1 text-left sm:inline">Search</span>
          <kbd className="hidden rounded-sm border border-line px-1.5 font-mono text-caption sm:inline">/</kbd>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onToggleTheme} aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}>
            {isDark ? <Sun /> : <Moon />}
          </Button>
          <Button size="sm" render={<Link to={signedIn ? '/' : '/login'} />}>
            {signedIn ? <>Open<span className="hidden sm:inline">&nbsp;Twiligent</span></> : 'Sign in'}
          </Button>
        </div>
      </div>
      <nav aria-label="Documentation sections" className="scrollbar-hide flex h-11 items-stretch gap-5 overflow-x-auto px-4 lg:px-6">
        {DOC_TABS.map(docTab => (
          <Link
            key={docTab.id}
            to={firstPagePath(docTab)}
            aria-current={docTab.id === tab.id ? 'page' : undefined}
            className={cn(
              'relative flex shrink-0 items-center text-sm font-medium transition-colors duration-(--duration-base)',
              docTab.id === tab.id ? 'text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand' : 'text-ink-muted hover:text-ink',
            )}
          >
            {docTab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
