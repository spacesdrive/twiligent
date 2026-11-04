import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CircleHelp, Search } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { docsUrl } from '@/lib/docs';
import { routeTitle } from './navigation';
import { shortcutLabel } from './shortcuts';

export interface TopBarProps {
  onOpenPalette: () => void;
}

export default function TopBar({ onOpenPalette }: TopBarProps) {
  const location = useLocation();
  const title = routeTitle(location.pathname);
  const searchLabel = `Search (${shortcutLabel('K')})`;

  return (
    <header className="sticky top-0 z-20 flex h-(--topbar-h) shrink-0 items-center gap-2 border-b border-line bg-surface/85 px-3 backdrop-blur-md sm:px-4">
      <SidebarTrigger className="text-ink-muted" />
      {title?.parent ? (
        <nav aria-label="Breadcrumb" className="min-w-0 text-small">
          <ol className="flex min-w-0 items-center gap-1.5">
            <li className="hidden min-w-0 sm:flex sm:items-center sm:gap-1.5">
              <Link to={title.parent.path} className="truncate rounded-row text-ink-muted underline-offset-4 hover:text-ink hover:underline">
                {title.parent.label}
              </Link>
              <span className="text-ink-faint" aria-hidden="true">/</span>
            </li>
            <li className="min-w-0">
              <span className="block truncate font-medium text-ink" aria-current="page">{title.label}</span>
            </li>
          </ol>
        </nav>
      ) : (
        title && <p className="min-w-0 truncate text-small font-medium text-ink">{title.label}</p>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={<Button variant="ghost" size="icon-sm" onClick={onOpenPalette} aria-label={searchLabel} className="pointer-coarse:size-11 md:hidden" />}
          >
            <Search />
          </TooltipTrigger>
          <TooltipContent>{searchLabel}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="pointer-coarse:size-11"
                render={<a href={docsUrl()} target="_blank" rel="noopener noreferrer" aria-label="Help and documentation (opens in a new tab)" />}
              />
            }
          >
            <CircleHelp />
          </TooltipTrigger>
          <TooltipContent>Help and documentation</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
