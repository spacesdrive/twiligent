// brand chart order; css variable values let charts follow the theme

export const SERIES = {
  primary: 'var(--chart-1)',
  neutral: 'var(--chart-2)',
  warm: 'var(--chart-3)',
  cool: 'var(--chart-4)',
  deep: 'var(--chart-5)',
};

// a figure is a category name and its value; the summary is what a sighted reader takes from the plot at a glance
export interface ChartPoint {
  name: string;
  value: number;
}

// the rows a chart draws as name and value pairs, for the description read in place of the plot
export function pointsOf<T extends object>(rows: readonly T[], nameKey: keyof T, valueKey: keyof T): ChartPoint[] {
  return rows.map(row => ({ name: String(row[nameKey] ?? ''), value: Number(row[valueKey]) || 0 }));
}

export function rankingSummary(points: readonly ChartPoint[], formatValue: (value: number) => string, unit: string): string {
  if (points.length === 0) return 'No data yet.';
  const sorted = [...points].sort((a, b) => b.value - a.value);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  if (sorted.length === 1) return `${top.name}: ${formatValue(top.value)} ${unit}.`;
  return `Highest: ${top.name}, ${formatValue(top.value)} ${unit}. Lowest: ${bottom.name}, ${formatValue(bottom.value)} ${unit}.`;
}

export function trendSummary(points: readonly ChartPoint[], formatValue: (value: number) => string, unit: string): string {
  if (points.length === 0) return 'No data yet.';
  const first = points[0];
  const last = points[points.length - 1];
  const peak = points.reduce((best, point) => (point.value > best.value ? point : best), first);
  if (points.length === 1) return `${first.name}: ${formatValue(first.value)} ${unit}.`;
  return `From ${first.name} to ${last.name}: ${formatValue(first.value)} to ${formatValue(last.value)} ${unit}. Peak ${formatValue(peak.value)} in ${peak.name}.`;
}
