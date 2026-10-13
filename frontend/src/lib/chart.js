// Shared Recharts styling. Series follow the brand data-visualisation order; values are CSS variables
// so charts switch with the theme.

export const SERIES = {
  primary: 'var(--chart-1)',
  neutral: 'var(--chart-2)',
  warm: 'var(--chart-3)',
  cool: 'var(--chart-4)',
  deep: 'var(--chart-5)',
};

export const SERIES_ORDER = [SERIES.primary, SERIES.neutral, SERIES.warm, SERIES.cool, SERIES.deep];

export const seriesAt = index => SERIES_ORDER[index % SERIES_ORDER.length];

export const axisTick = { fill: 'var(--ink-faint)', fontSize: 11, fontFamily: 'var(--font-sans)' };

export const axisProps = { tick: axisTick, axisLine: false, tickLine: false };

export const gridProps = { strokeDasharray: '3 3', stroke: 'var(--divider)' };

export const tooltipStyle = {
  background: 'var(--surface-overlay)',
  border: '1px solid var(--line)',
  borderRadius: 10,
  boxShadow: 'var(--shadow-md)',
  color: 'var(--ink)',
  fontSize: 12,
  padding: '8px 10px',
};

export const tooltipCursor = { fill: 'var(--surface-hover)' };

export const legendStyle = { fontSize: 12, color: 'var(--ink-muted)' };
