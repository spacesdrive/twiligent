import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FocusEvent, PointerEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { cn } from '@/lib/cn';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { SIGN_IN_URL, SIGN_UP_URL } from '@/lib/links';
import { AltArrowDown, AltArrowRight, CloseCircle, HamburgerMenu } from './icons';
import { BAR_LINKS, MENUS } from './navLinks';
import type { MenuColumn, MenuItem as MenuItemData } from './navLinks';
import { Logo } from './brand';
import { Pill } from './Pill';
import { ThemeToggle } from './ThemeToggle';

const TRIGGER =
  'flex items-center gap-1 rounded-full px-3.5 py-2 text-[15px] font-medium text-ink transition-colors duration-150 hover:bg-surface-sunken';

interface SpotBox {
  left: number;
  top: number;
  width: number;
  height: number;
  hidden?: boolean;
}

interface MenuItemProps {
  item: MenuItemData;
  onDone: () => void;
  onHover: (event: PointerEvent<HTMLElement> | FocusEvent<HTMLElement>) => void;
}

// one entry: an icon in a soft tile, a name, and a line about it
function MenuItem({ item, onDone, onHover }: MenuItemProps) {
  const Icon = item.icon;
  const body = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-sunken text-ink">
        <Icon className="size-[22px]" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 text-left">
        <span className="text-[15px] font-semibold text-ink">{item.title}</span>
        <span className="text-[13px] text-ink-muted">{item.description}</span>
      </span>
    </>
  );
  const cls = 'relative z-10 flex items-center gap-3.5 rounded-md px-3 py-2.5';
  const events = { onPointerEnter: onHover, onFocus: onHover };
  if (item.href.startsWith('/')) {
    return (
      <Link to={item.href} className={cls} onClick={onDone} {...events}>
        {body}
      </Link>
    );
  }
  return (
    <a href={item.href} target="_blank" rel="noopener noreferrer" className={cls} onClick={onDone} {...events}>
      {body}
    </a>
  );
}

interface ColumnsProps {
  columns: MenuColumn[];
  onDone: () => void;
  stacked?: boolean;
}

// one soft highlight behind the items that slides to whichever the pointer or keyboard is on
function Columns({ columns, onDone, stacked = false }: ColumnsProps) {
  const surface = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<SpotBox | null>(null);
  const hover = (event: PointerEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    const box = surface.current?.getBoundingClientRect();
    if (!box) return;
    const r = event.currentTarget.getBoundingClientRect();
    setSpot({ left: r.left - box.left, top: r.top - box.top, width: r.width, height: r.height });
  };
  return (
    <div
      ref={surface}
      onPointerLeave={() => setSpot(s => s && { ...s, hidden: true })}
      className={cn('relative flex gap-5', stacked && 'flex-col gap-4')}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute rounded-md bg-surface-sunken"
        style={{
          left: spot?.left ?? 0,
          top: spot?.top ?? 0,
          width: spot?.width ?? 0,
          height: spot?.height ?? 0,
          opacity: spot && !spot.hidden ? 1 : 0,
          transition:
            'opacity 130ms ease, left 220ms var(--ease-panel), top 220ms var(--ease-panel), width 220ms var(--ease-panel), height 220ms var(--ease-panel)',
        }}
      />
      {columns.map(column => (
        <div key={column.heading} className="min-w-0 flex-1">
          <p className="eyebrow px-3 pb-2 text-ink-muted">{column.heading}</p>
          <ul className="flex flex-col gap-1">
            {column.items.map(item => (
              <li key={item.title}>
                <MenuItem item={item} onDone={onDone} onHover={hover} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// a floating island; a menu opens inside it below a hairline, so the bar and its panel read as one surface that grows
export function Navbar() {
  const reduce = usePrefersReducedMotion();
  const location = useLocation();
  const island = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // moving to another page closes the menu behind it
  const here = location.pathname + location.hash;
  const [lastPath, setLastPath] = useState(here);
  if (here !== lastPath) {
    setLastPath(here);
    setOpen(null);
  }

  const close = useCallback(() => setOpen(null), []);

  // a menu opened from the keyboard takes focus to its first item, and Escape hands focus back to its button
  const trigger = useRef<HTMLButtonElement | null>(null);
  const openFromKeyboard = (id: string, button: HTMLButtonElement) => {
    trigger.current = button;
    setOpen(id);
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>('#nav-panel a')?.focus());
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(null);
      trigger.current?.focus();
      trigger.current = null;
    };
    const onDown = (event: globalThis.PointerEvent) => {
      if (!island.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  // hovering opens at once; leaving waits a moment so a pointer cutting a corner into the panel does not shut it
  const hoverOpen = (id: string) => (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    window.clearTimeout(closeTimer.current);
    setOpen(id);
  };
  const hoverLeave = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || open === 'mobile') return;
    closeTimer.current = window.setTimeout(() => setOpen(null), 160);
  };
  const hoverStay = () => window.clearTimeout(closeTimer.current);

  // the panel keeps showing the last menu while it closes, so its contents fade with it
  const [shown, setShown] = useState<string | null>(null);
  if (open && open !== shown) setShown(open);
  const menu = MENUS.find(m => m.id === shown);
  const raised = scrolled || open;

  // the panel's height follows its contents, so it eases between menus of different sizes
  const contents = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const el = contents.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 pt-3 md:pt-4">
      <div className="container-page">
        <div
          ref={island}
          onPointerLeave={hoverLeave}
          onPointerEnter={hoverStay}
          className={cn(
            'overflow-hidden rounded-lg ring-1 backdrop-blur-md transition-[background-color,box-shadow] duration-300 ease-out',
            raised ? 'bg-surface-raised/95 shadow-md ring-line' : 'bg-surface-raised/70 ring-line/70',
          )}
        >
          <nav
            aria-label="Main"
            className="flex h-16 items-center justify-between gap-3 px-4 md:h-[68px] md:px-6 lg:grid lg:grid-cols-[1fr_auto_1fr]"
          >
            <Link to="/" aria-label="Twiligent home" className="flex min-h-11 shrink-0 items-center justify-self-start">
              <Logo className="h-6 md:h-7" />
            </Link>

            <ul className="hidden items-center gap-1 justify-self-center lg:flex">
              {MENUS.map(m => (
                <li key={m.id}>
                  <button
                    type="button"
                    aria-expanded={open === m.id}
                    aria-controls="nav-panel"
                    onPointerEnter={hoverOpen(m.id)}
                    onClick={event => {
                      // detail is 0 when Enter or Space pressed the button rather than a pointer
                      if (event.detail === 0 && open !== m.id) openFromKeyboard(m.id, event.currentTarget);
                      else setOpen(current => (current === m.id ? null : m.id));
                    }}
                    className={cn(TRIGGER, open === m.id && 'bg-surface-sunken')}
                  >
                    {m.label}
                    <AltArrowDown
                      className={cn('-mr-0.5 size-4 transition-transform duration-200', open === m.id && 'rotate-180')}
                    />
                  </button>
                </li>
              ))}
              {BAR_LINKS.map(link => (
                <li key={link.href}>
                  <Link to={link.href} className={TRIGGER} onPointerEnter={() => setOpen(null)}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2 justify-self-end">
              <ThemeToggle className="hidden sm:flex" />
              <span className="hidden md:inline-flex">
                <Pill href={SIGN_IN_URL} variant="soft" size="sm">
                  Sign in
                </Pill>
              </span>
              <Pill href={SIGN_UP_URL} size="sm" className="pr-3">
                Get started
                <AltArrowRight className="-mr-0.5 size-4 transition-transform group-hover:translate-x-0.5" />
              </Pill>
              <button
                type="button"
                aria-expanded={open === 'mobile'}
                aria-controls="nav-panel"
                aria-label={open === 'mobile' ? 'Close menu' : 'Open menu'}
                onClick={() => setOpen(current => (current === 'mobile' ? null : 'mobile'))}
                className="flex size-10 items-center justify-center rounded-full text-ink hover:bg-surface-sunken lg:hidden"
              >
                {open === 'mobile' ? <CloseCircle className="size-6" /> : <HamburgerMenu className="size-6" />}
              </button>
            </div>
          </nav>

          <div
            id="nav-panel"
            inert={!open}
            className="overflow-hidden"
            style={{
              height: open ? height : 0,
              opacity: open ? 1 : 0,
              transition: reduce ? 'none' : 'height 380ms var(--ease-panel), opacity 240ms var(--ease-panel)',
            }}
          >
            <div ref={contents}>
              {shown && (
                <div key={shown} className="nav-panel-in mx-4 border-t border-line pt-4 pb-6 md:mx-6">
                  {shown === 'mobile' ? (
                    <div className="max-h-[calc(100svh-120px)] space-y-6 overflow-x-hidden overflow-y-auto">
                      {MENUS.map(m => (
                        <Columns key={m.id} columns={m.columns} onDone={close} stacked />
                      ))}
                      <div className="flex flex-col gap-2 border-t border-line pt-5">
                        {BAR_LINKS.map(link => (
                          <Link
                            key={link.href}
                            to={link.href}
                            className="px-3 py-1.5 text-[15px] font-semibold text-ink"
                          >
                            {link.label}
                          </Link>
                        ))}
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <Pill href={SIGN_UP_URL} className="w-full sm:w-auto">
                            Get started
                          </Pill>
                          <Pill href={SIGN_IN_URL} variant="soft" className="w-full sm:w-auto">
                            Sign in
                          </Pill>
                        </div>
                        <div className="flex items-center justify-between px-3 pt-2 text-sm text-ink-muted">
                          Theme
                          <ThemeToggle />
                        </div>
                      </div>
                    </div>
                  ) : (
                    menu && <Columns columns={menu.columns} onDone={close} />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
