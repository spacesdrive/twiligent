import React from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export interface SegmentedChoiceProps<T extends string> {
  name: string;
  // given to the checked radio, or the first one, so a label or an error can move focus to the choice
  id?: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'segmented' | 'tiles';
  disabled?: boolean;
  className?: string;
  'aria-describedby'?: string;
}

// one choice from a few, built on native radio buttons so arrow keys, form semantics and screen readers work without
// ARIA; put it inside a FieldRow with `group` so its legend names the choice
export default function SegmentedChoice<T extends string>({
  name,
  id,
  options,
  value,
  onChange,
  variant = 'segmented',
  disabled = false,
  className,
  ...aria
}: SegmentedChoiceProps<T>) {
  return (
    <div
      className={cn(
        variant === 'segmented'
          ? 'flex h-(--control-h) w-full gap-0.5 rounded-control bg-surface-sunken p-1 sm:w-fit'
          : 'grid grid-cols-3 gap-2',
        className,
      )}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        const focusTarget = checked || (index === 0 && !options.some(item => item.value === value));
        return (
          <label
            key={option.value}
            className={cn(
              'relative flex cursor-pointer items-center justify-center gap-1.5 text-sm font-medium transition-colors duration-(--duration-fast) select-none',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50',
              '[&_svg]:shrink-0 [&_svg]:stroke-[1.75]',
              variant === 'segmented'
                ? cn('h-full flex-1 rounded-[calc(var(--radius-control)-2px)] px-3 [&_svg]:size-4', checked ? 'bg-surface-raised text-ink shadow-sm' : 'text-ink-muted hover:text-ink')
                : cn(
                    'flex-col rounded-field border px-2 py-3 text-center [&_svg]:size-5',
                    checked ? 'border-brand bg-brand-soft/50 text-brand-text' : 'border-line-control text-ink-muted hover:bg-surface-hover hover:text-ink',
                  ),
            )}
          >
            <input
              id={focusTarget ? id : undefined}
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              className="sr-only"
              {...aria}
            />
            {option.icon}
            <span className={variant === 'tiles' ? 'text-small font-semibold' : undefined}>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
