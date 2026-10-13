// tabs, sidebar groups and pages; routes.ts maps each page to its component

export interface DocPage {
  slug: string;
  title: string;
  keywords: string[];
}

export interface DocGroup {
  label: string | null;
  pages: DocPage[];
}

export interface DocTab {
  id: string;
  label: string;
  groups: DocGroup[];
}

export interface DocPageEntry extends DocPage {
  tabId: string;
  tabLabel: string;
  path: string;
}

export interface DocNeighbours {
  prev: DocPageEntry | null;
  next: DocPageEntry | null;
}

export const DOC_TABS: DocTab[] = [
  {
    id: 'overview',
    label: 'Overview',
    groups: [
      {
        label: null,
        pages: [
          { slug: '', title: 'Introduction', keywords: ['start', 'what is twiligent', 'paths'] },
          { slug: 'concepts', title: 'Members and administrators', keywords: ['instance', 'roles', 'who does what', 'shared'] },
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
          { slug: 'use/getting-started', title: 'Sign in and first steps', keywords: ['account', 'sign up', 'login'] },
          { slug: 'use/connect-accounts', title: 'Connect your accounts', keywords: ['youtube', 'instagram', 'reddit', 'tester', 'cookie'] },
        ],
      },
      {
        label: 'Work with Twiligent',
        pages: [
          { slug: 'use/analytics', title: 'Read your analytics', keywords: ['overview', 'videos', 'shorts', 'reels', 'charts'] },
          { slug: 'use/publishing', title: 'Publish and schedule', keywords: ['instagram', 'post', 'reel', 'story', 'bulk', 'schedule'] },
          { slug: 'use/tracked-content', title: 'Track content', keywords: ['reddit posts', 'youtube videos', 'categories', 'views'] },
        ],
      },
      {
        label: 'Help',
        pages: [
          { slug: 'use/troubleshooting', title: 'Troubleshooting', keywords: ['errors', 'pending', 'failed', 'contact', 'administrator'] },
        ],
      },
    ],
  },
  {
    id: 'self-host',
    label: 'Run your own',
    groups: [
      {
        label: 'Plan',
        pages: [
          { slug: 'self-host', title: 'Self-hosting overview', keywords: ['requirements', 'cost', 'accounts needed', 'architecture'] },
        ],
      },
      {
        label: 'Set up services',
        pages: [
          { slug: 'self-host/supabase', title: 'Supabase', keywords: ['database', 'auth', 'sql', 'rls', 'keys'] },
          { slug: 'self-host/google-sign-in', title: 'Sign in with Google (optional)', keywords: ['google', 'oauth', 'login', 'branding', 'logo', 'verification'] },
          { slug: 'self-host/email-codes', title: 'Email verification codes (optional)', keywords: ['email', 'resend', 'smtp', 'confirm', 'otp', 'code', 'sign up', 'hook'] },
          { slug: 'self-host/youtube', title: 'YouTube API key', keywords: ['google cloud', 'data api'] },
          { slug: 'self-host/instagram', title: 'Instagram app', keywords: ['meta', 'facebook', 'oauth', 'redirect', 'tester', 'app review'] },
          { slug: 'self-host/cloudinary', title: 'Cloudinary', keywords: ['media', 'upload preset', 'cdn'] },
          { slug: 'self-host/redis', title: 'Upstash Redis (optional)', keywords: ['cache', 'redis'] },
        ],
      },
      {
        label: 'Deploy',
        pages: [
          { slug: 'self-host/deploy-backend', title: 'Deploy the backend', keywords: ['cloudflare', 'worker', 'wrangler', 'secrets'] },
          { slug: 'self-host/deploy-frontend', title: 'Deploy the frontend', keywords: ['cloudflare pages', 'vite', 'env'] },
          { slug: 'self-host/github', title: 'GitHub automation', keywords: ['actions', 'scheduling backup', 'deploy on push'] },
          { slug: 'self-host/checklist', title: 'Launch checklist', keywords: ['verify', 'test', 'done'] },
        ],
      },
    ],
  },
  {
    id: 'reference',
    label: 'Reference',
    groups: [
      {
        label: null,
        pages: [
          { slug: 'reference/environment', title: 'Environment variables', keywords: ['keys', 'secrets', 'config', 'env'] },
          { slug: 'reference/scheduling', title: 'How scheduling works', keywords: ['cron', 'status', 'pending', 'claim'] },
          { slug: 'reference/security', title: 'Security', keywords: ['rls', 'service key', 'tokens', 'signups'] },
          { slug: 'reference/faq', title: 'FAQ', keywords: ['questions', 'cost', 'limits'] },
        ],
      },
    ],
  },
];

export const ALL_DOC_PAGES: DocPageEntry[] = DOC_TABS.flatMap(tab => tab.groups.flatMap(group => group.pages.map(page => ({
  ...page,
  tabId: tab.id,
  tabLabel: tab.label,
  path: page.slug ? `/docs/${page.slug}` : '/docs',
}))));

export function tabForPath(pathname: string): DocTab {
  const page = ALL_DOC_PAGES.find(p => p.path === pathname);
  return DOC_TABS.find(t => t.id === page?.tabId) || DOC_TABS[0];
}

export function neighbours(pathname: string): DocNeighbours {
  const i = ALL_DOC_PAGES.findIndex(p => p.path === pathname);
  return { prev: i > 0 ? ALL_DOC_PAGES[i - 1] : null, next: i >= 0 && i < ALL_DOC_PAGES.length - 1 ? ALL_DOC_PAGES[i + 1] : null };
}

export function firstPagePath(tab: DocTab): string {
  const page = tab.groups[0].pages[0];
  return page.slug ? `/docs/${page.slug}` : '/docs';
}
