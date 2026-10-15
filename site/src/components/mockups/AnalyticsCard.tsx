import { useRef } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { useAutoplay } from '@/hooks/useAutoplay';
import { Lightbulb } from '@/components/icons';
import { PanelCard, PlatformMark } from './kit';
import { AreaChart } from './AreaChart';
import { CountUp } from './CountUp';
import { Cursor } from './Cursor';
import { MONTHS, YOUTUBE_WEEKS } from './sample';

// reset, numbers and chart, look at week 8, look at week 12, travel to the tab, click it, read the comparison
const STEPS = [0.5, 1.9, 1.1, 1.2, 0.9, 0.5, 3.6];
const PHASE = { count: 1, peek: 2, latest: 3, travel: 4, click: 5, compare: 6 } as const;

// four of the eight tabs on the app's channel page
const TABS = ['Overview', 'Engagement', 'Growth', 'Shorts and regular'];
const COMPARE_TAB = 3;

const EASE = [0.22, 1, 0.36, 1] as const;

function OverviewView({ play, focus }: { play: boolean; focus: number | null }) {
  const week = focus ?? YOUTUBE_WEEKS.length - 1;
  const gained = YOUTUBE_WEEKS[week] - YOUTUBE_WEEKS[Math.max(0, week - 1)];
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: 'Subscribers', value: 84_213, style: 'number' as const },
          { label: 'Avg views', value: 18_400, style: 'compact' as const },
          { label: 'Engagement', value: 5.2, style: 'percent' as const },
        ].map(stat => (
          <div key={stat.label} className="rounded-md border border-line p-2.5">
            <p className="truncate text-[10px] text-ink-muted">{stat.label}</p>
            <CountUp
              value={stat.value}
              style={stat.style}
              active={play}
              className="mt-1 block font-display text-base font-semibold text-ink"
            />
          </div>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col rounded-md border border-line p-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-ink">Subscribers, last 12 weeks</p>
          <span className="font-mono text-[10px] text-success">+12,413</span>
        </div>
        <AreaChart
          series={[{ values: YOUTUBE_WEEKS, tone: 'accent' }]}
          play={play}
          labels={MONTHS}
          focus={focus}
          anchors
          tooltip={
            <>
              <p className="font-mono text-[10px] text-ink-muted">Week {week + 1}</p>
              <p className="text-xs font-semibold text-ink tabular-nums">
                {formatNumber(YOUTUBE_WEEKS[week])}
                <span className="ml-1.5 font-mono text-[10px] font-normal text-success">+{formatNumber(gained)}</span>
              </p>
            </>
          }
          className="mt-2 min-h-0 flex-1"
        />
      </div>
    </div>
  );
}

const SPLIT = [
  { label: 'Shorts', share: 61, average: '24.1K', bar: 'bg-accent' },
  { label: 'Regular videos', share: 39, average: '15.8K', bar: 'bg-afterglow' },
];

// the month's uploads in the order they went up
const UPLOADS = [
  'short',
  'short',
  'regular',
  'short',
  'short',
  'short',
  'regular',
  'short',
  'short',
  'regular',
  'short',
  'regular',
  'short',
];

function CompareView() {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="rounded-md border border-line p-3.5">
        <p className="text-[11px] font-semibold text-ink">Views this month</p>
        <ul className="mt-3 flex flex-col gap-3.5">
          {SPLIT.map((row, i) => (
            <li key={row.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink">{row.label}</span>
                <span className="font-mono text-ink tabular-nums">{row.share}%</span>
              </div>
              <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-surface-sunken">
                <motion.span
                  className={cn('block h-full rounded-full', row.bar)}
                  initial={{ width: '0%' }}
                  animate={{ width: `${row.share}%` }}
                  transition={{ duration: 1, ease: EASE, delay: 0.2 + i * 0.12 }}
                />
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {SPLIT.map(row => (
          <div key={row.label} className="rounded-md border border-line p-2.5">
            <p className="truncate text-[10px] text-ink-muted">Avg views, {row.label.toLowerCase()}</p>
            <p className="mt-1 font-display text-base font-semibold text-ink tabular-nums">{row.average}</p>
          </div>
        ))}
      </div>
      <div className="rounded-md border border-line p-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-ink">Uploads this month</span>
          <span className="font-mono text-[10px] text-ink-muted">9 Shorts, 4 regular</span>
        </div>
        <div className="mt-2.5 flex gap-1">
          {UPLOADS.map((kind, i) => (
            <motion.span
              key={i}
              className={cn('h-5 flex-1 rounded-sm', kind === 'short' ? 'bg-accent/80' : 'bg-afterglow/80')}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: EASE, delay: 0.45 + i * 0.035 }}
            />
          ))}
        </div>
      </div>
      <motion.div
        className="mt-auto flex items-start gap-2.5 rounded-md bg-afterglow-soft p-3"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.9 }}
      >
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-afterglow-text" />
        <p className="text-xs leading-5 text-ink">
          <span className="font-semibold">Shorts vs long-form:</span> Shorts brought 61% of this month's views.
        </p>
      </motion.div>
    </div>
  );
}

// one channel's analytics: the numbers count up and the line draws, the cursor reads two weeks off the chart,
// then opens Shorts and regular to compare the two kinds of video
export function AnalyticsCard() {
  const ref = useRef<HTMLDivElement>(null);
  const { phase, loop, reduce } = useAutoplay(ref, STEPS);
  const comparing = phase >= PHASE.click;
  const focus = phase === PHASE.peek ? 7 : phase === PHASE.latest ? 11 : null;
  const target =
    reduce || phase < PHASE.peek || phase > PHASE.click
      ? null
      : phase === PHASE.peek
        ? 'point-7'
        : phase === PHASE.latest
          ? 'point-11'
          : `tab-${COMPARE_TAB}`;
  const clicks = loop + (phase >= PHASE.click ? 1 : 0);

  return (
    <div
      ref={ref}
      role="img"
      aria-label="A YouTube channel's analytics in Twiligent: subscribers, average views and engagement, a weekly growth chart, and how Shorts compare with regular videos."
      className="relative w-full max-w-[34rem]"
    >
      <PanelCard className="flex h-[28rem] flex-col p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-surface-sunken">
            <PlatformMark platform="youtube" className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-semibold text-ink">Northwind Kitchen</p>
            <p className="text-xs text-ink-muted">YouTube channel</p>
          </div>
          <span className="hidden rounded-full bg-surface-sunken px-2.5 py-1 text-[11px] font-medium text-ink-muted sm:inline">
            Last 12 weeks
          </span>
        </div>

        <LayoutGroup id="analytics-card-tabs">
          <div className="mt-4 flex gap-1 rounded-full bg-surface-sunken p-1">
            {TABS.map((tab, i) => {
              const active = comparing ? i === COMPARE_TAB : i === 0;
              return (
                <span
                  key={tab}
                  data-cursor={`tab-${i}`}
                  className={cn(
                    'relative flex-1 truncate rounded-full px-1 py-1.5 text-center text-[11px] font-medium transition-colors duration-300',
                    active ? 'text-ink' : 'text-ink-muted',
                    // a phone has room for three tabs
                    i === 1 && 'hidden sm:block',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="active-tab"
                      className="absolute inset-0 rounded-full bg-surface-raised shadow-sm"
                      transition={{ duration: 0.45, ease: EASE }}
                    />
                  )}
                  <span className="relative">{tab}</span>
                </span>
              );
            })}
          </div>
        </LayoutGroup>

        <div className="relative mt-4 min-h-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={comparing ? 'compare' : `overview-${loop}`}
              className="h-full"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.26, ease: EASE }}
            >
              {comparing ? <CompareView /> : <OverviewView play={phase >= PHASE.count} focus={focus} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </PanelCard>
      <Cursor stage={ref} target={target} clicks={clicks} />
    </div>
  );
}
