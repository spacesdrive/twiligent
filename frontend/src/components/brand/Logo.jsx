import React from 'react';
import { cn } from '@/lib/utils';

const LOGO_DIR = '/Logos';

// Brand rule: the colour lockup sits on paper, the reversed lockup on dusk. Both are rendered and
// CSS picks one, so the right file shows on first paint without waiting for the theme hook.
export function Logo({ variant = 'lockup', className }) {
  if (variant === 'mark') {
    return (
      <img
        src={`${LOGO_DIR}/twiligent-mark-color.svg`}
        alt="Twiligent"
        className={cn('h-6 w-auto shrink-0 select-none', className)}
        draggable={false}
      />
    );
  }

  return (
    <span className={cn('inline-flex shrink-0 select-none', className)}>
      <img
        src={`${LOGO_DIR}/twiligent-lockup-horizontal.svg`}
        alt="Twiligent"
        className="h-full w-auto dark:hidden"
        draggable={false}
      />
      <img
        src={`${LOGO_DIR}/twiligent-lockup-horizontal-reversed.svg`}
        alt="Twiligent"
        className="hidden h-full w-auto dark:block"
        draggable={false}
      />
    </span>
  );
}
