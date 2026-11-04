import { Children, createContext, isValidElement, useContext, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  CheckCircle,
  Copy,
  DangerTriangle,
  InfoCircle,
  Lightbulb,
  LinkMinimalistic,
  ShieldWarning,
} from '@/components/icons';
import type { Icon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { RibbonCrop } from '@/components/brand';
import { slugify } from './searchShared';

// the plain text inside a heading, for its anchor id
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

export function Heading({ level, children }: { level: 2 | 3; children?: ReactNode }) {
  const id = slugify(textOf(children));
  const Tag = level === 2 ? 'h2' : 'h3';
  return (
    <Tag
      id={id}
      data-toc={level}
      className={cn(
        'group display scroll-mt-32 text-ink',
        level === 2 ? 'mt-12 mb-4 text-2xl leading-8' : 'mt-8 mb-3 text-[19px] leading-[26px]',
      )}
    >
      {children}
      <a
        href={`#${id}`}
        className="ml-2 inline-flex align-middle text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={`Link to ${textOf(children)}`}
      >
        <LinkMinimalistic className="size-4" />
      </a>
    </Tag>
  );
}

export function DocLink({ href = '', children, ...props }: ComponentPropsWithoutRef<'a'>) {
  const cls =
    'font-medium text-accent-text underline decoration-accent-text/40 underline-offset-4 transition-colors hover:decoration-accent-text';
  if (href.startsWith('/') && !href.startsWith('//'))
    return (
      <Link to={href} className={cls}>
        {children}
      </Link>
    );
  if (href.startsWith('#'))
    return (
      <a href={href} className={cls} {...props}>
        {children}
      </a>
    );
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls} {...props}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

// shiki's highlighted block with a copy button in its corner
export function CodeBlock(props: ComponentPropsWithoutRef<'pre'>) {
  const ref = useRef<HTMLPreElement>(null);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(ref.current?.textContent ?? '');
      setCopy('copied');
      setTimeout(() => setCopy('idle'), 1500);
    } catch {
      setCopy('failed');
    }
  }
  return (
    <div className="group relative my-6">
      {/* a wide block scrolls inside itself, so it takes keyboard focus for the arrow keys */}
      <pre
        ref={ref}
        tabIndex={0}
        role="region"
        aria-label="Code"
        {...props}
        className={cn(
          props.className,
          'overflow-x-auto rounded-lg border border-line bg-surface-sunken! py-4 pr-14 pl-4 font-mono text-[13.5px] leading-[22px]',
        )}
      />
      <button
        type="button"
        onClick={copyCode}
        aria-label="Copy code"
        className="absolute top-2.5 right-2.5 inline-flex size-8 items-center justify-center rounded-md border border-line bg-surface-raised text-ink-muted transition-colors hover:text-ink"
      >
        {copy === 'copied' ? <CheckCircle className="size-4 text-success" /> : <Copy className="size-4" />}
      </button>
      <p role="status" className={cn(copy === 'failed' ? 'mt-2 text-sm text-ink-muted' : 'sr-only')}>
        {copy === 'copied' && 'Copied'}
        {copy === 'failed' && "Couldn't copy. Select the code and copy it by hand."}
      </p>
    </div>
  );
}

export function InlineCode(props: ComponentPropsWithoutRef<'code'>) {
  // inside a highlighted block shiki styles the code itself
  if (typeof props.className === 'string' || Children.toArray(props.children).some(child => typeof child !== 'string'))
    return <code {...props} />;
  return (
    <code
      className="rounded-sm border border-line bg-surface-sunken px-1.5 py-0.5 font-mono text-[0.85em] text-ink"
      {...props}
    />
  );
}

export type CalloutType = 'note' | 'tip' | 'warning' | 'danger';

const CALLOUTS: Record<CalloutType, { icon: Icon; box: string; tint: string; label: string }> = {
  note: { icon: InfoCircle, box: 'border-info/30 bg-info-soft', tint: 'text-info', label: 'Note' },
  tip: { icon: Lightbulb, box: 'border-success/30 bg-success-soft', tint: 'text-success', label: 'Tip' },
  warning: {
    icon: DangerTriangle,
    box: 'border-afterglow-text/30 bg-afterglow-soft',
    tint: 'text-afterglow-text',
    label: 'Warning',
  },
  danger: {
    icon: ShieldWarning,
    box: 'border-accent-text/30 bg-accent-soft',
    tint: 'text-accent-text',
    label: 'Important',
  },
};

export interface CalloutProps {
  type?: CalloutType;
  title?: ReactNode;
  children?: ReactNode;
}

export function Callout({ type = 'note', title, children }: CalloutProps) {
  const callout = CALLOUTS[type];
  const Icon = callout.icon;
  return (
    <div role="note" className={cn('my-6 flex gap-3 rounded-lg border px-4 py-3.5', callout.box)}>
      <Icon className={cn('mt-1 size-4 shrink-0', callout.tint)} aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1.5 text-[15px] leading-6 text-ink [&_p]:m-0 [&_strong]:font-semibold">
        <span className="sr-only">{callout.label}: </span>
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

// a step heading sits one level below the heading the steps follow
const StepLevel = createContext<2 | 3>(2);

export interface StepsProps {
  // 3 when the steps sit under a ## heading, so the outline nests them there
  level?: 2 | 3;
  children?: ReactNode;
}

export function Steps({ level = 2, children }: StepsProps) {
  return (
    <StepLevel.Provider value={level}>
      <ol className="my-8 flex flex-col [counter-reset:step]">{children}</ol>
    </StepLevel.Provider>
  );
}

export interface StepProps {
  title: string;
  children?: ReactNode;
}

export function Step({ title, children }: StepProps) {
  const level = useContext(StepLevel);
  const Tag = level === 2 ? 'h2' : 'h3';
  return (
    <li className="relative flex gap-4 pb-8 [counter-increment:step] before:absolute before:top-10 before:bottom-1 before:left-4 before:w-px before:bg-line last:pb-0 last:before:hidden">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface-raised font-mono text-sm font-medium text-ink before:content-[counter(step)]"
      />
      <div className="flex min-w-0 flex-1 flex-col pt-1">
        <Tag id={slugify(title)} data-toc={level} className="display scroll-mt-32 text-[17px] leading-7 text-ink">
          {title}
        </Tag>
        <div className="text-base leading-7 text-ink-muted [&>*:first-child]:mt-2 [&_p]:my-3 [&_strong]:font-semibold [&_strong]:text-ink">
          {children}
        </div>
      </div>
    </li>
  );
}

export function Cards({ children }: { children?: ReactNode }) {
  return <div className="my-8 grid grid-cols-1 gap-4 md:grid-cols-3">{children}</div>;
}

export interface CardProps {
  href: string;
  title: string;
  // which corner the ribbon crop bleeds off, so neighbouring cards differ
  art?: 0 | 1 | 2;
  children?: ReactNode;
}

const CARD_ART = ['bottom-right', 'top-left', 'bottom-left'] as const;

export function Card({ href, title, art = 0, children }: CardProps) {
  return (
    <Link
      to={href}
      className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface-raised transition-colors hover:border-line-strong"
    >
      <div className={cn('relative h-28 overflow-hidden', art === 1 ? 'bg-dusk-panel' : 'bg-fold')}>
        <RibbonCrop placement={CARD_ART[art]} size="w-[70%]" />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-5">
        <p className="display flex items-center gap-1.5 text-lg text-ink">
          {title}
          <ArrowRight
            className="size-4 text-ink-muted transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </p>
        <div className="text-[15px] leading-6 text-ink-muted [&_p]:m-0">{children}</div>
      </div>
    </Link>
  );
}

export type BadgeTone = 'neutral' | 'required' | 'optional' | 'secret';

const BADGES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted',
  required: 'bg-accent-soft text-accent-text',
  optional: 'bg-info-soft text-info',
  secret: 'bg-afterglow-soft text-afterglow-text',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children?: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full px-2 text-xs font-semibold whitespace-nowrap',
        BADGES[tone],
      )}
    >
      {children}
    </span>
  );
}
