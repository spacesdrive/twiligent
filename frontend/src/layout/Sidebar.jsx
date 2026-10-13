import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSmoothTheme } from '@/hooks/use-smooth-theme';
import { Search, Tag, Settings, LogOut, Sun, Moon, Monitor, ChevronsUpDown, BookOpen } from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Logo } from '@/components/brand/Logo';
import { AccountAvatar } from '@/components/platform';
import { accountName, accountPath } from '@/lib/accounts';
import { NAV_GROUPS, isNavActive } from './navigation';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export default function AppSidebar({ categories, onOpenPalette, onSignOut }) {
  const location = useLocation();
  const { accounts } = useAppContext();
  const { setOpenMobile } = useSidebar();

  const nav = (path, label, children, tooltip = label) => (
    <SidebarMenuButton
      isActive={isNavActive(path, location.pathname)}
      tooltip={tooltip}
      render={<Link to={path} onClick={() => setOpenMobile(false)} />}
    >
      {children}
    </SidebarMenuButton>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-line">
      <SidebarHeader className="gap-3 px-3 pt-4 pb-2">
        <Link
          to="/"
          aria-label="Twiligent overview"
          className="flex h-8 items-center rounded-row px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <Logo className="h-6 group-data-[collapsible=icon]:hidden" />
          <Logo variant="mark" className="hidden h-6 group-data-[collapsible=icon]:block" />
        </Link>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Search"
              onClick={onOpenPalette}
              className="border border-line bg-surface-raised text-ink-faint hover:text-ink group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent"
            >
              <Search className="size-4!" />
              <span className="flex-1">Search</span>
              <kbd className="font-mono text-caption text-ink-faint group-data-[collapsible=icon]:hidden">{isMac ? 'Cmd K' : 'Ctrl K'}</kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-1 px-1">
        {NAV_GROUPS.map(group => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              {group.items.map(item => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.path}>
                    {nav(item.path, item.label, <><Icon /><span>{item.label}</span></>)}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}

        {accounts.length > 0 && (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel>Accounts</SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              {accounts.map(account => {
                const path = accountPath(account);
                return (
                  <SidebarMenuItem key={account.id}>
                    {nav(path, accountName(account), (
                      <>
                        <AccountAvatar account={account} size="xs" />
                        <span>{accountName(account)}</span>
                      </>
                    ))}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {categories.length > 0 && (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel>Categories</SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              {categories.map(category => {
                const path = `/tracked-content/category/${encodeURIComponent(category)}`;
                return (
                  <SidebarMenuItem key={category}>
                    {nav(path, category, <><Tag /><span>{category}</span></>)}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-line p-2">
        <UserMenu onSignOut={onSignOut} />
      </SidebarFooter>
    </Sidebar>
  );
}

function UserMenu({ onSignOut }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, setTheme } = useSmoothTheme();
  const email = user?.email ?? '';
  const initial = email[0]?.toUpperCase() ?? 'T';

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" tooltip={email || 'Account'} className="data-popup-open:bg-surface-selected" />}
          >
            <Avatar className="size-7">
              <AvatarFallback className="bg-brand text-caption font-semibold text-on-brand">{initial}</AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-1 flex-col text-left">
              <span className="truncate text-sm font-medium text-ink">{email.split('@')[0] || 'Account'}</span>
              <span className="truncate text-caption font-normal text-ink-faint">{email}</span>
            </span>
            <ChevronsUpDown className="size-4! text-ink-faint" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-(--anchor-width) min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-caption text-ink-faint">Theme</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                <DropdownMenuRadioItem value="light"><Sun />Light</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark"><Moon />Dark</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system"><Monitor />Match system</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}><Settings />Settings</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/docs')}><BookOpen />Documentation</DropdownMenuItem>
            <DropdownMenuItem onClick={onSignOut}><LogOut />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
