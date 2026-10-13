import React from 'react';
import { Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SetupStepProps {
  number: number;
  icon: LucideIcon;
  title: string;
  done: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  check?: React.ReactNode;
}

export default function SetupStep({ number, icon, title, done, onToggle, children, check }: SetupStepProps) {
  const Icon = icon;
  return (
    <li className={cn('flex gap-4 rounded-card border p-4 transition-colors', done ? 'border-success/30 bg-success-soft/40' : 'border-line')}>
      <div className="flex flex-col items-center gap-2">
        <span className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          done ? 'bg-success text-ink-inverse' : 'bg-surface-sunken text-ink-muted',
        )}>
          {done ? <Check className="size-4" strokeWidth={2.5} /> : <Icon className="size-4 stroke-[1.75]" />}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-semibold text-ink"><span className="text-ink-faint">Step {number}. </span>{title}</p>
          <label className="flex cursor-pointer items-center gap-2 text-small text-ink-muted select-none">
            <input type="checkbox" checked={done} onChange={onToggle} className="size-4 accent-[var(--brand)]" />
            Done
          </label>
        </div>
        <div className="flex flex-col gap-3 text-sm text-ink-muted [&_strong]:font-semibold [&_strong]:text-ink">{children}</div>
        {check && (
          <p className="flex items-start gap-1.5 text-small text-success">
            <Check className="mt-0.5 size-3.5 shrink-0" />
            <span><span className="font-semibold">It worked if</span> {check}</span>
          </p>
        )}
      </div>
    </li>
  );
}
