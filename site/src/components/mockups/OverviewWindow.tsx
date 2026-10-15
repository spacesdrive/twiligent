import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import {
  Bookmark,
  CalendarMark,
  Chart,
  ClockCircle,
  Gallery,
  Home,
  Plane,
  RefreshCircle,
  UsersGroup,
  Videocamera,
  Widget,
} from '@/components/icons';
import { Mark } from '@/components/brand';
import { PlatformMark, Window } from './kit';
import { AreaChart } from './AreaChart';
import type { ChartTone } from './AreaChart';
import { ACCOUNTS, INSTAGRAM_WEEKS, MONTHS, YOUTUBE_WEEKS } from './sample';

const NAV = [
  { label: 'Overview', icon: Home, active: true },
  { label: 'Videos', icon: Videocamera },
  { label: 'Shorts', icon: Widget },
  { label: 'Instagram content', icon: Gallery },
  { label: 'Reddit posts', icon: Chart },
  { label: 'Tracked content', icon: Bookmark },
];

interface Tile {
  label: string;
  value: string;
  change: string;
  trend: number[];
  tone: ChartTone;
  wide?: boolean;
}

const TOTAL = ACCOUNTS.reduce((sum, account) => sum + account.audience, 0);

const TILES: Tile[] = [
  {
    label: 'Total audience',
    value: formatNumber(TOTAL, 'compact'),
    change: '+3.1%',
    trend: YOUTUBE_WEEKS,
    tone: 'accent',
  },
  {
    label: 'Views, last 30 days',
    value: '1.9M',
    change: '+12.6%',
    trend: [3, 4, 3.6, 4.4, 5, 4.6, 5.6, 6.1, 5.8, 6.8, 7.4, 8],
    tone: 'afterglow',
  },
  {
    label: 'Engagement',
    value: '4.8%',
    change: '+0.4 pts',
    trend: [4.1, 4.3, 4.2, 4.4, 4.3, 4.5, 4.6, 4.5, 4.7, 4.6, 4.8, 4.8],
    tone: 'accent',
    wide: true,
  },
  {
    label: 'Posts scheduled',
    value: '14',
    change: '3 this week',
    trend: [2, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8],
    tone: 'afterglow',
    wide: true,
  },
];

// delays for the parts as the window settles in, in milliseconds
const delay = (ms: number) => ({ '--delay': `${ms}ms` }) as CSSProperties;

// the Overview page of the app, settling in piece by piece in CSS alone, so the hero never waits on the animation library
export function OverviewWindow({ className }: { className?: string }) {
  const top = ACCOUNTS[0].audience;
  return (
    <div
      role="img"
      aria-label="The Twiligent Overview: audience totals, a growth chart, the top accounts across YouTube, Instagram and Reddit, and the next scheduled post."
      className={className}
    >
      <Window url="app.twiligent.ujjwal.fyi" bodyClassName="flex h-[30rem] md:h-[34rem]">
        <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-line bg-surface-sunken/40 p-3 md:flex">
          <div className="flex items-center gap-2 px-2 pt-1 pb-4">
            <Mark className="h-5" />
            <span className="font-display text-sm font-semibold text-ink">Twiligent</span>
          </div>
          {NAV.map(item => {
            const Icon = item.icon;
            return (
              <span
                key={item.label}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px]',
                  item.active ? 'bg-surface-raised font-medium text-ink shadow-sm' : 'text-ink-muted',
                )}
              >
                <Icon className={cn('size-4', item.active && 'text-accent-text')} />
                {item.label}
              </span>
            );
          })}
          <span className="mt-3 border-t border-line pt-3" />
          <span className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-ink-muted">
            <Plane className="size-4" />
            Publish
          </span>
          <span className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-ink-muted">
            <UsersGroup className="size-4" />
            Accounts
          </span>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-lg font-semibold text-ink md:text-xl">Overview</p>
              <p className="text-xs text-ink-muted">{ACCOUNTS.length} accounts across YouTube, Instagram and Reddit</p>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-medium text-ink-muted">
                Last 12 weeks
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink">
                <RefreshCircle className="size-4" />
                Refresh
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {TILES.map((tile, i) => (
              <div
                key={tile.label}
                className={cn(
                  'rise-in flex flex-col rounded-md border border-line bg-surface-raised p-3',
                  tile.wide && 'hidden lg:flex',
                )}
                style={delay(150 + i * 90)}
              >
                <p className="text-[11px] font-medium text-ink-muted">{tile.label}</p>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <div>
                    <p className="font-display text-lg font-semibold tracking-tight text-ink tabular-nums">
                      {tile.value}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-success">{tile.change}</p>
                  </div>
                  <AreaChart
                    series={[{ values: tile.trend, tone: tile.tone }]}
                    play
                    gridLines={0}
                    dots={false}
                    delay={350 + i * 90}
                    className="h-9 w-16 shrink-0"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_15.5rem]">
            <div className="rise-in flex min-h-0 flex-col rounded-md border border-line p-4" style={delay(420)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-ink">Audience growth</p>
                  <p className="mt-0.5 font-mono text-[10px] text-ink-muted">Subscribers and followers, weekly</p>
                </div>
                <span className="flex gap-3 text-[10px] text-ink-muted">
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-accent" />
                    YouTube
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-afterglow" />
                    Instagram
                  </span>
                </span>
              </div>
              <AreaChart
                series={[
                  { values: YOUTUBE_WEEKS, tone: 'accent' },
                  { values: INSTAGRAM_WEEKS.map(v => v * 2.2), tone: 'afterglow' },
                ]}
                play
                labels={MONTHS}
                delay={600}
                className="mt-3 min-h-28 flex-1"
              />
            </div>

            <div className="hidden min-h-0 flex-col gap-3 lg:flex">
              <div className="rise-in flex flex-col rounded-md border border-line p-3" style={delay(520)}>
                <p className="text-xs font-semibold text-ink">Top accounts</p>
                <ul className="mt-2 flex flex-col gap-2.5">
                  {ACCOUNTS.map((account, i) => (
                    <li key={account.name} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 font-mono text-[11px] text-ink-muted">{i + 1}</span>
                        <PlatformMark platform={account.platform} className="size-4" />
                        <span className="min-w-0 flex-1 truncate text-xs text-ink">{account.name}</span>
                        <span className="font-mono text-xs text-ink tabular-nums">
                          {formatNumber(account.audience, 'compact')}
                        </span>
                      </div>
                      <span className="ml-5.5 h-1 overflow-hidden rounded-full bg-surface-sunken">
                        <span
                          className={cn('grow-x block h-full rounded-full', i === 0 ? 'bg-accent' : 'bg-line-strong')}
                          style={{ width: `${(account.audience / top) * 100}%`, ...delay(800 + i * 110) }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rise-in flex flex-1 flex-col rounded-md border border-line p-3" style={delay(640)}>
                <p className="text-xs font-semibold text-ink">Next scheduled</p>
                <div className="mt-2.5 flex items-center gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-text">
                    <Videocamera className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink">Lemon orzo Reel</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-ink-muted">
                      <CalendarMark className="size-3" />
                      Thursday, 18:00
                    </p>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-afterglow-soft px-2 py-0.5 text-[10px] font-semibold text-afterglow-text">
                    <ClockCircle className="size-3" />
                    Pending
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Window>
    </div>
  );
}
