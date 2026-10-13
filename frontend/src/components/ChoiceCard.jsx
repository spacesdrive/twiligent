import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// a radio when `selected` is defined, otherwise a plain button
export default function ChoiceCard({ icon, title, description, selected, onSelect, disabled, className }) {
  const isRadio = selected !== undefined;
  return (
    <button
      type="button"
      role={isRadio ? 'radio' : undefined}
      aria-checked={isRadio ? selected : undefined}
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'group relative flex w-full flex-col items-start gap-3 rounded-panel border bg-surface-wash p-5 text-left transition-colors duration-(--duration-fast)',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
        selected ? 'border-brand bg-brand-soft/50' : 'border-transparent hover:bg-surface-selected',
        className,
      )}
    >
      <span
        className={cn(
          'flex size-10 items-center justify-center rounded-control [&_svg]:size-5 [&_svg]:stroke-[1.75]',
          selected ? 'bg-brand text-on-brand' : 'bg-surface-sunken text-ink-muted group-hover:text-ink',
        )}
      >
        {icon}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-base font-medium text-ink">{title}</span>
        {description && <span className="text-sm text-ink-muted">{description}</span>}
      </span>
      {selected && (
        <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-brand text-on-brand">
          <Check className="size-3" strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}
