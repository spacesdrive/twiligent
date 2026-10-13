import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSmoothTheme } from '@/hooks/use-smooth-theme';
import { useAuth } from '../context/AuthContext';
import { tabForPath, neighbours } from './nav';
import { useTableOfContents } from './useTableOfContents';
import DocsHeader from './DocsHeader';
import DocsSidebarNav from './DocsSidebarNav';
import DocsPager from './DocsPager';
import DocsToc from './DocsToc';
import DocsMobileNav from './DocsMobileNav';
import DocsSearch from './DocsSearch';

function useSearchShortcut(setSearchOpen) {
  useEffect(() => {
    const onKey = e => {
      const typing = /input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable;
      if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSearchOpen]);
}

export default function DocsLayout() {
  const location = useLocation();
  const { session } = useAuth();
  const { resolvedTheme, setTheme } = useSmoothTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const articleRef = useRef(null);
  const tab = tabForPath(location.pathname);
  const { prev, next } = neighbours(location.pathname);
  const { items: toc, active } = useTableOfContents(articleRef, location.pathname);
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0 });
    else document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location.pathname, location.hash]);

  useSearchShortcut(setSearchOpen);

  const copyPage = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(articleRef.current?.innerText || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, []);

  return (
    <div className="min-h-svh bg-surface text-ink">
      <a href="#docs-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-ink-inverse">Skip to content</a>

      <DocsHeader
        tab={tab}
        signedIn={Boolean(session)}
        isDark={isDark}
        onToggleTheme={() => setTheme(isDark ? 'light' : 'dark')}
        onOpenMenu={() => setMenuOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      <div className="mx-auto flex max-w-[96rem]">
        <aside className="sticky top-[6.25rem] hidden h-[calc(100svh-6.25rem)] w-64 shrink-0 overflow-y-auto border-r border-line px-4 py-6 lg:block">
          <DocsSidebarNav tab={tab} />
        </aside>

        <main id="docs-content" className="min-w-0 flex-1 px-5 py-10 sm:px-8 lg:px-12">
          <div className="mx-auto flex max-w-[50rem] flex-col">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="eyebrow text-brand-text">{tab.label}</p>
              <Button variant="outline" size="xs" onClick={copyPage} aria-label="Copy this page as text">
                {copied ? <Check className="text-success" /> : <Copy />}
                {copied ? 'Copied' : 'Copy page'}
              </Button>
            </div>
            <article ref={articleRef} className="animate-fold-in">
              <Suspense fallback={<div className="flex flex-col gap-4"><Skeleton className="h-11 w-2/3" /><Skeleton className="h-5 w-full" /><Skeleton className="h-64 rounded-card" /></div>}>
                <Outlet />
              </Suspense>
            </article>

            <DocsPager prev={prev} next={next} />
          </div>
        </main>

        <aside className="sticky top-[6.25rem] hidden h-[calc(100svh-6.25rem)] w-60 shrink-0 overflow-y-auto py-10 pr-6 xl:block">
          <DocsToc items={toc} active={active} />
        </aside>
      </div>

      <DocsMobileNav tab={tab} open={menuOpen} onOpenChange={setMenuOpen} />

      <DocsSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
