import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fieldErrorId, fieldHintId } from '@/lib/fieldIds';

// sticky on wide screens, stacked below the main area on narrow ones
export interface DetailPanelProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export default function DetailPanel({ title, description, children, footer, className }: DetailPanelProps) {
  return (
    <aside
      className={cn(
        'flex flex-col rounded-card border border-line bg-surface-raised lg:sticky lg:top-[calc(var(--topbar-h)+1.5rem)] lg:max-h-[calc(100dvh-var(--topbar-h)-3rem)]',
        className,
      )}
    >
      {title && (
        <div className="border-b border-divider px-5 py-4">
          <h2 className="font-heading text-section font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-small text-ink-muted">{description}</p>}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">{children}</div>
      {footer && <div className="border-t border-divider px-5 py-4">{footer}</div>}
    </aside>
  );
}

// Label, hint, error and control in one settings-style row. With htmlFor, the hint and error are wired to a single
// child control through aria-describedby and aria-invalid; group renders a fieldset for several controls.
export interface FieldRowProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  optional?: boolean;
  htmlFor?: string;
  group?: boolean;
  children?: React.ReactNode;
  className?: string;
}

interface DescribableProps {
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

export function FieldRow({ label, hint, error, optional = false, htmlFor, group = false, children, className }: FieldRowProps) {
  const hintId = htmlFor && hint ? fieldHintId(htmlFor) : undefined;
  const errorId = htmlFor && error ? fieldErrorId(htmlFor) : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const control = !group && describedBy && React.isValidElement<DescribableProps>(children)
    ? React.cloneElement(children, {
        'aria-describedby': [children.props['aria-describedby'], describedBy].filter(Boolean).join(' '),
        'aria-invalid': error ? true : children.props['aria-invalid'],
      })
    : children;
  const labelText = (
    <>
      {label}
      {optional && <span className="font-normal text-ink-faint"> (optional)</span>}
    </>
  );
  const hintText = hint && <p id={hintId} className="max-w-prose text-sm text-ink-muted">{hint}</p>;
  const errorText = error && (
    <p id={errorId} className="flex items-start gap-1.5 text-sm text-danger">
      <AlertCircle className="mt-0.5 size-4 shrink-0 stroke-[1.75]" aria-hidden="true" />
      <span><span className="sr-only">Error: </span>{error}</span>
    </p>
  );
  if (group) {
    // a legend only names its fieldset when it is the first child
    return (
      <fieldset className={cn('flex min-w-0 flex-col gap-2', className)} aria-describedby={describedBy}>
        <legend className="text-sm font-medium text-ink">{labelText}</legend>
        {hintText}
        {control}
        {errorText}
      </fieldset>
    );
  }
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-col gap-0.5">
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink">{labelText}</label>
        {hintText}
      </div>
      {control}
      {errorText}
    </div>
  );
}
