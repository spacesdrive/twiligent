import { Bookmark, Chart, Checklist, Layers, Library, Plane, Server, ShieldCheck, UsersGroup } from './icons';
import type { Icon } from './icons';
import { GitHubIcon } from './marks';
import { GITHUB_URL } from '@/lib/links';
import type { ComponentType } from 'react';

export interface MenuItem {
  title: string;
  description: string;
  href: string;
  icon: Icon | ComponentType<{ className?: string }>;
}

export interface MenuColumn {
  heading: string;
  items: MenuItem[];
}

export interface Menu {
  id: string;
  label: string;
  columns: MenuColumn[];
}

// wide and short: each menu is two or three columns side by side
export const MENUS: Menu[] = [
  {
    id: 'product',
    label: 'Product',
    columns: [
      {
        heading: 'See',
        items: [
          {
            title: 'Analytics',
            description: 'YouTube, Instagram and Reddit side by side',
            href: '/#analytics',
            icon: Chart,
          },
          {
            title: 'Libraries',
            description: 'Every video, reel and post in one list',
            href: '/docs/use/analytics',
            icon: Library,
          },
        ],
      },
      {
        heading: 'Publish',
        items: [
          {
            title: 'Publishing',
            description: 'Photos, Reels and Stories, now or later',
            href: '/#publishing',
            icon: Plane,
          },
          {
            title: 'Bulk upload',
            description: 'Many files at once, spaced out',
            href: '/docs/use/publishing',
            icon: Layers,
          },
        ],
      },
      {
        heading: 'Follow',
        items: [
          {
            title: 'Tracked content',
            description: 'Any post or video, by its link',
            href: '/docs/use/tracked-content',
            icon: Bookmark,
          },
          { title: 'Teams', description: 'Members and the administrator', href: '/docs/concepts', icon: UsersGroup },
        ],
      },
    ],
  },
  {
    id: 'self-host',
    label: 'Run your own',
    columns: [
      {
        heading: 'Start',
        items: [
          {
            title: 'Self-hosting overview',
            description: 'What you need and what it costs',
            href: '/docs/self-host',
            icon: Server,
          },
          {
            title: 'Launch checklist',
            description: 'Check it before you invite anyone',
            href: '/docs/self-host/checklist',
            icon: Checklist,
          },
        ],
      },
      {
        heading: 'Open source',
        items: [
          { title: 'GitHub', description: 'Read every line', href: GITHUB_URL, icon: GitHubIcon },
          {
            title: 'Security',
            description: 'How keys and data stay private',
            href: '/docs/reference/security',
            icon: ShieldCheck,
          },
        ],
      },
    ],
  },
];

export const BAR_LINKS = [{ label: 'Docs', href: '/docs' }];
