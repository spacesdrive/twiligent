// route matching for the navigation, kept free of React and icons so Node can test it

export interface RouteLink {
  path: string;
  label: string;
}

export interface RouteGroup {
  label: string;
  items: RouteLink[];
}

// parent is the page one level up, linked from the breadcrumb; null on top-level pages
export interface RouteTitle {
  label: string;
  parent: RouteLink | null;
}

export interface DetailRoute {
  prefix: string;
  label: string;
  parent: RouteLink;
}

export const DETAIL_ROUTES: DetailRoute[] = [
  { prefix: '/channel/',                  label: 'YouTube channel',   parent: { path: '/', label: 'Overview' } },
  { prefix: '/instagram/',                label: 'Instagram account', parent: { path: '/', label: 'Overview' } },
  { prefix: '/tracked-content/category/', label: 'Category',          parent: { path: '/tracked-content', label: 'Tracked content' } },
  { prefix: '/automations/rules/new',     label: 'New rule',          parent: { path: '/automations', label: 'Automations' } },
  { prefix: '/automations/rules/',        label: 'Edit rule',         parent: { path: '/automations', label: 'Automations' } },
];

export const APP_NAME = 'Twiligent';

export function matchesPath(path: string, pathname: string): boolean {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}

// the most specific link wins, so a category page marks the category and not Tracked content as well
export function activeNavPath(paths: string[], pathname: string): string | null {
  let best: string | null = null;
  for (const path of paths) {
    if (matchesPath(path, pathname) && (best === null || path.length > best.length)) best = path;
  }
  return best;
}

export function routeTitle(groups: RouteGroup[], pathname: string): RouteTitle | null {
  for (const group of groups) {
    const item = group.items.find(i => i.path === pathname);
    if (item) return { label: item.label, parent: null };
  }
  const detail = DETAIL_ROUTES.find(r => pathname.startsWith(r.prefix));
  return detail ? { label: detail.label, parent: detail.parent } : null;
}

export function documentTitle(pageTitle: string | null | undefined): string {
  return pageTitle ? `${pageTitle} - ${APP_NAME}` : APP_NAME;
}
