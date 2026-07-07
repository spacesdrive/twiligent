import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw, Settings, Sun, Moon, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { cn } from '@/lib/utils';

const BREADCRUMB_MAP = {
  '/':          { label: 'Overview',          parent: null },
  '/videos':    { label: 'All Videos',         parent: 'Analytics' },
  '/shorts':    { label: 'Shorts',             parent: 'Analytics' },
  '/reels':     { label: 'IG Content',         parent: 'Analytics' },
  '/upload':    { label: 'Publish',            parent: 'Publishing' },
  '/accounts':  { label: 'Accounts',           parent: 'Management' },
  '/settings':  { label: 'Settings',           parent: 'Management' },
};

export default function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, refreshAll } = useAppContext();
  const { resolvedTheme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const isDark = resolvedTheme === 'dark';

  let crumb = BREADCRUMB_MAP[location.pathname];
  if (!crumb && location.pathname.startsWith('/channel/')) {
    crumb = { label: 'Channel Analytics', parent: 'Analytics' };
  } else if (!crumb && location.pathname.startsWith('/instagram/')) {
    crumb = { label: 'Instagram Analytics', parent: 'Analytics' };
  }

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  const emailInitial = user?.email?.[0]?.toUpperCase() ?? 'T';

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 backdrop-blur px-4">
      <SidebarTrigger className="-ml-1" />

      {/* Breadcrumbs */}
      {crumb && (
        <Breadcrumb className="flex-1">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={() => navigate('/')}
                className="cursor-pointer text-xs"
              >
                Dashboard
              </BreadcrumbLink>
            </BreadcrumbItem>
            {crumb.parent && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs text-muted-foreground">
                    {crumb.parent}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-xs font-semibold">{crumb.label}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon" className="size-8" onClick={refreshAll} disabled={loading} />}>
            <RefreshCw className={cn(loading && 'animate-spin')} />
          </TooltipTrigger>
          <TooltipContent>Refresh all accounts</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon" className="size-8" onClick={() => setTheme(isDark ? 'light' : 'dark')} />}>
            {isDark ? <Sun /> : <Moon />}
          </TooltipTrigger>
          <TooltipContent>{isDark ? 'Light mode' : 'Dark mode'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon" className="size-8" onClick={() => navigate('/settings')} />}>
            <Settings />
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon" className="size-8" onClick={handleSignOut} />}>
            <LogOut />
          </TooltipTrigger>
          <TooltipContent>Sign out ({user?.email})</TooltipContent>
        </Tooltip>

        <Avatar className="size-8 ml-1">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
            {emailInitial}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
