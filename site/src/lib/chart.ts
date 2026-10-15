export type Point = [number, number];

export interface ChartBox {
  width: number;
  height: number;
  // room kept above the highest point and below the lowest, in pixels
  top: number;
  bottom: number;
}

// the lowest and highest value across every series, widened by a share of the span so lines never touch the edges
export function seriesRange(series: number[][], pad = 0.08): [number, number] {
  const values = series.flat();
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return [min - span * pad, max + span * pad];
}

export function chartPoints(values: number[], box: ChartBox, [min, max]: [number, number]): Point[] {
  const step = values.length > 1 ? box.width / (values.length - 1) : 0;
  const usable = box.height - box.top - box.bottom;
  return values.map((value, i) => [i * step, box.top + usable - ((value - min) / (max - min)) * usable]);
}

// tangents for a monotone cubic (Fritsch and Carlson), so the curve is smooth but never swings past a data point
function tangents(points: Point[]): number[] {
  const n = points.length;
  const slopes = points.slice(1).map(([x, y], i) => (y - points[i][1]) / (x - points[i][0]));
  const result = points.map((_, i) => {
    if (i === 0) return slopes[0];
    if (i === n - 1) return slopes[n - 2];
    return slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
  });
  slopes.forEach((slope, i) => {
    if (slope === 0) {
      result[i] = 0;
      result[i + 1] = 0;
      return;
    }
    const a = result[i] / slope;
    const b = result[i + 1] / slope;
    const length = a * a + b * b;
    if (length > 9) {
      const scale = 3 / Math.sqrt(length);
      result[i] = scale * a * slope;
      result[i + 1] = scale * b * slope;
    }
  });
  return result;
}

const round = (value: number): number => Math.round(value * 100) / 100;

export function smoothPath(points: Point[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  if (rest.length === 0) return `M ${round(first[0])} ${round(first[1])}`;
  const t = tangents(points);
  const segments = rest.map(([x, y], i) => {
    const [px, py] = points[i];
    const third = (x - px) / 3;
    return `C ${round(px + third)} ${round(py + t[i] * third)} ${round(x - third)} ${round(y - t[i + 1] * third)} ${round(x)} ${round(y)}`;
  });
  return `M ${round(first[0])} ${round(first[1])} ${segments.join(' ')}`;
}

// the same curve closed down to the baseline, for the soft fill under a line
export function areaPath(points: Point[], baseline: number): string {
  if (points.length < 2) return '';
  const last = points[points.length - 1];
  return `${smoothPath(points)} L ${round(last[0])} ${round(baseline)} L ${round(points[0][0])} ${round(baseline)} Z`;
}
