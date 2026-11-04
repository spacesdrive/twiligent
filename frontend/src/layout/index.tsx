import React, { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import CommandPalette from '@/components/CommandPalette';
import { useCommandPaletteShortcut } from '@/hooks/use-command-palette-shortcut';
import { PageSkeleton } from '@/components/StateViews';
import AppSidebar from './Sidebar';
import TopBar from './Header';
import { routeTitle } from './navigation';
import { documentTitle } from './routes';
import { requestHeadingFocus } from './routeFocus';
import type { ShellOutletContext } from './shellContext';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function AppShell() {
  const navigate = useNavigate();
  const { accounts, refreshAll } = useAppContext();
  const { signOut } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  useCommandPaletteShortcut(setPaletteOpen);
  useRouteAnnouncement();

  useEffect(() => {
    api.getTrackedContent()
      .then(data => {
        const items = Array.isArray(data) ? data : [];
        setCategories([...new Set(items.map(p => p.category).filter(Boolean))].sort());
      })
      .catch(() => {});
  }, []);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate('/login');
  }, [signOut, navigate]);

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-pill focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-ink-inverse"
      >
        Skip to content
      </a>
      <AppSidebar categories={categories} onOpenPalette={openPalette} onSignOut={handleSignOut} />
      <SidebarInset className="min-w-0">
        <TopBar onOpenPalette={openPalette} />
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          <div className="mx-auto w-full max-w-(--content-max) px-4 py-6 sm:px-5">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet context={{ openPalette } satisfies ShellOutletContext} />
            </Suspense>
          </div>
        </main>
      </SidebarInset>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        accounts={accounts}
        categories={categories}
        onRefreshAll={refreshAll}
        onSignOut={handleSignOut}
      />
    </SidebarProvider>
  );
}

// each route names the browser tab, and a client-side navigation moves focus to the new page like a page load would
function useRouteAnnouncement() {
  const { pathname } = useLocation();
  const firstRender = useRef(true);

  // layout effects run before every passive effect, so the new page's heading (and useDocumentTitle) act after this
  useLayoutEffect(() => {
    document.title = documentTitle(routeTitle(pathname)?.label);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    requestHeadingFocus();
    document.getElementById('main-content')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [pathname]);
}
