import { useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { useAutoplay } from '@/hooks/useAutoplay';
import { Database, LockKeyhole } from '@/components/icons';
import { PlatformMark } from '../kit';
import type { Platform } from '../platforms';
import { Frame } from './Frame';

interface Row {
  platform: Platform;
  name: string;
  member: string;
  updated: string;
}

const ROWS: Row[] = [
  { platform: 'youtube', name: 'Northwind Kitchen', member: 'Asha', updated: '2 min ago' },
  { platform: 'instagram', name: '@northwind.kitchen', member: 'Asha', updated: '2 min ago' },
  { platform: 'reddit', name: 'u/northwind_cooks', member: 'Ben', updated: '9 min ago' },
  { platform: 'youtube', name: 'Ben Bakes', member: 'Ben', updated: '14 min ago' },
  { platform: 'instagram', name: '@chloe.plates', member: 'Chloe', updated: '1 h ago' },
  { platform: 'reddit', name: 'u/chloe_cooks', member: 'Chloe', updated: '1 h ago' },
];
const ADDED: Row = { platform: 'youtube', name: 'Northwind Shorts', member: 'Asha', updated: 'just now' };

const STEPS = [2.4, 4];
const ENTER = [0.16, 1, 0.3, 1] as const;

const MEMBER_TINT: Record<string, string> = {
  Asha: 'bg-accent-soft text-accent-text',
  Ben: 'bg-afterglow-soft text-afterglow-text',
  Chloe: 'bg-info-soft text-info',
};

// the accounts table in the owner's own Supabase project: every row belongs to one member, and a new account
// lands at the top as someone connects it
export function DatabaseMock() {
  const ref = useRef<HTMLDivElement>(null);
  const { phase, loop } = useAutoplay(ref, STEPS);
  const rows = phase >= 1 ? [ADDED, ...ROWS] : ROWS;

  return (
    <Frame
      ref={ref}
      label="The accounts table in your own Supabase project, with row level security on: each account belongs to one member, and a newly connected channel appears at the top."
      icon={<Database className="size-5" />}
      title="accounts"
      meta={
        <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
          <LockKeyhole className="size-3.5" />
          RLS on
        </span>
      }
    >
      <div className="grid grid-cols-[1fr_4.5rem] gap-3 border-b border-line bg-surface-sunken/50 sm:grid-cols-[1fr_4.5rem_4.5rem] px-5 py-2 font-mono text-[10px] text-ink-muted">
        <span>name</span>
        <span>member</span>
        <span className="hidden text-right sm:block">updated</span>
      </div>
      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {rows.map(row => {
            const fresh = row === ADDED;
            return (
              <motion.li
                key={`${row.name}-${fresh ? loop : 'base'}`}
                layout
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: ENTER }}
                className={cn(
                  'grid grid-cols-[1fr_4.5rem] items-center gap-3 sm:grid-cols-[1fr_4.5rem_4.5rem] border-b border-line px-5 py-3 transition-colors duration-1000',
                  fresh && phase >= 1 ? 'bg-accent-soft/50' : 'bg-transparent',
                )}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <PlatformMark platform={row.platform} className="size-4 shrink-0" />
                  <span className="truncate font-mono text-xs text-ink">{row.name}</span>
                </span>
                <span
                  className={cn('w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold', MEMBER_TINT[row.member])}
                >
                  {row.member}
                </span>
                <span className="hidden text-right font-mono text-[10px] text-ink-muted sm:block">{row.updated}</span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </Frame>
  );
}
