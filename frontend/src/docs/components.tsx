import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, AlertTriangle, Lightbulb, ShieldAlert, Check, Copy, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { slugify } from './slug';

// Building blocks for documentation pages. Headings get ids so the "On this page" list can find them.

function textOf(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node?.props?.children) return textOf(node.props.children);
  return '';
}

export function DocTitle({ title, lead }) {
  return (
    <header className="mb-10 flex flex-col gap-3">
      <h1 className="font-heading text-[2.25rem] leading-[2.8125rem] font-semibold tracking-[-0.02em] text-ink">{title}</h1>
      {lead && <p className="text-lg leading-7 text-ink-muted">{lead}</p>}
    </header>
  );
}

export function H2({ children, id }) {
  return (
    <h2 id={id || slugify(textOf(children))} data-toc="2" className="mt-12 mb-4 scroll-mt-32 font-heading text-2xl leading-8 font-semibold tracking-[-0.02em] text-ink first:mt-0">
      {children}
    </h2>
  );
}

export function H3({ children, id }) {
  return (
    <h3 id={id || slugify(textOf(children))} data-toc="3" className="mt-8 mb-3 scroll-mt-32 font-heading text-xl leading-8 font-semibold tracking-[-0.01em] text-ink">
      {children}
    </h3>
  );
}

export function P({ children, className }) {
  return <p className={cn('my-4 text-base leading-7 text-ink-muted [&_strong]:font-semibold [&_strong]:text-ink', className)}>{children}</p>;
}

export function UL({ children }) {
  return <ul className="my-4 flex list-disc flex-col gap-2 pl-6 text-base leading-7 text-ink-muted marker:text-ink-faint [&_strong]:font-semibold [&_strong]:text-ink">{children}</ul>;
}

export function OL({ children }) {
  return <ol className="my-4 flex list-decimal flex-col gap-2 pl-6 text-base leading-7 text-ink-muted marker:text-ink-faint [&_strong]:font-semibold [&_strong]:text-ink">{children}</ol>;
}

export function Code({ children }) {
  return <code className="rounded-sm border border-line bg-surface-sunken px-1.5 py-0.5 font-mono text-[0.875em] text-ink">{children}</code>;
}

export function A({ to, href, children }) {
  const cls = 'font-medium text-brand-text underline decoration-brand-text/40 underline-offset-4 hover:decoration-brand-text';
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{children}</a>;
}

const CALLOUTS = {
  note: { icon: Info, cls: 'border-info/30 bg-info-soft', iconCls: 'text-info', label: 'Note' },
  tip: { icon: Lightbulb, cls: 'border-success/30 bg-success-soft', iconCls: 'text-success', label: 'Tip' },
  warning: { icon: AlertTriangle, cls: 'border-warning/30 bg-warning-soft', iconCls: 'text-warning', label: 'Warning' },
  danger: { icon: ShieldAlert, cls: 'border-danger/30 bg-danger-soft', iconCls: 'text-danger', label: 'Important' },
};

export function Callout({ type = 'note', title, children }) {
  const callout = CALLOUTS[type];
  const Icon = callout.icon;
  return (
    <div className={cn('my-6 flex gap-3 rounded-field border px-4 py-3.5', callout.cls)}>
      <Icon className={cn('mt-0.5 size-4 shrink-0 stroke-[1.75]', callout.iconCls)} aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1 text-[0.9375rem] leading-6 text-ink-muted [&_strong]:font-semibold [&_strong]:text-ink">
        <p className="font-semibold text-ink"><span className="sr-only">{callout.label}: </span>{title}</p>
        {children && <div className="[&>p]:m-0 flex flex-col gap-2">{children}</div>}
      </div>
    </div>
  );
}

export function CodeBlock({ children, title }) {
  const [copied, setCopied] = useState(false);
  const text = String(children).replace(/^\n/, '').replace(/\n\s*$/, '');
  return (
    <div className="my-6 overflow-hidden rounded-field border border-line bg-surface-sunken">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
        <span className="font-mono text-caption text-ink-faint">{title || 'Terminal'}</span>
        <button
          type="button"
          onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); } }}
          className="inline-flex items-center gap-1.5 rounded-row px-2 py-1 text-caption text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[0.8125rem] leading-6 text-ink"><code>{text}</code></pre>
    </div>
  );
}

export function Steps({ children }) {
  return <ol className="my-6 flex flex-col [counter-reset:step]">{children}</ol>;
}

export function Step({ title, children }) {
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0 [counter-increment:step] before:absolute before:top-9 before:bottom-1 before:left-[0.9375rem] before:w-px before:bg-line last:before:hidden">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface-raised font-mono text-small font-medium text-ink before:content-[counter(step)]" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col pt-1">
        <h3 id={slugify(title)} data-toc="3" className="scroll-mt-32 font-heading text-lg leading-7 font-semibold text-ink">{title}</h3>
        <div className="text-base leading-7 text-ink-muted [&>*:first-child]:mt-2 [&_strong]:font-semibold [&_strong]:text-ink">{children}</div>
      </div>
    </li>
  );
}

export function Table({ head, rows }) {
  return (
    <div className="my-6 overflow-x-auto rounded-field border border-line">
      <table className="w-full min-w-[36rem] text-left text-[0.875rem] leading-6">
        <thead className="border-b border-line bg-surface-sunken/60">
          <tr>{head.map(h => <th key={h} className="px-4 py-2.5 font-semibold text-ink">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-divider last:border-0 align-top">
              {row.map((cell, j) => <td key={j} className="px-4 py-3 text-ink-muted [&_strong]:font-semibold [&_strong]:text-ink">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Image-topped path cards. The art is the brand fold band with a ribbon crop, tinted per card.
export function PathCards({ children }) {
  return <div className="my-8 grid grid-cols-1 gap-4 md:grid-cols-3">{children}</div>;
}

const CARD_ART = [
  'linear-gradient(120deg, #C11F2F 0%, #C11F2F 35%, #9A1423 70%, #5E0B14 100%)',
  'linear-gradient(120deg, #2A1D21 0%, #5E0B14 60%, #9A1423 100%)',
  'linear-gradient(120deg, #E8A33D 0%, #C11F2F 65%, #5E0B14 100%)',
];

export function PathCard({ to, title, children, art = 0 }) {
  return (
    <Link
      to={to}
      className="group flex flex-col overflow-hidden rounded-panel border border-line bg-surface-raised transition-colors duration-(--duration-base) hover:border-line-strong/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="relative h-36 overflow-hidden" style={{ background: CARD_ART[art % CARD_ART.length] }}>
        <img src="/Logos/twiligent-mark-white.svg" alt="" className="absolute -right-6 -bottom-10 w-40 opacity-20 transition-transform duration-(--duration-slow) ease-(--ease-fold) group-hover:-translate-y-1" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <p className="flex items-center gap-1.5 font-heading text-lg font-semibold text-ink">
          {title}
          <ArrowRight className="size-4 text-ink-faint transition-transform duration-(--duration-base) group-hover:translate-x-0.5" />
        </p>
        <p className="text-[0.9375rem] leading-6 text-ink-muted">{children}</p>
      </div>
    </Link>
  );
}

export function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-surface-sunken text-ink-muted',
    required: 'bg-brand-soft text-brand-text',
    optional: 'bg-info-soft text-info',
    secret: 'bg-warning-soft text-warning',
  };
  return <span className={cn('inline-flex h-5 items-center rounded-pill px-2 text-caption font-semibold whitespace-nowrap', tones[tone])}>{children}</span>;
}
