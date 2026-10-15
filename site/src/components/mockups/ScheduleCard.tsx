import { useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { useAutoplay } from '@/hooks/useAutoplay';
import { CalendarMark, CheckCircle, ClockCircle, RefreshCircle, Upload, Videocamera } from '@/components/icons';
import { PanelCard, PlatformMark } from './kit';
import { Cursor } from './Cursor';
import { Typed } from './Typed';

// how long each moment holds, in seconds, and what happens in it
const STEPS = [0.6, 0.8, 1.5, 0.8, 3.2, 0.8, 0.7, 0.8, 0.6, 0.8, 1.9, 1.3, 3.4];
const PHASE = {
  atUpload: 1,
  upload: 2,
  atCaption: 3,
  caption: 4,
  atDate: 5,
  openDate: 6,
  atSlot: 7,
  pickSlot: 8,
  atSchedule: 9,
  schedule: 10,
  publishing: 11,
  published: 12,
} as const;
const CLICKS: number[] = [PHASE.upload, PHASE.caption, PHASE.openDate, PHASE.pickSlot, PHASE.schedule];

const TARGETS: Record<number, string> = {
  [PHASE.atUpload]: 'upload',
  [PHASE.upload]: 'upload',
  [PHASE.atCaption]: 'caption',
  [PHASE.caption]: 'caption',
  [PHASE.atDate]: 'date',
  [PHASE.openDate]: 'date',
  [PHASE.atSlot]: 'slot',
  [PHASE.pickSlot]: 'slot',
  [PHASE.atSchedule]: 'schedule',
  [PHASE.schedule]: 'schedule',
};

const CAPTION = 'One-pan lemon orzo in 20 minutes. Recipe in the comments.\n\n#recipes #onepan #weeknightdinner';

// hashtags in the brand red, the rest as typed
function withTags(typed: string) {
  return typed.split(/(#\w*)/).map((part, i) =>
    part.startsWith('#') ? (
      <span key={i} className="text-accent-text">
        {part}
      </span>
    ) : (
      part
    ),
  );
}
const SLOTS = ['Today, 21:00', 'Thursday, 18:00', 'Friday, 12:30'];
const PICKED = 1;

// enter and leave curves measured from the Activepieces menus
const ENTER = [0.16, 1, 0.3, 1] as const;
const LEAVE = [0.4, 0, 0.9, 0.4] as const;
const SWAP = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.26, ease: ENTER },
};

type Status = 'Draft' | 'Pending' | 'Publishing' | 'Published';

const STATUS_STYLE: Record<Status, string> = {
  Draft: 'bg-surface-sunken text-ink-muted',
  Pending: 'bg-afterglow-soft text-afterglow-text',
  Publishing: 'bg-info-soft text-info',
  Published: 'bg-success-soft text-success',
};

function statusAt(phase: number): Status {
  if (phase >= PHASE.published) return 'Published';
  if (phase >= PHASE.publishing) return 'Publishing';
  if (phase >= PHASE.schedule) return 'Pending';
  return 'Draft';
}

function StatusBadge({ status }: { status: Status }) {
  const Icon = status === 'Published' ? CheckCircle : status === 'Publishing' ? RefreshCircle : ClockCircle;
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={status}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
          STATUS_STYLE[status],
        )}
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.7 }}
        transition={{ duration: 0.24, ease: ENTER }}
      >
        <Icon className={cn('size-4', status === 'Publishing' && 'animate-spin')} />
        {status}
      </motion.span>
    </AnimatePresence>
  );
}

// a Reel set up for later, clicked through by a cursor: the video, the caption, the time, Schedule post,
// then the server publishing it at that time
export function ScheduleCard() {
  const ref = useRef<HTMLDivElement>(null);
  const { phase, loop, reduce } = useAutoplay(ref, STEPS);
  const uploaded = phase >= PHASE.upload;
  const dateOpen = phase === PHASE.openDate || phase === PHASE.atSlot;
  const datePicked = phase >= PHASE.pickSlot;
  const ready = datePicked;
  const status = statusAt(phase);
  const target = reduce ? null : (TARGETS[phase] ?? null);
  const clicks = loop * CLICKS.length + CLICKS.filter(p => phase >= p).length;
  const toast = phase === PHASE.schedule || phase === PHASE.publishing;

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Scheduling an Instagram Reel in Twiligent: the video uploads, the caption is written, Thursday at 18:00 is picked, Schedule post is clicked, and the server publishes the post at that time."
      className="relative w-full max-w-[34rem]"
    >
      <PanelCard className="flex h-[28rem] flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <PlatformMark platform="instagram" className="size-5 shrink-0" />
            <p className="truncate text-sm font-semibold text-ink">@northwind.kitchen</p>
          </div>
          <div className="flex gap-0.5 rounded-full bg-surface-sunken p-0.5 text-[11px] font-medium">
            {['Photo', 'Reel', 'Story'].map(kind => (
              <span
                key={kind}
                className={cn(
                  'rounded-full px-2.5 py-1',
                  kind === 'Reel' ? 'bg-surface-raised text-ink shadow-sm' : 'text-ink-muted',
                )}
              >
                {kind}
              </span>
            ))}
          </div>
        </div>

        <div
          data-cursor="upload"
          className={cn(
            'mt-4 flex h-[4.25rem] items-center gap-3 rounded-md border p-3 transition-colors duration-300',
            uploaded ? 'border-line' : 'border-dashed border-line-strong',
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            {uploaded ? (
              <motion.div key="file" className="flex min-w-0 flex-1 items-center gap-3" {...SWAP}>
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-fold text-on-accent">
                  <Videocamera className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-mono text-xs text-ink">lemon-orzo-reel.mp4</p>
                    <span className="font-mono text-[10px] text-ink-muted">48 MB</span>
                  </div>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                    <motion.span
                      className="block h-full rounded-full bg-accent"
                      initial={{ width: reduce ? '100%' : '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 1.1, ease: ENTER, delay: 0.1 }}
                    />
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" className="flex min-w-0 flex-1 items-center gap-3" {...SWAP}>
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-sunken text-ink-muted">
                  <Upload className="size-5" />
                </span>
                <div>
                  <p className="text-[13px] font-medium text-ink">Choose a video</p>
                  <p className="text-[11px] text-ink-muted">MP4 or MOV, up to 300MB</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div
          data-cursor="caption"
          className={cn(
            'mt-3 flex min-h-0 flex-1 flex-col rounded-md border p-3 transition-colors duration-300',
            phase >= PHASE.caption ? 'border-ink-muted/60' : 'border-line',
          )}
        >
          <p className="text-[13px] leading-5 whitespace-pre-line text-ink">
            {phase >= PHASE.caption ? (
              <Typed key={loop} text={CAPTION} active speed={34} render={withTags} />
            ) : (
              <span className="text-ink-muted">Write a caption</span>
            )}
          </p>
          <p className="mt-auto self-end font-mono text-[10px] text-ink-muted">
            {phase >= PHASE.caption ? CAPTION.length : 0} / 2,200
          </p>
        </div>

        <div className="relative mt-3">
          <AnimatePresence>
            {dateOpen && (
              <motion.ul
                className="absolute right-0 bottom-full left-0 z-20 mb-2 flex flex-col gap-0.5 rounded-md border border-line bg-surface-raised p-1.5 shadow-lg"
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.36, ease: ENTER } }}
                exit={{ opacity: 0, y: 6, scale: 0.97, transition: { duration: 0.2, ease: LEAVE } }}
                style={{ transformOrigin: 'bottom center' }}
              >
                {SLOTS.map((slot, i) => (
                  <li
                    key={slot}
                    data-cursor={i === PICKED ? 'slot' : undefined}
                    className={cn(
                      'flex items-center justify-between rounded-sm px-2.5 py-2 text-[13px] transition-colors duration-200',
                      i === PICKED && phase === PHASE.atSlot ? 'bg-surface-sunken text-ink' : 'text-ink-muted',
                    )}
                  >
                    {slot}
                    {i === PICKED && <CalendarMark className="size-3.5" />}
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
          <div
            data-cursor="date"
            className={cn(
              'flex items-center gap-2 rounded-md border p-3 text-[13px] transition-colors duration-300',
              dateOpen ? 'border-ink-muted/60' : 'border-line',
            )}
          >
            <CalendarMark className="size-4 text-ink-muted" />
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={datePicked ? 'picked' : 'empty'}
                className={datePicked ? 'text-ink' : 'text-ink-muted'}
                {...SWAP}
              >
                {datePicked ? SLOTS[PICKED] : 'Pick a date and time'}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <StatusBadge status={status} />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full px-3 py-2 text-xs font-semibold text-ink-muted sm:inline">
              Publish now
            </span>
            <motion.span
              data-cursor="schedule"
              className={cn(
                'rounded-full px-4 py-2 text-xs font-semibold transition-colors duration-300',
                ready ? 'bg-accent text-on-accent' : 'bg-surface-sunken text-ink-muted',
              )}
              animate={{ scale: phase === PHASE.schedule ? [1, 0.95, 1] : 1 }}
              transition={{ duration: 0.26 }}
            >
              Schedule post
            </motion.span>
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={status}
            className="mt-2 h-4 font-mono text-[10px] text-ink-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {status === 'Pending' && 'Publishes Thursday at 18:00, browser open or not'}
            {status === 'Publishing' && 'Thursday, 18:00: publishing now'}
            {status === 'Published' && 'Published by the server at 18:04'}
          </motion.p>
        </AnimatePresence>

        <AnimatePresence>
          {toast && (
            <motion.div
              className="absolute inset-x-5 top-5 z-20 flex items-center gap-2.5 rounded-md border border-line bg-surface-raised px-3.5 py-3 shadow-lg"
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.36, ease: ENTER } }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.2, ease: LEAVE } }}
            >
              <CheckCircle className="size-5 shrink-0 text-success" />
              <p className="text-[13px] font-semibold text-ink">Post scheduled</p>
              <p className="ml-auto font-mono text-[11px] text-ink-muted">Thursday, 18:00</p>
            </motion.div>
          )}
        </AnimatePresence>
      </PanelCard>
      <Cursor stage={ref} target={target} clicks={clicks} />
    </div>
  );
}
