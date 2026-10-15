import type { ComponentType } from 'react';
import {
  Book,
  Bookmark,
  Calendar,
  Chart,
  ChatDots,
  Checklist,
  Cloud,
  CloudUpload,
  CodeFile,
  Database,
  Gallery,
  Key,
  Letter,
  Login,
  Plane,
  Plug,
  QuestionCircle,
  Server,
  ServerSquare,
  ShieldCheck,
  UsersGroup,
} from '@/components/icons';
import { GitHubIcon, InstagramIcon, YouTubeIcon } from '@/components/marks';

// the docs tabs, sidebar groups and pages; each page is content/docs/<slug>.mdx, and '' is index.mdx

export interface DocPage {
  slug: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
}

export interface DocGroup {
  label: string;
  pages: DocPage[];
}

export interface DocTab {
  id: string;
  label: string;
  groups: DocGroup[];
}

export const DOC_TABS: DocTab[] = [
  {
    id: 'overview',
    label: 'Overview',
    groups: [
      {
        label: 'Overview',
        pages: [
          { slug: '', title: 'Introduction', icon: Book },
          { slug: 'concepts', title: 'Members and administrators', icon: UsersGroup },
        ],
      },
    ],
  },
  {
    id: 'use',
    label: 'Using Twiligent',
    groups: [
      {
        label: 'Get started',
        pages: [
          { slug: 'use/getting-started', title: 'Sign in and first steps', icon: Login },
          { slug: 'use/connect-accounts', title: 'Connect your accounts', icon: Plug },
        ],
      },
      {
        label: 'Work with Twiligent',
        pages: [
          { slug: 'use/analytics', title: 'Read your analytics', icon: Chart },
          { slug: 'use/publishing', title: 'Publish and schedule', icon: Plane },
          { slug: 'use/tracked-content', title: 'Track content', icon: Bookmark },
        ],
      },
      {
        label: 'Help',
        pages: [{ slug: 'use/troubleshooting', title: 'Troubleshooting', icon: QuestionCircle }],
      },
    ],
  },
  {
    id: 'self-host',
    label: 'Run your own',
    groups: [
      {
        label: 'Plan',
        pages: [{ slug: 'self-host', title: 'Self-hosting overview', icon: Server }],
      },
      {
        label: 'Set up services',
        pages: [
          { slug: 'self-host/supabase', title: 'Supabase', icon: Database },
          { slug: 'self-host/google-sign-in', title: 'Sign in with Google (optional)', icon: Key },
          { slug: 'self-host/email-codes', title: 'Email verification codes (optional)', icon: Letter },
          { slug: 'self-host/youtube', title: 'YouTube API key', icon: YouTubeIcon },
          { slug: 'self-host/instagram', title: 'Instagram app', icon: InstagramIcon },
          { slug: 'self-host/cloudinary', title: 'Cloudinary', icon: Gallery },
          { slug: 'self-host/redis', title: 'Upstash Redis (optional)', icon: ServerSquare },
        ],
      },
      {
        label: 'Deploy',
        pages: [
          { slug: 'self-host/deploy-backend', title: 'Deploy the backend', icon: Cloud },
          { slug: 'self-host/deploy-frontend', title: 'Deploy the frontend', icon: CloudUpload },
          { slug: 'self-host/github', title: 'GitHub automation', icon: GitHubIcon },
          { slug: 'self-host/checklist', title: 'Launch checklist', icon: Checklist },
        ],
      },
    ],
  },
  {
    id: 'reference',
    label: 'Reference',
    groups: [
      {
        label: 'Reference',
        pages: [
          { slug: 'reference/environment', title: 'Environment variables', icon: CodeFile },
          { slug: 'reference/scheduling', title: 'How scheduling works', icon: Calendar },
          { slug: 'reference/security', title: 'Security', icon: ShieldCheck },
          { slug: 'reference/faq', title: 'FAQ', icon: ChatDots },
        ],
      },
    ],
  },
];

export interface DocEntry extends DocPage {
  tab: DocTab;
  group: DocGroup;
  path: string;
}

const DOC_ENTRIES: DocEntry[] = DOC_TABS.flatMap(tab =>
  tab.groups.flatMap(group =>
    group.pages.map(page => ({ ...page, tab, group, path: page.slug ? `/docs/${page.slug}` : '/docs' })),
  ),
);

export function docEntry(slug: string): DocEntry | undefined {
  return DOC_ENTRIES.find(entry => entry.slug === slug);
}

export function docNeighbours(slug: string): { prev: DocEntry | null; next: DocEntry | null } {
  const index = DOC_ENTRIES.findIndex(entry => entry.slug === slug);
  return { prev: DOC_ENTRIES[index - 1] ?? null, next: DOC_ENTRIES[index + 1] ?? null };
}

// the slug of a docs URL: /docs/self-host/redis -> self-host/redis, /docs -> ''
export function slugFromPath(pathname: string): string {
  return pathname.replace(/^\/docs\/?/, '').replace(/\/$/, '');
}
