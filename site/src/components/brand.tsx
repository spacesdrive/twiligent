import { cn } from '@/lib/cn';

export interface LogoProps {
  // sets the height; the lockup keeps its own proportions
  className?: string;
}

// the primary lockup on paper and the reversed one on dusk; the kit's files, never redrawn
export function Logo({ className }: LogoProps) {
  return (
    <span className={cn('relative inline-flex items-center', className ?? 'h-7')}>
      <img src="/brand/twiligent-lockup-horizontal.svg" alt="Twiligent" className="h-full w-auto dark:hidden" />
      <img
        src="/brand/twiligent-lockup-horizontal-reversed.svg"
        alt="Twiligent"
        className="hidden h-full w-auto dark:block"
      />
    </span>
  );
}

export function Mark({ className }: LogoProps) {
  return <img src="/brand/twiligent-mark-color.svg" alt="" className={cn('w-auto', className ?? 'h-10')} />;
}

export type RibbonPlacement = 'bottom-right' | 'top-right' | 'bottom-left' | 'top-left';

const PLACEMENTS: Record<RibbonPlacement, string> = {
  'bottom-right': '-right-[12%] -bottom-[38%]',
  'top-right': '-right-[14%] -top-[40%]',
  'bottom-left': '-left-[12%] -bottom-[40%]',
  'top-left': '-left-[14%] -top-[38%]',
};

export interface RibbonCropProps {
  placement?: RibbonPlacement;
  // width of the ribbon against its panel; it stays whole and unstretched, only its edge bleeds off
  size?: string;
  className?: string;
}

// the brand's graphic: a large single-colour crop of the ribbon at 14% white, bleeding off one corner
export function RibbonCrop({ placement = 'bottom-right', size = 'w-[58%]', className }: RibbonCropProps) {
  return (
    <img
      src="/brand/twiligent-mark-white.svg"
      alt=""
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute aspect-[1921/1663] h-auto max-w-none opacity-[0.14] select-none',
        size,
        PLACEMENTS[placement],
        className,
      )}
    />
  );
}

export type BandTone = 'fold' | 'dusk';

export interface FoldBandProps {
  tone?: BandTone;
  placement?: RibbonPlacement;
  className?: string;
  children?: React.ReactNode;
}

// a panel in the fold gradient or deep dusk with a ribbon crop; mockups sit on it the way Activepieces sets them on a painted scene
export function FoldBand({ tone = 'fold', placement = 'bottom-right', className, children }: FoldBandProps) {
  return (
    <div className={cn('relative isolate overflow-hidden', tone === 'fold' ? 'bg-fold' : 'bg-dusk-panel', className)}>
      <RibbonCrop placement={placement} className="-z-10" />
      {children}
    </div>
  );
}
