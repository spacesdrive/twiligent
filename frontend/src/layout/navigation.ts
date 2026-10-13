import {
  LayoutDashboard, PlaySquare, Scissors, Clapperboard, MessagesSquare, Bookmark, Send, Users, Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// parent is null for the overview, which sits at the top of the breadcrumb
export interface RouteTitle {
  label: string;
  parent: string | null;
}

interface DetailRoute {
  prefix: string;
  label: string;
  parent: string;
}

// Single source for navigation: the sidebar, top bar title and command palette all read from here.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Analytics',
    items: [
      { path: '/',                label: 'Overview',          icon: LayoutDashboard },
      { path: '/videos',          label: 'Videos',            icon: PlaySquare },
      { path: '/shorts',          label: 'Shorts',            icon: Scissors },
      { path: '/reels',           label: 'Instagram content', icon: Clapperboard },
      { path: '/reddit-posts',    label: 'Reddit posts',      icon: MessagesSquare },
      { path: '/tracked-content', label: 'Tracked content',   icon: Bookmark },
    ],
  },
  {
    label: 'Publishing',
    items: [
      { path: '/upload', label: 'Publish', icon: Send },
    ],
  },
  {
    label: 'Manage',
    items: [
      { path: '/accounts', label: 'Accounts', icon: Users },
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const DETAIL_ROUTES: DetailRoute[] = [
  { prefix: '/channel/',                   label: 'YouTube channel',   parent: 'Analytics' },
  { prefix: '/instagram/',                 label: 'Instagram account', parent: 'Analytics' },
  { prefix: '/reddit/',                    label: 'Reddit account',    parent: 'Analytics' },
  { prefix: '/reddit-posts/',              label: 'Reddit posts',      parent: 'Analytics' },
  { prefix: '/tracked-content/category/',  label: 'Category',          parent: 'Tracked content' },
];

export function isNavActive(path: string, pathname: string): boolean {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function routeTitle(pathname: string): RouteTitle | null {
  for (const group of NAV_GROUPS) {
    const item = group.items.find(i => i.path === pathname);
    if (item) return { label: item.label, parent: item.path === '/' ? null : group.label };
  }
  const detail = DETAIL_ROUTES.find(r => pathname.startsWith(r.prefix));
  return detail ? { label: detail.label, parent: detail.parent } : null;
}
