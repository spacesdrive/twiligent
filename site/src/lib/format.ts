export type NumberStyle = 'number' | 'compact' | 'percent';

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

// numbers as the app shows them: 84,213 in full, 84.2K or 1.9M when short, 5.2% for a rate
export function formatNumber(value: number, style: NumberStyle = 'number'): string {
  if (style === 'percent') return `${value.toFixed(1)}%`;
  if (style === 'number') return whole.format(value);
  const abs = Math.abs(value);
  // one decimal, dropped when it is zero: 18.4K but 182K
  const short = (n: number) => n.toFixed(1).replace(/\.0$/, '');
  if (abs >= 1_000_000) return `${short(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${short(value / 1_000)}K`;
  return whole.format(value);
}
