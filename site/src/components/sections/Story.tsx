import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ComponentType, MutableRefObject, ReactNode, RefObject } from 'react';
import { easeIn, easeOut, motion, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import type { MotionValue } from 'motion/react';
import { cn } from '@/lib/cn';
import { Logo } from '@/components/brand';
import { Bookmark, CalendarMark, Chart, Home, Library, Plane, Plug, UsersGroup } from '@/components/icons';
import type { Icon } from '@/components/icons';
import { PlatformMark } from '@/components/mockups/kit';
import {
  CalendarWindow,
  FilesWindow,
  InstagramWindow,
  NotesWindow,
  RedditWindow,
  SheetWindow,
  YouTubeStudioWindow,
} from './storyWindows';

// scroll progress is eased toward where the reader is rather than snapped to it, settling in about a third of a second
const SMOOTH = { stiffness: 140, damping: 30, mass: 0.6, restDelta: 0.0001 };

/* the windows */

interface FlyingWindowSpec {
  Comp: ComponentType;
  // where it rests, in percent of the stage
  at: [number, number];
  tilt: number;
  // where it flies in from, in vw and vh, and its tilt on the way
  from: [number, number, number];
  start: number;
  front: boolean;
}

// the first three sit behind the words and the rest pass over them, so the words read as caught in the middle of the pile
const WORDS_Z = 34;
const WINDOWS: FlyingWindowSpec[] = [
  { Comp: YouTubeStudioWindow, at: [50, 30], tilt: 2, from: [0, -115, 4], start: 0.3, front: false },
  { Comp: SheetWindow, at: [22, 34], tilt: -4, from: [-115, -31, -8], start: 0.312, front: false },
  { Comp: InstagramWindow, at: [78, 34], tilt: 3, from: [115, -42, 6], start: 0.33, front: false },
  { Comp: FilesWindow, at: [21, 71], tilt: 5, from: [-89, 63, 10], start: 0.345, front: true },
  { Comp: NotesWindow, at: [40, 68], tilt: -2, from: [-26, 100, -4], start: 0.37, front: true },
  { Comp: CalendarWindow, at: [67, 60], tilt: 6, from: [73, 13, 12], start: 0.35, front: true },
  { Comp: RedditWindow, at: [80, 72], tilt: -5, from: [73, 58, -10], start: 0.385, front: true },
];
const FLY_IN = 0.14;
const LEAVE = 0.605;
const LEAVE_GAP = 0.009;
const LEAVE_FOR = 0.065;

interface FlyingWindowProps {
  win: FlyingWindowSpec;
  index: number;
  progress: MotionValue<number>;
  size: number;
}

function FlyingWindow({ win, index, progress, size }: FlyingWindowProps) {
  const [ax, ay] = win.at;
  const [fx, fy, fr] = win.from;
  const a = win.start;
  const b = a + FLY_IN;
  const c = LEAVE + index * LEAVE_GAP;
  const d = c + LEAVE_FOR;
  const ease = [easeOut, (t: number) => t, easeIn];

  // in from off screen, rest, then drawn into the middle of the screen
  const x = useTransform(progress, [a, b, c, d], [`${fx}vw`, '0vw', '0vw', `${50 - ax}vw`], { ease });
  const y = useTransform(progress, [a, b, c, d], [`${fy}vh`, '0vh', '0vh', `${50 - ay}vh`], { ease });
  const rotate = useTransform(progress, [a, b, c, d], [fr, win.tilt, win.tilt, 0], { ease });
  const scale = useTransform(progress, [c, d], [size, size * 0.05], { ease: easeIn });
  const opacity = useTransform(progress, [a, a + 0.004, c, d - 0.01], [0, 1, 1, 0]);

  const { Comp } = win;
  return (
    // a point with no size at the resting place, so the window scales and tilts about its own centre
    <motion.div
      className="absolute size-0 will-change-transform"
      style={{
        left: `${ax}%`,
        top: `${ay}%`,
        x,
        y,
        rotate,
        scale,
        opacity,
        zIndex: win.front ? WORDS_Z + 1 : WORDS_Z - 1,
      }}
    >
      <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2">
        <Comp />
      </div>
    </motion.div>
  );
}

/* the ring */

type Enter = ['scale', number] | ['blur'];

interface RingNodeSpec {
  id: string;
  at: [number, number];
  tilt: number;
  show: number;
  enter: Enter;
  label?: string;
  icon?: Icon;
}

// what Twiligent brings together: the three platforms at the top, then what it does with them around the sides
const NODES: RingNodeSpec[] = [
  { id: 'platforms', at: [50, 7.5], tilt: 0, show: 0.685, enter: ['scale', 0.62] },
  { id: 'overview', at: [12, 17.5], tilt: -2, show: 0.7, enter: ['scale', 0.96], label: 'Overview', icon: Home },
  { id: 'publishing', at: [88, 17.5], tilt: 2, show: 0.7, enter: ['scale', 0.96], label: 'Publishing', icon: Plane },
  { id: 'libraries', at: [8.8, 50], tilt: 1.5, show: 0.73, enter: ['blur'], label: 'Libraries', icon: Library },
  {
    id: 'scheduling',
    at: [91.2, 50],
    tilt: -1.5,
    show: 0.745,
    enter: ['scale', 0.96],
    label: 'Scheduling',
    icon: CalendarMark,
  },
  {
    id: 'tracked',
    at: [13, 82.5],
    tilt: 2,
    show: 0.77,
    enter: ['scale', 0.62],
    label: 'Tracked content',
    icon: Bookmark,
  },
  { id: 'teams', at: [87, 82.5], tilt: -2, show: 0.77, enter: ['scale', 0.96], label: 'Teams', icon: UsersGroup },
  { id: 'accounts', at: [38.5, 92.5], tilt: -1, show: 0.795, enter: ['blur'], label: 'Accounts', icon: Plug },
  { id: 'analytics', at: [61.5, 92.5], tilt: 1, show: 0.8, enter: ['scale', 0.86], label: 'Analytics', icon: Chart },
];

type WireKind = 'top' | 'down' | 'across' | 'straight';

interface WireSpec {
  from: string;
  to: string;
  kind: WireKind;
  draw: [number, number];
  accent?: boolean;
}

// in the order they grow: out from the platforms at the top, down both sides, meeting along the bottom
const WIRES: WireSpec[] = [
  { from: 'platforms', to: 'overview', kind: 'top', draw: [0.655, 0.7] },
  { from: 'platforms', to: 'publishing', kind: 'top', draw: [0.655, 0.7] },
  { from: 'overview', to: 'libraries', kind: 'down', draw: [0.685, 0.745], accent: true },
  { from: 'publishing', to: 'scheduling', kind: 'down', draw: [0.685, 0.745], accent: true },
  { from: 'libraries', to: 'tracked', kind: 'down', draw: [0.72, 0.765] },
  { from: 'scheduling', to: 'teams', kind: 'down', draw: [0.72, 0.765] },
  { from: 'tracked', to: 'accounts', kind: 'across', draw: [0.745, 0.8] },
  { from: 'teams', to: 'analytics', kind: 'across', draw: [0.745, 0.8] },
  { from: 'accounts', to: 'analytics', kind: 'straight', draw: [0.795, 0.84] },
];

const GAP = 6;
const RADIUS = 16;

type Point = [number, number];

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

// a path through right-angled points, each corner rounded
function rounded(points: Point[]): string {
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    const r = Math.min(RADIUS, Math.hypot(cx - px, cy - py) / 2, Math.hypot(nx - cx, ny - cy) / 2);
    const inX = cx - Math.sign(cx - px) * r;
    const inY = cy - Math.sign(cy - py) * r;
    const outX = cx + Math.sign(nx - cx) * r;
    const outY = cy + Math.sign(ny - cy) * r;
    d += ` L ${inX} ${inY} Q ${cx} ${cy} ${outX} ${outY}`;
  }
  const [lx, ly] = points[points.length - 1];
  return `${d} L ${lx} ${ly}`;
}

// the points for one wire, from the measured boxes of the two nodes it joins
function route(wire: WireSpec, a: Box, b: Box, width: number): Point[] {
  const toRight = b.cx > a.cx;
  const side = (box: Box, right: boolean) => (right ? box.x + box.w + GAP : box.x - GAP);
  if (wire.kind === 'top') {
    const start: Point = [side(a, toRight), a.cy];
    const end: Point = [side(b, !toRight), b.cy];
    const bend = toRight ? width * 0.668 : width * 0.332;
    return [start, [bend, a.cy], [bend, b.cy], end];
  }
  if (wire.kind === 'down') {
    const start: Point = [a.cx, a.y + a.h + GAP];
    const end: Point = [b.cx, b.y - GAP];
    const mid = (start[1] + end[1]) / 2;
    return [start, [a.cx, mid], [b.cx, mid], end];
  }
  if (wire.kind === 'across') {
    const start: Point = [side(a, toRight), a.cy];
    const end: Point = [side(b, !toRight), b.cy];
    const mid = (start[0] + end[0]) / 2;
    return [start, [mid, a.cy], [mid, b.cy], end];
  }
  return [
    [side(a, toRight), a.cy],
    [side(b, !toRight), b.cy],
  ];
}

interface WireLayout extends WireSpec {
  d: string;
  ends: [Point, Point];
}

interface RingLayout {
  width: number;
  height: number;
  wires: WireLayout[];
}

function useRing(
  boxRef: RefObject<HTMLDivElement | null>,
  nodeRefs: MutableRefObject<Record<string, HTMLDivElement | null>>,
): RingLayout | null {
  const [layout, setLayout] = useState<RingLayout | null>(null);
  const measure = useCallback(() => {
    const box = boxRef.current;
    if (!box) return;
    const boxes: Record<string, Box> = {};
    for (const node of NODES) {
      const el = nodeRefs.current[node.id];
      if (!el) return;
      // offsets, not bounding boxes: nodes are scaled and tilted while they enter, and wires must meet where they rest
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const cx = (node.at[0] / 100) * box.offsetWidth;
      const cy = (node.at[1] / 100) * box.offsetHeight;
      boxes[node.id] = { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy };
    }
    setLayout({
      width: box.offsetWidth,
      height: box.offsetHeight,
      wires: WIRES.map(wire => {
        const points = route(wire, boxes[wire.from], boxes[wire.to], box.offsetWidth);
        return { ...wire, d: rounded(points), ends: [points[0], points[points.length - 1]] };
      }),
    });
  }, [boxRef, nodeRefs]);

  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (boxRef.current) observer.observe(boxRef.current);
    // the headline font can change a node's width once it loads
    document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [boxRef, measure]);

  return layout;
}

function Wire({ wire, progress }: { wire: WireLayout; progress: MotionValue<number> }) {
  const [a, b] = wire.draw;
  const length = useTransform(progress, [a, b], [0, 1]);
  // a round cap draws a dot even at no length, so the wire stays hidden until it starts to grow
  const shown = useTransform(progress, [a, a + 0.001], [0, 1]);
  const startDot = useTransform(progress, [a, a + 0.005], [0, 1]);
  const endDot = useTransform(progress, [b - 0.005, b], [0, 1]);
  return (
    <>
      <motion.path
        d={wire.d}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        className={wire.accent ? 'stroke-accent' : 'stroke-line-strong'}
        style={{ pathLength: length, opacity: shown }}
      />
      <motion.circle
        cx={wire.ends[0][0]}
        cy={wire.ends[0][1]}
        r="3"
        className="fill-ink"
        style={{ opacity: startDot }}
      />
      <motion.circle cx={wire.ends[1][0]} cy={wire.ends[1][1]} r="3" className="fill-ink" style={{ opacity: endDot }} />
    </>
  );
}

function NodeCard({ node }: { node: RingNodeSpec }) {
  if (node.id === 'platforms') {
    return (
      <div className="flex">
        {(['youtube', 'instagram', 'reddit'] as const).map((platform, i) => (
          <span
            key={platform}
            className={cn(
              'flex size-12 items-center justify-center rounded-full border border-line bg-surface-raised shadow-sm',
              i > 0 && '-ml-1.5',
            )}
          >
            <PlatformMark platform={platform} className="size-5" />
          </span>
        ))}
      </div>
    );
  }
  const Icon = node.icon;
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-line bg-surface-raised px-4 py-3 whitespace-nowrap shadow-md">
      {Icon && <Icon className="size-5 shrink-0 text-accent-text" />}
      <span className="text-[17px] leading-none text-ink">{node.label}</span>
    </div>
  );
}

function RingNode({
  node,
  progress,
  nodeRef,
}: {
  node: RingNodeSpec;
  progress: MotionValue<number>;
  nodeRef: (el: HTMLDivElement | null) => void;
}) {
  const during = [node.show, node.show + 0.035];
  const blur = node.enter[0] === 'blur';
  const opacity = useTransform(progress, during, [0, 1]);
  const scale = useTransform(progress, during, [node.enter[0] === 'scale' ? node.enter[1] : 1, 1], { ease: easeOut });
  const y = useTransform(progress, during, [blur ? 20 : 0, 0], { ease: easeOut });
  const filter = useTransform(progress, during, [blur ? 'blur(4px)' : 'blur(0px)', 'blur(0px)']);
  return (
    <motion.div
      className="absolute size-0"
      style={{ left: `${node.at[0]}%`, top: `${node.at[1]}%`, opacity, scale, y, filter, rotate: node.tilt }}
    >
      <div ref={nodeRef} className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2">
        <NodeCard node={node} />
      </div>
    </motion.div>
  );
}

function Ring({ progress }: { progress: MotionValue<number> }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const layout = useRing(boxRef, nodeRefs);
  return (
    <div ref={boxRef} aria-hidden="true" className="absolute inset-x-0 top-[14%] bottom-[4.5%] z-[2] hidden lg:block">
      {layout && (
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="absolute inset-0 size-full overflow-visible">
          {layout.wires.map(wire => (
            <Wire key={`${wire.from}-${wire.to}`} wire={wire} progress={progress} />
          ))}
        </svg>
      )}
      {NODES.map(node => (
        <RingNode
          key={node.id}
          node={node}
          progress={progress}
          nodeRef={el => {
            nodeRefs.current[node.id] = el;
          }}
        />
      ))}
    </div>
  );
}

/* the words */

const STATEMENT =
  'display mx-auto max-w-[20ch] text-center text-[40px] leading-[44px] text-ink md:text-[64px] md:leading-[68px] xl:text-[76px] xl:leading-[80px]';

function Resolution() {
  return (
    <div className="mx-auto text-center">
      <Logo className="mx-auto h-11 md:h-14" />
      <p className="display mx-auto mt-7 max-w-[14ch] text-[40px] leading-[44px] text-ink md:text-[60px] md:leading-[64px]">
        Twiligent puts them in <span className="text-accent-text">one view.</span>
      </p>
    </div>
  );
}

function NodeChip({ node }: { node: RingNodeSpec }) {
  const Icon = node.icon;
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-line bg-surface-raised px-3 py-2.5">
      {Icon && <Icon className="size-4 shrink-0 text-accent-text" />}
      <span className="text-[15px] leading-tight text-ink">{node.label}</span>
    </div>
  );
}

const CHIPS = NODES.filter(node => node.label);

function ChipGrid({ className }: { className?: string }) {
  return (
    <ul className={cn('mx-auto grid w-full max-w-md grid-cols-2 gap-2', className)}>
      {CHIPS.map(node => (
        <li key={node.id}>
          <NodeChip node={node} />
        </li>
      ))}
    </ul>
  );
}

// the same three moments as plain sections, for readers who ask for less motion
function StillStory() {
  return (
    <div className="container-page space-y-24 py-24 md:py-32">
      <h2 id="story-heading" className={STATEMENT}>
        You post in three places.
      </h2>
      <p className={STATEMENT}>Each one keeps its numbers somewhere else.</p>
      <div>
        <Resolution />
        <ChipGrid className="mt-12 max-w-2xl sm:grid-cols-4" />
      </div>
    </div>
  );
}

// windows are drawn at laptop size and scale with the screen, never below a size that still reads as a window
function useWindowScale(): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => setScale(Math.min(1.12, Math.max(0.5, window.innerWidth / 1440)));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return scale;
}

interface BeatProps {
  opacity: MotionValue<number>;
  filter: MotionValue<string>;
  y?: MotionValue<number>;
  z: number;
  children: ReactNode;
}

function Beat({ opacity, filter, y, z, children }: BeatProps) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 flex items-center justify-center px-5"
      style={{ opacity, filter, y, zIndex: z }}
    >
      {children}
    </motion.div>
  );
}

function MovingStory() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const size = useWindowScale();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] });
  // the spring also keeps every value on one clock, so opacity and blur do not run on the browser's own scroll timeline
  const progress = useSpring(scrollYProgress, SMOOTH);

  const oneOpacity = useTransform(progress, [0.22, 0.3], [1, 0]);
  const oneBlur = useTransform(progress, [0.22, 0.3], ['blur(0px)', 'blur(5px)']);
  const twoOpacity = useTransform(progress, [0.24, 0.32, 0.56, 0.6], [0, 1, 1, 0]);
  const twoBlur = useTransform(progress, [0.24, 0.32, 0.56, 0.6], ['blur(5px)', 'blur(0px)', 'blur(0px)', 'blur(5px)']);
  const endOpacity = useTransform(progress, [0.62, 0.66], [0, 1]);
  const endBlur = useTransform(progress, [0.62, 0.66], ['blur(5px)', 'blur(0px)']);
  const endY = useTransform(progress, [0.62, 0.66], [14, 0], { ease: easeOut });

  return (
    <div ref={sectionRef} className="relative h-[420vh]">
      <div className="sticky top-0 h-svh overflow-hidden">
        <Ring progress={progress} />
        <div aria-hidden="true">
          {WINDOWS.map((win, i) => (
            <FlyingWindow key={i} win={win} index={i} progress={progress} size={size} />
          ))}
        </div>
        {/* a glow of the page colour over the ring and under every window, so no wire runs through a line of text */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[3] bg-[radial-gradient(40%_21%_at_50%_50%,var(--surface)_58%,color-mix(in_oklab,var(--surface)_78%,transparent)_73%,color-mix(in_oklab,var(--surface)_26%,transparent)_88%,transparent_100%)]"
        />
        <Beat opacity={oneOpacity} filter={oneBlur} z={WORDS_Z}>
          <h2 id="story-heading" className={STATEMENT}>
            You post in three places.
          </h2>
        </Beat>
        <Beat opacity={twoOpacity} filter={twoBlur} z={WORDS_Z}>
          <p className={STATEMENT}>Each one keeps its numbers somewhere else.</p>
        </Beat>
        <Beat opacity={endOpacity} filter={endBlur} y={endY} z={WORDS_Z}>
          <div>
            <Resolution />
            {/* the ring needs a wide screen; smaller screens list the same places beneath the words */}
            <ChipGrid className="mt-8 lg:hidden" />
          </div>
        </Beat>
      </div>
    </div>
  );
}

export function Story() {
  const reduce = useReducedMotion();
  return (
    <section id="story" aria-labelledby="story-heading" className="relative bg-surface">
      {reduce ? <StillStory /> : <MovingStory />}
    </section>
  );
}
