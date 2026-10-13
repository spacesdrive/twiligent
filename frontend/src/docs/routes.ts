import { createElement, lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import { Navigate } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';

// Each section is one chunk; the pages inside it are named exports.
const sections = {
  overview: () => import('./pages/Overview'),
  use: () => import('./pages/Use'),
  selfHost: () => import('./pages/SelfHost'),
  reference: () => import('./pages/Reference'),
};

type Sections = typeof sections;
type SectionName = keyof Sections;
type PageName<S extends SectionName> = keyof Awaited<ReturnType<Sections[S]>>;
export type DocPageComponent = LazyExoticComponent<ComponentType>;

function page<S extends SectionName>(section: S, name: PageName<S>): DocPageComponent {
  return lazy(() => sections[section]().then(m => ({ default: (m as unknown as Record<PageName<S>, ComponentType>)[name] })));
}

const PAGES: Record<string, DocPageComponent> = {
  '': page('overview', 'Introduction'),
  concepts: page('overview', 'Concepts'),
  'use/getting-started': page('use', 'GettingStarted'),
  'use/connect-accounts': page('use', 'ConnectAccounts'),
  'use/analytics': page('use', 'Analytics'),
  'use/publishing': page('use', 'Publishing'),
  'use/tracked-content': page('use', 'TrackedContent'),
  'use/troubleshooting': page('use', 'Troubleshooting'),
  'self-host': page('selfHost', 'Overview'),
  'self-host/supabase': page('selfHost', 'Supabase'),
  'self-host/google-sign-in': page('selfHost', 'GoogleSignIn'),
  'self-host/email-codes': page('selfHost', 'EmailCodes'),
  'self-host/youtube': page('selfHost', 'YouTube'),
  'self-host/instagram': page('selfHost', 'Instagram'),
  'self-host/cloudinary': page('selfHost', 'Cloudinary'),
  'self-host/redis': page('selfHost', 'Redis'),
  'self-host/deploy-backend': page('selfHost', 'DeployBackend'),
  'self-host/deploy-frontend': page('selfHost', 'DeployFrontend'),
  'self-host/github': page('selfHost', 'GitHub'),
  'self-host/checklist': page('selfHost', 'Checklist'),
  'reference/environment': page('reference', 'Environment'),
  'reference/scheduling': page('reference', 'Scheduling'),
  'reference/security': page('reference', 'Security'),
  'reference/faq': page('reference', 'FAQ'),
};

export const DOC_ROUTE_SLUGS: string[] = Object.keys(PAGES);

export const docsChildRoutes: RouteObject[] = [
  ...Object.entries(PAGES).map(([slug, Component]) => (slug ? { path: slug, Component } : { index: true, Component })),
  { path: '*', element: createElement(Navigate, { to: '/docs', replace: true }) },
];
