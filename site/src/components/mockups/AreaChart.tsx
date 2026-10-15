import { useId, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useElementSize } from '@/hooks/useElementSize';
import { areaPath, chartPoints, seriesRange, smoothPath } from '@/lib/chart';

export type ChartTone = 'accent' | 'afterglow';

export interface ChartSeries {
  values: number[];
  tone: ChartTone;
}

export interface AreaChartProps {
  series: ChartSeries[];
  // starts the drawing; pictures that loop remount the chart with a new key to draw it again
  play: boolean;
  labels?: string[];
  gridLines?: number;
  // the point a reader is looking at: a guide line, a dot on each series, and the tooltip above the first
  focus?: number | null;
  tooltip?: ReactNode;
  // a dot on each line's latest point; small sparklines leave it out
  dots?: boolean;
  // marks each point of the first line with data-cursor="point-<n>" for a picture's cursor to move to
  anchors?: boolean;
  delay?: number;
  className?: string;
}

const TONES: Record<ChartTone, { stroke: string; fill: string; color: string }> = {
  accent: { stroke: 'stroke-accent', fill: 'fill-accent', color: 'var(--accent)' },
  afterglow: { stroke: 'stroke-afterglow', fill: 'fill-afterglow', color: 'var(--color-afterglow)' },
};

const GLIDE = 'transition-transform duration-500 ease-[var(--ease-panel)]';

// a smooth area chart drawn at the size it is given, in CSS only so the hero can use it without the animation library
export function AreaChart({
  series,
  play,
  labels,
  gridLines = 3,
  focus = null,
  tooltip,
  dots = true,
  anchors = false,
  delay = 0,
  className,
}: AreaChartProps) {
  const id = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(plotRef);
  const range = seriesRange(series.map(s => s.values));
  // room above the highest point for its dot and below the lowest for the line's width, smaller on small charts
  const margin = { top: Math.min(16, height * 0.14), bottom: Math.min(4, height * 0.06) };
  const box = { width, height, ...margin };
  const plotted = series.map(s => chartPoints(s.values, box, range));
  const usable = height - margin.top - margin.bottom;
  const focusPoint = focus === null ? null : plotted[0]?.[focus];

  return (
    <div className={cn('flex flex-col', className)}>
      <div
        ref={plotRef}
        className={cn('relative min-h-0 flex-1', play && 'chart-play')}
        style={{ '--delay': `${delay}ms` } as CSSProperties}
      >
        {width > 0 && (
          <svg width={width} height={height} className="absolute inset-0 overflow-visible" aria-hidden="true">
            <defs>
              {series.map((s, i) => (
                <linearGradient key={i} id={`${id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: TONES[s.tone].color, stopOpacity: i === 0 ? 0.32 : 0.22 }} />
                  <stop offset="100%" style={{ stopColor: TONES[s.tone].color, stopOpacity: 0 }} />
                </linearGradient>
              ))}
            </defs>
            {Array.from({ length: gridLines }, (_, i) => {
              const y = margin.top + (usable * (i + 1)) / (gridLines + 1);
              return <line key={i} x1="0" x2={width} y1={y} y2={y} className="stroke-line" strokeDasharray="2 6" />;
            })}
            {plotted.map((points, i) => (
              <path key={`fill-${i}`} className="chart-fill" d={areaPath(points, height)} fill={`url(#${id}-${i})`} />
            ))}
            {plotted.map((points, i) => (
              <path
                key={`line-${i}`}
                className={cn('chart-line', TONES[series[i].tone].stroke)}
                d={smoothPath(points)}
                pathLength={1}
                fill="none"
                strokeWidth={i === 0 ? 2.5 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {focus === null &&
              dots &&
              plotted.map((points, i) => {
                const [x, y] = points[points.length - 1];
                const tone = TONES[series[i].tone];
                return (
                  <g key={`dot-${i}`} className="chart-dot">
                    {i === 0 && play && <circle cx={x} cy={y} r="4" className={cn('ping-soft', tone.fill)} />}
                    <circle
                      cx={x}
                      cy={y}
                      r="4.5"
                      className={cn(tone.fill, 'stroke-surface-raised')}
                      strokeWidth="2.5"
                    />
                  </g>
                );
              })}
            {focusPoint && (
              <g>
                <line
                  x1="0"
                  x2="0"
                  y1={margin.top - 6}
                  y2={height}
                  className={cn('stroke-line-strong', GLIDE)}
                  strokeDasharray="3 4"
                  style={{ transform: `translateX(${focusPoint[0]}px)` }}
                />
                {plotted.map((points, i) => {
                  const [x, y] = points[focus ?? 0];
                  return (
                    <circle
                      key={`focus-${i}`}
                      r="4.5"
                      className={cn(TONES[series[i].tone].fill, 'stroke-surface-raised', GLIDE)}
                      strokeWidth="2.5"
                      style={{ transform: `translate(${x}px, ${y}px)` }}
                    />
                  );
                })}
              </g>
            )}
          </svg>
        )}
        {anchors &&
          plotted[0]?.map(([x, y], i) => (
            <span key={i} data-cursor={`point-${i}`} className="absolute size-0" style={{ left: x, top: y }} />
          ))}
        {focusPoint && tooltip && (
          <div
            className={cn('pointer-events-none absolute top-0 left-0 z-10', GLIDE)}
            style={{ transform: `translate(${focusPoint[0]}px, ${focusPoint[1]}px)` }}
          >
            <div
              className={cn(
                'rounded-md border border-line bg-surface-raised px-2.5 py-1.5 whitespace-nowrap shadow-md',
                GLIDE,
                // near either edge the tooltip opens toward the middle so the card never cuts it off
                focusPoint[0] > width * 0.7
                  ? '-translate-x-[calc(100%-10px)]'
                  : focusPoint[0] < width * 0.3
                    ? '-translate-x-[10px]'
                    : '-translate-x-1/2',
                '-translate-y-[calc(100%+14px)]',
              )}
            >
              {tooltip}
            </div>
          </div>
        )}
      </div>
      {labels && (
        <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-muted">
          {labels.map(label => (
            <span key={label}>{label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
