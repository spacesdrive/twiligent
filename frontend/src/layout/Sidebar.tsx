import React, { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSmoothTheme } from '@/hooks/use-smooth-theme';
import { Search, Tag, Settings, LogOut, Sun, Moon, Monitor, ChevronsUpDown, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
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
import { NAV_GROUPS, currentNavPath } from './navigation';
import type { NavGroup } from './navigation';
import { shortcutLabel } from './shortcuts';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { docsUrl } from '@/lib/docs';

// long account or category lists would push Settings far down, so each shows this many until expanded
const LIST_CAP = 6;

export interface AppSidebarProps {
  categories: string[];
  onOpenPalette: () => void;
  onSignOut: () => void;
}

interface DynamicLink {
  key: string;
  path: string;
  label: string;
  icon: ReactNode;
}

type RenderNavLink = (path: string, label: string, children: ReactNode) => ReactNode;

function categoryPath(category: string): string {
  return `/tracked-content/category/${encodeURIComponent(category)}`;
}

export default function AppSidebar({ categories, onOpenPalette, onSignOut }: AppSidebarProps) {
  const location = useLocation();
  const { accounts } = useAppContext();
  const { setOpenMobile } = useSidebar();

  const accountLinks: DynamicLink[] = accounts.map(account => ({
    key: account.id,
    path: accountPath(account),
    label: accountName(account),
    icon: <AccountAvatar account={account} size="xs" decorative />,
  }));
  const categoryLinks: DynamicLink[] = categories.map(category => ({
    key: category,
    path: categoryPath(category),
    label: category,
    icon: <Tag />,
  }));
  const activePath = currentNavPath([...accountLinks, ...categoryLinks].map(link => link.path), location.pathname);

  const nav: RenderNavLink = (path, label, children) => (
    <SidebarMenuButton
      isActive={path === activePath}
      aria-current={path === activePath ? 'page' : undefined}
      tooltip={label}
      render={<Link to={path} onClick={() => setOpenMobile(false)} />}
    >
      {children}
    </SidebarMenuButton>
  );

  const staticGroup = (group: NavGroup) => (
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
  );

  // Manage (Accounts, Settings) closes the list, after the lists that grow with the person's data
  const manageGroup = NAV_GROUPS[NAV_GROUPS.length - 1];
  const mainGroups = NAV_GROUPS.slice(0, -1);
  const searchLabel = `Search (${shortcutLabel('K')})`;

  return (
    <Sidebar collapsible="icon" className="border-r border-line">
      <SidebarHeader className="gap-3 px-3 pt-4 pb-2">
        <Link
          to="/"
          aria-label="Twiligent overview"
          className="flex h-8 items-center rounded-row px-1"
        >
          <Logo variant="mark" className="h-6" />
          <Logo variant="wordmark" className="ml-2 h-4 transition-opacity duration-(--duration-base) group-data-[collapsible=icon]:opacity-0" />
        </Link>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={searchLabel}
              onClick={onOpenPalette}
              className="border border-line bg-surface-raised text-ink-muted hover:text-ink group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent"
            >
              <Search className="size-4!" />
              <span className="flex-1">Search</span>
              <kbd className="font-mono text-caption text-ink-faint group-data-[collapsible=icon]:hidden">{shortcutLabel('K')}</kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-1 px-1">
        <nav aria-label="Main" className="flex flex-col gap-1">
          {mainGroups.map(staticGroup)}
          <CappedGroup label="Your accounts" noun="accounts" links={accountLinks} activePath={activePath} renderLink={nav} />
          <CappedGroup label="Categories" noun="categories" links={categoryLinks} activePath={activePath} renderLink={nav} />
          {staticGroup(manageGroup)}
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-t border-line p-2">
        <UserMenu onSignOut={onSignOut} />
      </SidebarFooter>
    </Sidebar>
  );
}

interface CappedGroupProps {
  label: string;
  noun: string;
  links: DynamicLink[];
  activePath: string | null;
  renderLink: RenderNavLink;
}

// the current page stays visible even when it sits past the cap
function CappedGroup({ label, noun, links, activePath, renderLink }: CappedGroupProps) {
  const [expanded, setExpanded] = useState(false);
  if (links.length === 0) return null;
  const overCap = links.length > LIST_CAP;
  const shown = !overCap || expanded
    ? links
    : links.filter((link, index) => index < LIST_CAP || link.path === activePath);
  const toggleLabel = expanded ? `Show fewer ${noun}` : `Show all ${links.length} ${noun}`;

  return (
    <SidebarGroup className="py-1">
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu className="gap-0.5">
        {shown.map(link => (
          <SidebarMenuItem key={link.key}>
            {renderLink(link.path, link.label, <>{link.icon}<span>{link.label}</span></>)}
          </SidebarMenuItem>
        ))}
        {overCap && (
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={toggleLabel} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
              {expanded ? <ChevronUp /> : <ChevronDown />}
              <span>{toggleLabel}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function UserMenu({ onSignOut }: { onSignOut: () => void }) {
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
            <Avatar className="size-7" aria-hidden="true">
              <AvatarFallback className="bg-brand text-caption font-semibold text-on-brand">{initial}</AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-1 flex-col text-left">
              <span className="truncate text-sm font-medium text-ink">{email.split('@')[0] || 'Account'}</span>
              <span className="truncate text-caption font-normal text-ink-muted">{email}</span>
            </span>
            <ChevronsUpDown className="size-4! text-ink-faint" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-(--anchor-width) min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-caption text-ink-muted">Theme</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                <DropdownMenuRadioItem value="light"><Sun />Light</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark"><Moon />Dark</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system"><Monitor />Match system</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}><Settings />Settings</DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(docsUrl(), '_blank', 'noopener')}>
              <BookOpen />Documentation<span className="sr-only"> (opens in a new tab)</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSignOut}><LogOut />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
