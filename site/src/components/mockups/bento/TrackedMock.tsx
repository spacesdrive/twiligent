import { useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { useAutoplay } from '@/hooks/useAutoplay';
import { Bookmark, RefreshCircle } from '@/components/icons';
import { PlatformMark } from '../kit';
import type { Platform } from '../platforms';
import { CountUp } from '../CountUp';
import { Cursor } from '../Cursor';
import { Typed } from '../Typed';
import { Frame } from './Frame';

interface Tracked {
  platform: Platform;
  title: string;
  stat: string;
}

const ITEMS: Tracked[] = [
  { platform: 'reddit', title: 'One-pan lemon orzo, 20 minutes', stat: '2,400 upvotes' },
  { platform: 'youtube', title: 'Bread every day for a month', stat: '118K views' },
  { platform: 'youtube', title: 'Knife skills in 60 seconds', stat: '64K views' },
  { platform: 'reddit', title: 'Weeknight dinners that reheat well', stat: '1,100 upvotes' },
];
const ADDED: Tracked = { platform: 'reddit', title: 'Cast iron care, the short version', stat: '870 upvotes' };
const LINK = 'reddit.com/r/Cooking/comments/cast_iron';

const STEPS = [0.8, 0.7, 2.1, 0.7, 1.2, 3.4];
const PHASE = { atLink: 1, link: 2, atTrack: 3, track: 4, done: 5 } as const;
const ENTER = [0.16, 1, 0.3, 1] as const;

// tracking a post by its link: the link typed, Track clicked, the post fetched into the Recipes category,
// and the category's combined numbers going up
export function TrackedMock() {
  const ref = useRef<HTMLDivElement>(null);
  const { phase, loop, reduce } = useAutoplay(ref, STEPS);
  const added = phase >= PHASE.track;
  const done = phase >= PHASE.done;
  const target = reduce
    ? null
    : phase === PHASE.atLink || phase === PHASE.link
      ? 'link'
      : phase === PHASE.atTrack || phase === PHASE.track
        ? 'track'
        : null;
  const clicks = loop * 2 + (phase >= PHASE.link ? 1 : 0) + (phase >= PHASE.track ? 1 : 0);
  const rows = added ? [ADDED, ...ITEMS] : ITEMS;

  return (
    <Frame
      ref={ref}
      label="Tracked content: a Reddit post link is pasted and tracked, the post joins the Recipes category, and the category's combined karma and comments go up."
      icon={<Bookmark className="size-5" />}
      title="Recipes"
      meta={<span className="font-mono text-[11px] text-ink-muted">category</span>}
      overlay={<Cursor stage={ref} target={target} clicks={clicks} />}
    >
      <div className="grid grid-cols-3 border-b border-line">
        {[
          { label: 'Views', value: 182_000, to: 182_000, style: 'compact' as const },
          { label: 'Karma', value: 3_500, to: 4_370, style: 'number' as const },
          { label: 'Comments', value: 412, to: 498, style: 'number' as const },
        ].map((stat, i) => (
          <div key={stat.label} className={cn('px-4 py-2.5', i > 0 && 'border-l border-line')}>
            <p className="text-[10px] text-ink-muted">{stat.label}</p>
            <CountUp
              key={loop}
              value={stat.to}
              from={stat.value}
              style={stat.style}
              active={done}
              duration={1}
              className="block font-display text-sm font-semibold text-ink"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 px-4 py-3">
        <span
          data-cursor="link"
          className={cn(
            'flex h-9 min-w-0 flex-1 items-center truncate rounded-md border px-3 font-mono text-[11px] transition-colors duration-300',
            phase >= PHASE.link && !added ? 'border-ink-muted/60 text-ink' : 'border-line text-ink-muted',
          )}
        >
          {phase >= PHASE.link && !added ? (
            <Typed key={loop} text={LINK} active speed={30} />
          ) : (
            'Paste a Reddit or YouTube link'
          )}
        </span>
        <span
          data-cursor="track"
          className={cn(
            'grid h-9 place-items-center rounded-full px-4 text-xs font-semibold transition-colors duration-300',
            phase >= PHASE.atTrack && !added ? 'bg-accent text-on-accent' : 'bg-surface-sunken text-ink-muted',
          )}
        >
          Track
        </span>
      </div>
      <ul className="flex flex-col border-t border-line">
        <AnimatePresence initial={false}>
          {rows.map(item => {
            const fresh = item === ADDED;
            return (
              <motion.li
                key={`${item.title}-${fresh ? loop : 'base'}`}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: ENTER }}
                className={cn(
                  'flex items-center gap-3 border-b border-line px-4 py-3 transition-colors duration-1000',
                  fresh && !done ? 'bg-accent-soft/40' : 'bg-transparent',
                )}
              >
                <PlatformMark platform={item.platform} className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-xs text-ink">{item.title}</span>
                {fresh && !done ? (
                  <span className="flex items-center gap-1 font-mono text-[10px] text-ink-muted">
                    <RefreshCircle className="size-3.5 animate-spin" />
                    Fetching
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-ink-muted">{item.stat}</span>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </Frame>
  );
}
