import { useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { useAutoplay } from '@/hooks/useAutoplay';
import { CheckCircle, ClockCircle, RefreshCircle } from '@/components/icons';
import { PlatformMark } from '../kit';
import { Frame } from './Frame';

// Instagram access lasts 60 days; every night at 00:00 the Worker renews any that has under 15 days left
const LIFETIME = 60;
const BEFORE = 14;
const STEPS = [2.2, 1.1, 3.6];
const PHASE = { renewing: 1, renewed: 2 } as const;
const EASE = [0.22, 1, 0.36, 1] as const;
const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const HISTORY = [
  { when: 'Yesterday, 00:00', text: 'Checked: 15 days left' },
  { when: '2 days ago, 00:00', text: 'Checked: 16 days left' },
  { when: '3 days ago, 00:00', text: 'Checked: 17 days left' },
];

// an Instagram account's access running low, the nightly job renewing it, and the days filling back up
export function TokenMock() {
  const ref = useRef<HTMLDivElement>(null);
  const { phase } = useAutoplay(ref, STEPS);
  const renewed = phase >= PHASE.renewed;
  const days = renewed ? LIFETIME : BEFORE;

  return (
    <Frame
      ref={ref}
      label="An Instagram account's access with 14 days left, renewed by the nightly job at 00:00 to a full 60 days, with the earlier nightly checks listed below."
      icon={<PlatformMark platform="instagram" className="size-5" />}
      title="@northwind.kitchen"
      meta={<span className="font-mono text-[11px] text-ink-muted">Instagram access</span>}
      bodyClassName="flex flex-col gap-4 p-5"
    >
      <div className="flex items-center gap-5">
        <div className="relative size-[5.5rem] shrink-0">
          <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden="true">
            <circle cx="40" cy="40" r={RADIUS} className="fill-none stroke-surface-sunken" strokeWidth="7" />
            <motion.circle
              cx="40"
              cy="40"
              r={RADIUS}
              className={cn(
                'fill-none transition-colors duration-500',
                renewed ? 'stroke-success' : 'stroke-afterglow',
              )}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              initial={false}
              animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - days / LIFETIME) }}
              transition={{ duration: renewed ? 1.2 : 0.4, ease: EASE }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="font-display text-xl leading-none font-semibold text-ink tabular-nums">{days}</p>
              <p className="mt-0.5 text-[10px] text-ink-muted">days left</p>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.26, ease: EASE }}
            >
              {phase === 0 && (
                <>
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-afterglow-text">
                    <ClockCircle className="size-4" />
                    Renews tonight
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-ink-muted">
                    Under 15 days left, so the 00:00 run renews it.
                  </p>
                </>
              )}
              {phase === PHASE.renewing && (
                <>
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-info">
                    <RefreshCircle className="size-4 animate-spin" />
                    Renewing
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-ink-muted">00:00, nightly run</p>
                </>
              )}
              {renewed && (
                <>
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-success">
                    <CheckCircle className="size-4" />
                    Access renewed
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-ink-muted">Tonight at 00:00, with nothing to do.</p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <ul className="flex flex-col rounded-md border border-line">
        <AnimatePresence initial={false}>
          {renewed && (
            <motion.li
              key="tonight"
              className="flex items-center justify-between gap-3 overflow-hidden border-b border-line bg-success-soft/40 px-3.5 text-[11px]"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 38, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <span className="font-mono text-ink-muted">Tonight, 00:00</span>
              <span className="font-semibold text-success">Renewed: 60 days</span>
            </motion.li>
          )}
        </AnimatePresence>
        {HISTORY.map(row => (
          <li
            key={row.when}
            className="flex h-[38px] items-center justify-between gap-3 border-b border-line px-3.5 text-[11px] last:border-0"
          >
            <span className="font-mono text-ink-muted">{row.when}</span>
            <span className="text-ink">{row.text}</span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}
