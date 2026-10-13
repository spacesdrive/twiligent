import React from 'react';
import { useLocation } from 'react-router-dom';
import { useSmoothTheme } from '@/hooks/use-smooth-theme';
import { RefreshCw, Sun, Moon, Search } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { routeTitle } from './navigation';
import { useAppContext } from '../context/AppContext';
import { cn } from '@/lib/utils';

export default function TopBar({ onOpenPalette }) {
  const location = useLocation();
  const { loading, refreshAll, accounts } = useAppContext();
  const { resolvedTheme, setTheme } = useSmoothTheme();
  const isDark = resolvedTheme === 'dark';
  const title = routeTitle(location.pathname);

  return (
    <header className="sticky top-0 z-20 flex h-(--topbar-h) shrink-0 items-center gap-2 border-b border-line bg-surface/85 px-3 backdrop-blur-md sm:px-4">
      <SidebarTrigger className="text-ink-muted" />
      {title && (
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-small">
          {title.parent && (
            <>
              <span className="hidden truncate text-ink-faint sm:inline">{title.parent}</span>
              <span className="hidden text-ink-faint sm:inline" aria-hidden="true">/</span>
            </>
          )}
          <span className="truncate font-medium text-ink" aria-current="page">{title.label}</span>
        </nav>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={onOpenPalette} aria-label="Search" className="md:hidden" />}>
            <Search />
          </TooltipTrigger>
          <TooltipContent>Search</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={refreshAll}
                disabled={loading || accounts.length === 0}
                aria-label="Refresh all accounts"
              />
            }
          >
            <RefreshCw className={cn(loading && 'animate-spin')} />
          </TooltipTrigger>
          <TooltipContent>{loading ? 'Refreshing accounts' : 'Refresh all accounts'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              />
            }
          >
            {isDark ? <Sun /> : <Moon />}
          </TooltipTrigger>
          <TooltipContent>{isDark ? 'Light theme' : 'Dark theme'}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
