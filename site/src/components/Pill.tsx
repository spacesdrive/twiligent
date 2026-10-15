import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';

// dusk and white sit on the fold gradient, where the theme colours would not hold contrast
export type PillVariant = 'accent' | 'soft' | 'ink' | 'dusk' | 'white';
export type PillSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<PillVariant, string> = {
  accent: 'bg-accent text-on-accent hover:bg-accent-hover',
  soft: 'bg-surface-raised text-ink ring-1 ring-line hover:ring-line-strong',
  ink: 'bg-ink text-ink-inverse hover:bg-ink/85',
  dusk: 'bg-dusk text-white hover:bg-oxblood',
  white: 'bg-white text-dusk hover:bg-paper',
};

const SIZES: Record<PillSize, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-[50px] px-7 text-[17px]',
};

export interface PillProps {
  href: string;
  variant?: PillVariant;
  size?: PillSize;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}

// the brand's capsule button; a path inside the site uses the router, anything else is a plain link
export function Pill({ href, variant = 'accent', size = 'md', className, children, onClick }: PillProps) {
  const cls = cn(
    'group inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors duration-150',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
  if (href.startsWith('/')) {
    return (
      <Link to={href} className={cls} onClick={onClick}>
        {children}
      </Link>
    );
  }
  const external = !href.startsWith('https://app.twiligent.ujjwal.fyi');
  return (
    <a
      href={href}
      className={cls}
      onClick={onClick}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );
}
