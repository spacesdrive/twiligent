import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Search, Sun, Moon, Menu, ArrowUp, ArrowLeft, ArrowRight, Copy, Check, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Logo } from '@/components/brand/Logo';
import { useSmoothTheme } from '@/hooks/use-smooth-theme';
import { filterCommands, groupCommands } from '@/lib/commandSearch';
import { useAuth } from '../context/AuthContext';
import { DOC_TABS, ALL_DOC_PAGES, tabForPath, neighbours } from './nav';
import { cn } from '@/lib/utils';

function SidebarNav({ tab, onNavigate }) {
  return (
    <nav aria-label={`${tab.label} pages`} className="flex flex-col gap-6">
      {tab.groups.map((group, i) => (
        <div key={group.label || i} className="flex flex-col gap-0.5">
          {group.label && <p className="mb-1 px-2 text-small font-semibold text-ink">{group.label}</p>}
          {group.pages.map(page => {
            const path = page.slug ? `/docs/${page.slug}` : '/docs';
            return (
              <NavLink
                key={path}
                to={path}
                end
                onClick={onNavigate}
                className={({ isActive }) => cn(
                  'rounded-row px-2 py-2 text-sm leading-[1.1rem] transition-colors duration-(--duration-base)',
                  isActive ? 'bg-surface-selected font-medium text-ink' : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
                )}
              >
                {page.title}
              </NavLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function DocsSearch({ open, onOpenChange }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const commands = useMemo(() => ALL_DOC_PAGES.map(p => ({ id: p.path, label: p.title, group: p.tabLabel, keywords: p.keywords, path: p.path })), []);
  const grouped = useMemo(() => groupCommands(filterCommands(commands, query)), [commands, query]);
  const close = next => { if (!next) setQuery(''); onOpenChange(next); };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent showCloseButton={false} className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Search the documentation</DialogTitle>
        <DialogDescription className="sr-only">Find a page by title or topic</DialogDescription>
        <Command shouldFilter={false} loop>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Search the docs, for example Instagram tester" />
          <CommandList>
            <CommandEmpty>No pages match "{query}"</CommandEmpty>
            {grouped.map(({ group, items }) => (
              <CommandGroup key={group} heading={group}>
                {items.map(item => (
                  <CommandItem key={item.id} value={item.id} onSelect={() => { close(false); navigate(item.path); }}>
                    <FileText />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function useTableOfContents(articleRef, pathname) {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return undefined;
    const collect = () => {
      const headings = [...article.querySelectorAll('[data-toc]')];
      setItems(headings.map(h => ({ id: h.id, text: h.textContent, level: Number(h.dataset.toc) })));
      return headings;
    };
    let headings = collect();
    // Pages are lazy-loaded, so headings can appear after the first render
    const mutations = new MutationObserver(() => { headings = collect(); observeAll(); });
    const spy = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-120px 0px -65% 0px' });
    function observeAll() { spy.disconnect(); headings.forEach(h => spy.observe(h)); }
    observeAll();
    mutations.observe(article, { childList: true, subtree: true });
    return () => { mutations.disconnect(); spy.disconnect(); };
  }, [articleRef, pathname]);

  return { items, active };
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
  }, []);

  const copyPage = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(articleRef.current?.innerText || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, []);

  const firstPathOf = t => {
    const page = t.groups[0].pages[0];
    return page.slug ? `/docs/${page.slug}` : '/docs';
  };

  return (
    <div className="min-h-svh bg-surface text-ink">
      <a href="#docs-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-ink-inverse">Skip to content</a>

      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <Link to="/docs" className="flex shrink-0 items-center gap-2.5" aria-label="Twiligent documentation home">
            <Logo className="h-6" />
            <span className="hidden border-l border-line pl-2.5 text-sm font-medium text-ink-muted sm:inline">Docs</span>
          </Link>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search documentation"
            className="ml-auto flex size-9 shrink-0 items-center justify-center gap-2 rounded-field border border-line-control bg-surface text-sm text-ink-faint transition-colors hover:border-line-strong/60 hover:text-ink-muted sm:mx-auto sm:w-full sm:max-w-md sm:shrink sm:justify-start sm:px-3"
          >
            <Search className="size-4 stroke-[1.75]" />
            <span className="hidden flex-1 text-left sm:inline">Search</span>
            <kbd className="hidden rounded-sm border border-line px-1.5 font-mono text-caption sm:inline">/</kbd>
          </button>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}>
              {isDark ? <Sun /> : <Moon />}
            </Button>
            <Button size="sm" render={<Link to={session ? '/' : '/login'} />}>
              {session ? <>Open<span className="hidden sm:inline">&nbsp;Twiligent</span></> : 'Sign in'}
            </Button>
          </div>
        </div>
        <nav aria-label="Documentation sections" className="scrollbar-hide flex h-11 items-stretch gap-5 overflow-x-auto px-4 lg:px-6">
          {DOC_TABS.map(t => (
            <Link
              key={t.id}
              to={firstPathOf(t)}
              aria-current={t.id === tab.id ? 'page' : undefined}
              className={cn(
                'relative flex shrink-0 items-center text-sm font-medium transition-colors duration-(--duration-base)',
                t.id === tab.id ? 'text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand' : 'text-ink-muted hover:text-ink',
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mx-auto flex max-w-[96rem]">
        <aside className="sticky top-[6.25rem] hidden h-[calc(100svh-6.25rem)] w-64 shrink-0 overflow-y-auto border-r border-line px-4 py-6 lg:block">
          <SidebarNav tab={tab} />
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

            <nav aria-label="Previous and next page" className="mt-16 grid grid-cols-1 gap-3 border-t border-line pt-8 sm:grid-cols-2">
              {prev ? (
                <Link to={prev.path} className="group flex flex-col gap-1 rounded-card border border-line p-4 transition-colors hover:border-line-strong/50">
                  <span className="flex items-center gap-1 text-caption text-ink-faint"><ArrowLeft className="size-3.5" />Previous</span>
                  <span className="text-sm font-medium text-ink">{prev.title}</span>
                </Link>
              ) : <span />}
              {next && (
                <Link to={next.path} className="group flex flex-col items-end gap-1 rounded-card border border-line p-4 text-right transition-colors hover:border-line-strong/50">
                  <span className="flex items-center gap-1 text-caption text-ink-faint">Next<ArrowRight className="size-3.5" /></span>
                  <span className="text-sm font-medium text-ink">{next.title}</span>
                </Link>
              )}
            </nav>
          </div>
        </main>

        <aside className="sticky top-[6.25rem] hidden h-[calc(100svh-6.25rem)] w-60 shrink-0 overflow-y-auto py-10 pr-6 xl:block">
          {toc.length > 0 && (
            <nav aria-label="On this page" className="flex flex-col gap-3">
              <p className="text-sm font-medium text-ink-muted">On this page</p>
              <ul className="flex flex-col border-l border-line">
                {toc.map(item => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      onClick={e => { e.preventDefault(); document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' }); history.replaceState(null, '', `#${item.id}`); }}
                      className={cn(
                        '-ml-px block border-l py-1 text-sm leading-5 transition-colors duration-(--duration-base)',
                        item.level === 3 ? 'pl-6' : 'pl-3',
                        active === item.id ? 'border-brand text-ink' : 'border-transparent text-ink-faint hover:text-ink',
                      )}
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="mt-3 flex w-fit items-center gap-1.5 border-t border-line pt-4 text-sm text-ink-faint transition-colors hover:text-ink">
                Scroll to top <ArrowUp className="size-3.5" />
              </button>
            </nav>
          )}
        </aside>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 overflow-y-auto p-5">
          <SheetTitle className="sr-only">Documentation navigation</SheetTitle>
          <div className="mb-6 flex flex-col gap-1">
            {DOC_TABS.map(t => (
              <Link key={t.id} to={firstPathOf(t)} onClick={() => setMenuOpen(false)} className={cn('rounded-row px-2 py-1.5 text-sm font-medium', t.id === tab.id ? 'text-ink' : 'text-ink-muted')}>
                {t.label}
              </Link>
            ))}
          </div>
          <SidebarNav tab={tab} onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <DocsSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
