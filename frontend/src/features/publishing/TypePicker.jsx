import { cn } from '@/lib/utils';
import { CONTENT_TYPES } from './publishConstants';

export default function TypePicker({ value, onChange, disabled }) {
  return (
    <div role="radiogroup" aria-label="Content type" className="grid grid-cols-3 gap-2">
      {CONTENT_TYPES.map(type => {
        const Icon = type.icon;
        const active = value === type.value;
        return (
          <button
            key={type.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(type.value)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-field border px-2 py-3 text-center transition-colors duration-(--duration-fast)',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50',
              active ? 'border-brand bg-brand-soft/50 text-brand-text' : 'border-line-control text-ink-muted hover:bg-surface-hover hover:text-ink',
            )}
          >
            <Icon className="size-5 stroke-[1.75]" />
            <span className="text-small font-semibold">{type.label}</span>
          </button>
        );
      })}
    </div>
  );
}
