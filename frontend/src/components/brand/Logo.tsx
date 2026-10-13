import React from 'react';
import { cn } from '@/lib/utils';

const LOGO_DIR = '/Logos';

// css shows one of both lockups, so it is right before the theme hook runs
export interface LogoProps {
  variant?: 'lockup' | 'wordmark' | 'mark';
  className?: string;
}

export function Logo({ variant = 'lockup', className }: LogoProps) {
  if (variant === 'wordmark') {
    return (
      <span className={cn('inline-flex shrink-0 select-none', className)}>
        <img src={`${LOGO_DIR}/twiligent-wordmark-dusk.svg`} alt="Twiligent" className="h-full w-auto dark:hidden" draggable={false} />
        <img src={`${LOGO_DIR}/twiligent-wordmark-white.svg`} alt="" className="hidden h-full w-auto dark:block" draggable={false} />
      </span>
    );
  }

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
