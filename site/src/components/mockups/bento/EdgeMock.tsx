import { useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { useAutoplay } from '@/hooks/useAutoplay';
import { Server } from '@/components/icons';
import { Frame } from './Frame';

// real routes of the Worker, each with a status it answers and a sample time
const LOG: [string, string, number, number][] = [
  ['GET', '/api/overview', 200, 38],
  ['GET', '/api/accounts', 200, 21],
  ['POST', '/api/accounts/:id/refresh', 200, 412],
  ['GET', '/api/comparison', 200, 44],
  ['GET', '/api/scheduled-posts', 200, 19],
  ['POST', '/api/tracked-content', 201, 286],
  ['GET', '/api/videos/all', 200, 57],
  ['GET', '/api/health', 200, 4],
  ['GET', '/api/accounts/:id/analytics', 200, 96],
  ['POST', '/api/scheduled-posts', 201, 33],
  ['GET', '/api/tracked-content', 200, 24],
  ['GET', '/api/accounts/:id/ig-analytics', 200, 132],
];
const SHOWN = 11;
// one new request about every second, one step per log line
const STEPS = Array.from({ length: LOG.length }, () => 1.1);
const ENTER = [0.16, 1, 0.3, 1] as const;

// one Cloudflare Worker serving the app: its request log streaming in, newest first
export function EdgeMock() {
  const ref = useRef<HTMLDivElement>(null);
  const { phase, loop, reduce } = useAutoplay(ref, STEPS);
  const newest = reduce ? SHOWN - 1 : loop * LOG.length + phase + SHOWN - 1;
  const lines = Array.from({ length: SHOWN }, (_, i) => newest - i);

  return (
    <Frame
      ref={ref}
      label="One Cloudflare Worker serving the app, healthy, with its request log streaming in: overview, accounts, analytics, scheduled posts and tracked content."
      icon={<Server className="size-5" />}
      title="Cloudflare Worker"
      meta={
        <span className="flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
          <span className="relative flex size-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
            <span className="relative size-1.5 rounded-full bg-success" />
          </span>
          Healthy
        </span>
      }
      bodyClassName="bg-surface-sunken/60"
    >
      <ul className="flex flex-col px-5 py-2 font-mono text-[11px] leading-none">
        <AnimatePresence initial={false}>
          {lines.map((n, i) => {
            const [method, path, status, ms] = LOG[n % LOG.length];
            return (
              <motion.li
                key={n}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: ENTER }}
                className={cn('flex items-center gap-3 py-[0.55rem]', i === 0 ? 'text-ink' : 'text-ink-muted')}
              >
                <span className="w-7 text-success">{status}</span>
                <span className={cn('w-8', method === 'POST' ? 'text-afterglow-text' : 'text-info')}>{method}</span>
                <span className="min-w-0 flex-1 truncate">{path}</span>
                <span className="tabular-nums">{ms}ms</span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </Frame>
  );
}
