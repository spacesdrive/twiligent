import { useRef } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { useAutoplay } from '@/hooks/useAutoplay';
import { Library, Magnifer, Videocamera } from '@/components/icons';
import { Cursor } from '../Cursor';
import { Frame } from './Frame';

type Kind = 'Videos' | 'Shorts' | 'Reels';

interface Item {
  title: string;
  kind: Kind;
  length: string;
  views: string;
}

const ITEMS: Item[] = [
  { title: 'Lemon orzo, start to finish', kind: 'Videos', length: '12:48', views: '41K' },
  { title: 'Knife skills in 60 seconds', kind: 'Shorts', length: '0:58', views: '64K' },
  { title: 'Pantry tour', kind: 'Reels', length: '0:35', views: '22K' },
  { title: 'Crispy rice, one pan', kind: 'Shorts', length: '0:41', views: '38K' },
  { title: 'Bread every day, 30 days', kind: 'Videos', length: '18:20', views: '118K' },
  { title: 'Cast iron care', kind: 'Shorts', length: '0:52', views: '29K' },
  { title: 'Orzo plating', kind: 'Shorts', length: '0:33', views: '17K' },
  { title: 'Sunday batch cook', kind: 'Videos', length: '24:05', views: '33K' },
  { title: 'Lemon, three ways', kind: 'Reels', length: '0:29', views: '19K' },
];

const CHIPS = ['All', 'Videos', 'Shorts', 'Reels'] as const;
const STEPS = [1.8, 0.8, 0.4, 3.4];
const PHASE = { atChip: 1, click: 2 } as const;
const EASE = [0.22, 1, 0.36, 1] as const;

const THUMB: Record<Kind, string> = {
  Videos: 'bg-fold',
  Shorts: 'bg-linear-to-b from-afterglow/80 to-ember/80',
  Reels: 'bg-dusk-panel',
};

// the video library: every video, Short and Reel in one grid, filtered to Shorts with one click
export function LibraryMock() {
  const ref = useRef<HTMLDivElement>(null);
  const { phase, loop, reduce } = useAutoplay(ref, STEPS);
  const filtered = phase >= PHASE.click;
  const items = filtered ? ITEMS.filter(item => item.kind === 'Shorts') : ITEMS;
  const target = !reduce && (phase === PHASE.atChip || phase === PHASE.click) ? 'chip-shorts' : null;
  const clicks = loop + (phase >= PHASE.click ? 1 : 0);

  return (
    <Frame
      ref={ref}
      label="The library of every video, Short and Reel across the channels, filtered to Shorts with one click."
      icon={<Library className="size-5" />}
      title="Library"
      meta={
        <span className="flex items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 text-[11px] text-ink-muted">
          <Magnifer className="size-3.5" />
          Search
        </span>
      }
      bodyClassName="px-4 pt-3.5"
      overlay={<Cursor stage={ref} target={target} clicks={clicks} />}
    >
      <LayoutGroup id="library-mock">
        <div className="flex gap-1.5">
          {CHIPS.map(chip => {
            const active = filtered ? chip === 'Shorts' : chip === 'All';
            return (
              <span
                key={chip}
                data-cursor={chip === 'Shorts' ? 'chip-shorts' : undefined}
                className={cn(
                  'rounded-full px-3 py-1 text-[11px] font-medium transition-colors duration-300',
                  active ? 'bg-accent-soft text-accent-text' : 'bg-surface-sunken text-ink-muted',
                )}
              >
                {chip}
              </span>
            );
          })}
          <span className="ml-auto font-mono text-[10px] leading-6 text-ink-muted">{items.length} items</span>
        </div>
        <motion.ul layout className="relative mt-3 grid grid-cols-3 gap-2.5">
          <AnimatePresence mode="popLayout" initial={false}>
            {items.map(item => (
              <motion.li
                key={item.title}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="flex flex-col gap-1"
              >
                <span className={cn('relative grid aspect-[4/5] place-items-center rounded-md', THUMB[item.kind])}>
                  <Videocamera className="size-4 text-on-accent/80" />
                  <span className="absolute bottom-1.5 left-1.5 rounded-sm bg-dusk/70 px-1 font-mono text-[9px] text-paper">
                    {item.length}
                  </span>
                </span>
                <span className="truncate text-[11px] text-ink">{item.title}</span>
                <span className="font-mono text-[10px] text-ink-muted">{item.views} views</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      </LayoutGroup>
    </Frame>
  );
}
