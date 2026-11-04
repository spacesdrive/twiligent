import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { cn } from '@/lib/cn';
import { GITHUB_URL, SIGN_UP_URL } from '@/lib/links';
import { AltArrowRight, CloseCircle, HamburgerMenu } from '@/components/icons';
import { GitHubIcon } from '@/components/marks';
import { Logo } from '@/components/brand';
import { Pill } from '@/components/Pill';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ScrollManager } from '@/components/ScrollManager';
import { DOC_TABS, docEntry, slugFromPath } from './nav';
import { DocsSidebar } from './DocsSidebar';
import { Search } from './Search';

// the docs frame from the Activepieces docs: a top bar with search, a row of tabs, the sidebar, the page and its outline
export default function DocsLayout() {
  const { pathname } = useLocation();
  const entry = docEntry(slugFromPath(pathname));
  const tab = entry?.tab ?? DOC_TABS[0];
  const [drawer, setDrawer] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  // a native modal dialog keeps focus inside the drawer, makes the page behind it inert and closes on Escape
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (drawer && !node.open) node.showModal();
    if (!drawer && node.open) node.close();
  }, [drawer]);

  // focus goes back to the menu button, unless a link already moved it to the new page
  const onDialogClose = () => {
    setDrawer(false);
    const active = document.activeElement;
    if (!active || active === document.body || dialog.current?.contains(active)) menuButton.current?.focus();
  };

  return (
    <div data-docs-layout className="min-h-svh bg-surface">
      <ScrollManager />
      <a
        href="#doc-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-full focus:bg-surface-raised focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 md:px-8">
          <Link to="/docs" aria-label="Twiligent docs home" className="flex shrink-0 items-center gap-2">
            <Logo className="h-6" />
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-semibold text-ink-muted">
              Docs
            </span>
          </Link>
          <Search className="mx-auto hidden w-full max-w-md md:block" />
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink lg:flex"
            >
              <GitHubIcon className="size-4" />
              GitHub
            </a>
            <Link
              to="/"
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink lg:block"
            >
              Twiligent home
            </Link>
            <span className="ml-1 hidden sm:inline-flex">
              <Pill href={SIGN_UP_URL} size="sm" className="pr-3">
                Create account
                <AltArrowRight className="size-4" />
              </Pill>
            </span>
            <ThemeToggle />
          </div>
        </div>
        <nav
          aria-label="Docs sections"
          className="mx-auto hidden h-12 max-w-[1440px] items-end gap-6 px-4 md:flex md:px-8"
        >
          {DOC_TABS.map(t => {
            const first = t.groups[0].pages[0];
            return (
              <Link
                key={t.id}
                to={first.slug ? `/docs/${first.slug}` : '/docs'}
                aria-current={t.id === tab.id ? 'true' : undefined}
                className={cn(
                  'border-b-2 pb-3 text-[15px] font-medium transition-colors',
                  t.id === tab.id ? 'border-accent text-ink' : 'border-transparent text-ink-muted hover:text-ink',
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex h-12 items-center gap-3 border-t border-line px-4 md:hidden">
          <button
            ref={menuButton}
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Open the docs menu"
            aria-expanded={drawer}
            aria-controls="docs-menu"
            className="flex size-9 items-center justify-center rounded-md text-ink hover:bg-surface-sunken"
          >
            <HamburgerMenu className="size-5" />
          </button>
          <p className="flex min-w-0 items-center gap-1.5 truncate text-sm">
            <span className="text-ink-muted">{entry?.group.label ?? tab.label}</span>
            <AltArrowRight className="size-3.5 shrink-0 text-ink-muted" />
            <span className="truncate font-medium text-ink">{entry?.title ?? 'Docs'}</span>
          </p>
        </div>
      </header>

      <dialog
        ref={dialog}
        id="docs-menu"
        aria-label="Docs menu"
        onClose={onDialogClose}
        // a click on the dimmed backdrop lands on the dialog itself, outside the drawer panel
        onClick={event => event.target === event.currentTarget && setDrawer(false)}
        className="m-0 h-dvh max-h-dvh w-[min(20rem,85vw)] max-w-none bg-surface p-0 text-ink shadow-lg backdrop:bg-dusk/60 md:hidden"
      >
        {drawer && (
          <div className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-4">
            <div className="flex items-center justify-between px-3">
              <Logo className="h-6" />
              <button
                type="button"
                autoFocus
                onClick={() => setDrawer(false)}
                aria-label="Close the docs menu"
                className="flex size-9 items-center justify-center rounded-md text-ink hover:bg-surface-sunken"
              >
                <CloseCircle className="size-6" />
              </button>
            </div>
            <Search className="px-3" />
            <nav aria-label="Docs sections" className="flex flex-wrap gap-2 px-3">
              {DOC_TABS.map(t => {
                const first = t.groups[0].pages[0];
                return (
                  <Link
                    key={t.id}
                    to={first.slug ? `/docs/${first.slug}` : '/docs'}
                    onClick={() => setDrawer(false)}
                    aria-current={t.id === tab.id ? 'true' : undefined}
                    className={cn(
                      'rounded-full px-3 py-1 text-sm',
                      t.id === tab.id
                        ? 'bg-accent-soft font-medium text-accent-text'
                        : 'bg-surface-sunken text-ink-muted',
                    )}
                  >
                    {t.label}
                  </Link>
                );
              })}
            </nav>
            <DocsSidebar tab={tab} current={entry} onNavigate={() => setDrawer(false)} />
          </div>
        )}
      </dialog>

      <div className="mx-auto flex max-w-[1440px] gap-10 px-4 md:px-8">
        <aside className="sticky top-28 hidden h-[calc(100svh-7rem)] w-64 shrink-0 overflow-y-auto py-8 pr-2 md:block">
          <DocsSidebar tab={tab} current={entry} />
        </aside>
        <main className="flex min-w-0 flex-1 gap-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
