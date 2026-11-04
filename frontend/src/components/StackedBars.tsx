import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import SurfaceBox from '@/components/SurfaceBox';
import SegmentedChoice from '@/components/SegmentedChoice';
import RollingNumber from '@/components/RollingNumber';
import LiveStatus from '@/components/LiveStatus';
import { stackedColumns, tooltipLeft } from '@/lib/stackedBars';
import type { StackedPoint } from '@/lib/stackedBars';
import { fmtNumFull } from '@/utils/formatters';

export interface StackedSeries {
  label: string;
  // a design token colour, such as SERIES.primary
  color: string;
}

export interface StackedView {
  id: string;
  label: string;
  points: StackedPoint[];
}

export interface StackedBarsProps {
  title: string;
  subtitle?: string;
  // what one count is, in the plural ("posts", "comments")
  unit: string;
  series: StackedSeries[];
  // one view, or several the person switches between (by day, by week)
  views: StackedView[];
  height?: number;
  gap?: number;
  className?: string;
}

const TIP_WIDTH = 152;

// adapted from Bencho's Stacked bars (MIT, see THIRD_PARTY_NOTICES.md): run along the bars, or use the arrow keys, and
// one column is ringed while a tooltip glides beside it with the period, the total and what made it up
export default function StackedBars({ title, subtitle, unit, series, views, height = 120, gap = 6, className }: StackedBarsProps) {
  const [viewId, setViewId] = useState(views[0]?.id ?? '');
  const view = views.find(item => item.id === viewId) ?? views[0];
  const points = useMemo(() => view?.points ?? [], [view]);
  const [at, setAt] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  // without IntersectionObserver the bars draw at once
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');
  const plot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = plot.current;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(node);
    // the bars grow out of the baseline the first time the card is on screen
    if (typeof IntersectionObserver === 'undefined') return () => resize.disconnect();
    const visible = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setSeen(true);
        visible.disconnect();
      }
    }, { threshold: 0.3 });
    visible.observe(node);
    return () => {
      resize.disconnect();
      visible.disconnect();
    };
  }, []);

  const columns = useMemo(() => stackedColumns(points, width, height, gap), [points, width, height, gap]);
  const total = columns.reduce((sum, column) => sum + column.total, 0);
  const active = at !== null && at < columns.length ? at : null;
  const current = active === null ? null : points[active];
  const column = active === null ? null : columns[active];

  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const box = plot.current?.getBoundingClientRect();
    if (!box || box.width === 0 || points.length === 0) return;
    const index = Math.floor(((event.clientX - box.left) / box.width) * points.length);
    setAt(Math.max(0, Math.min(points.length - 1, index)));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = points.length - 1;
    const moves: Record<string, number> = {
      ArrowLeft: Math.max(0, (active ?? last + 1) - 1),
      ArrowRight: Math.min(last, (active ?? -1) + 1),
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      setAt(moves[event.key]);
    } else if (event.key === 'Escape') {
      setAt(null);
    }
  };

  const status = current
    ? `${current.label}: ${fmtNumFull(columns[active!].total)} ${unit}. ${series
      .map((item, index) => `${item.label} ${fmtNumFull(current.values[index] ?? 0)}`)
      .join(', ')}.`
    : '';

  return (
    <SurfaceBox
      title={title}
      subheader={subtitle}
      className={className}
      secondary={views.length > 1 ? (
        <SegmentedChoice
          name={`${title}-range`}
          options={views.map(item => ({ value: item.id, label: item.label }))}
          value={view?.id ?? ''}
          onChange={next => { setViewId(next); setAt(null); }}
        />
      ) : undefined}
    >
      <div className="stb flex flex-col gap-3" data-scrub={current ? '' : undefined}>
        <p className="flex items-baseline gap-2">
          <RollingNumber text={fmtNumFull(total)} className="text-metric font-semibold tracking-tight" />
          <span className="text-sm text-ink-muted">{unit}</span>
        </p>
        <div
          ref={plot}
          role="group"
          tabIndex={0}
          aria-label={`${title}, ${view?.label ?? ''}. Use the left and right arrow keys to read each bar.`}
          className="relative w-full cursor-crosshair touch-none rounded-row"
          style={{ height: height + 1 }}
          onPointerDown={event => {
            try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* a scripted event has no pointer to capture */ }
            pick(event);
          }}
          onPointerMove={pick}
          onPointerUp={event => {
            try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* nothing was captured */ }
            if (event.pointerType !== 'mouse') setAt(null);
          }}
          onPointerCancel={() => setAt(null)}
          onPointerLeave={() => setAt(null)}
          onKeyDown={handleKeyDown}
          onBlur={() => setAt(null)}
        >
          <span className="absolute inset-x-0 h-px bg-divider" style={{ top: height }} />
          {columns.map((item, index) => (
            <div
              key={`${view?.id}-${index}`}
              className="stb-col absolute top-0 bottom-0"
              data-on={active === index || undefined}
              style={{ left: item.left, width: item.width, '--i': index } as CSSProperties}
            >
              {item.segments.map((segment, segmentIndex) => (
                <span
                  key={segmentIndex}
                  className="stb-bar"
                  style={{
                    '--c': series[segmentIndex]?.color ?? 'var(--chart-1)',
                    bottom: 1 + (seen ? segment.bottom : 0),
                    height: seen ? segment.height : 0,
                  } as CSSProperties}
                />
              ))}
            </div>
          ))}
          {column && (
            <span
              className="stb-ring"
              aria-hidden="true"
              style={{
                transform: `translate(${column.left - 3}px, ${height - column.top - 3}px)`,
                width: column.width + 6,
                height: column.top + 6,
              }}
            />
          )}
          {current && column && (
            <div
              className="stb-tip"
              aria-hidden="true"
              style={{ transform: `translateX(${tooltipLeft(column, width, TIP_WIDTH)}px)`, width: TIP_WIDTH }}
            >
              <div className="flex justify-between gap-2 text-ink-muted">
                <span>{current.label}</span>
                <b className="font-medium text-ink tabular-nums">{fmtNumFull(column.total)}</b>
              </div>
              {series.map((item, index) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <i className="size-2 shrink-0 rounded-xs" style={{ backgroundColor: item.color }} />
                  <span className="flex-1 text-ink-muted">{item.label}</span>
                  <b className="font-normal text-ink tabular-nums">{fmtNumFull(current.values[index] ?? 0)}</b>
                </div>
              ))}
            </div>
          )}
        </div>
        {points.length > 0 && (
          <div className="flex justify-between text-caption text-ink-faint tabular-nums">
            <span>{points[0].short}</span>
            <span>{points[points.length - 1].short}</span>
          </div>
        )}
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted">
          {series.map(item => (
            <li key={item.label} className="flex items-center gap-1.5">
              <i className="size-2 rounded-xs" style={{ backgroundColor: item.color }} aria-hidden="true" />
              {item.label}
            </li>
          ))}
        </ul>
        <LiveStatus message={status} />
      </div>
    </SurfaceBox>
  );
}

