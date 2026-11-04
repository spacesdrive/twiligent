// Reddit's insights page shows views as "12,500" or "12.5K"; the field accepts what people copy and keeps the number

const SUFFIX: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };

export function normalizeViewsText(raw: string): string {
  const text = raw.trim().toLowerCase().replace(/[\s,]/g, '').replace(/views?$/, '');
  const match = text.match(/^(\d+(?:\.\d+)?)([kmb])$/);
  if (match) return String(Math.round(Number(match[1]) * SUFFIX[match[2]]));
  return text;
}
