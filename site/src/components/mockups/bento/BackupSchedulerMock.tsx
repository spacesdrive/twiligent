import { useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { useAutoplay } from '@/hooks/useAutoplay';
import { CheckCircle, RefreshCircle } from '@/components/icons';
import { GitHubIcon } from '@/components/marks';
import { Frame } from './Frame';

// a run starts, works for a moment, passes; the next starts fifteen minutes later in the picture's time
const STEPS = [1.4, 1.8];
const SHOWN = 7;
const FIRST = 18 * 60;
const FIRST_RUN = 406;
const ENTER = [0.16, 1, 0.3, 1] as const;

function clock(run: number): string {
  const minutes = (FIRST + run * 15) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

// the GitHub Actions backup for scheduled posts: a run every 15 minutes, the newest working, the rest passed
export function BackupSchedulerMock() {
  const ref = useRef<HTMLDivElement>(null);
  const { phase, loop, reduce } = useAutoplay(ref, STEPS);
  const newest = reduce ? SHOWN : loop + SHOWN;
  const working = !reduce && phase === 0;
  const runs = Array.from({ length: SHOWN }, (_, i) => newest - i);

  return (
    <Frame
      ref={ref}
      label="GitHub Actions runs of the Instagram Scheduled Publisher workflow, one every 15 minutes, each passing."
      icon={<GitHubIcon className="size-5 text-ink" />}
      title="Instagram Scheduled Publisher"
      meta={<span className="font-mono text-[10px] text-ink-muted">every 15 min</span>}
    >
      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {runs.map((run, i) => {
            const active = i === 0 && working;
            return (
              <motion.li
                key={run}
                layout
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: ENTER }}
                className="flex items-center gap-3 border-b border-line px-5 py-3 text-xs"
              >
                <span className={cn('flex', active ? 'text-afterglow-text' : 'text-success')}>
                  {active ? <RefreshCircle className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-ink">Scheduled run</p>
                  <p className="font-mono text-[10px] text-ink-muted">
                    #{FIRST_RUN + run} {active ? 'in progress' : 'publish-scheduled.yml'}
                  </p>
                </div>
                <span className="font-mono text-ink-muted">{clock(run)}</span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </Frame>
  );
}
