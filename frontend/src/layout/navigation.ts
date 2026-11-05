import {
  LayoutDashboard, PlaySquare, Scissors, Clapperboard, Bookmark, Send, CloudUpload, Zap, Users, Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { activeNavPath, routeTitle as titleForRoute } from './routes';
import type { RouteTitle } from './routes';

export type { RouteTitle } from './routes';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Single source for navigation: the sidebar, top bar title and command palette all read from here.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Analytics',
    items: [
      { path: '/',                label: 'Overview',          icon: LayoutDashboard },
      { path: '/videos',          label: 'Videos',            icon: PlaySquare },
      { path: '/shorts',          label: 'Shorts',            icon: Scissors },
      { path: '/instagram',       label: 'Instagram content', icon: Clapperboard },
      { path: '/tracked-content', label: 'Tracked content',   icon: Bookmark },
    ],
  },
  {
    label: 'Publishing',
    items: [
      { path: '/publish',     label: 'Instagram publishing', icon: Send },
      { path: '/youtube-uploads', label: 'YouTube uploads', icon: CloudUpload },
      { path: '/automations', label: 'Instagram automation', icon: Zap },
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

export function routeTitle(pathname: string): RouteTitle | null {
  return titleForRoute(NAV_GROUPS, pathname);
}

// every path the sidebar can link to, so only the most specific one is marked as the current page
export function currentNavPath(extraPaths: string[], pathname: string): string | null {
  const navPaths = NAV_GROUPS.flatMap(group => group.items.map(item => item.path));
  return activeNavPath([...navPaths, ...extraPaths], pathname);
}
