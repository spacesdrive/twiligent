// view state kept in the address, so Back, refresh and a shared link show the same view

export function readParam(params: URLSearchParams, key: string, fallback: string): string {
  return params.get(key) ?? fallback;
}

// the default value is left out, so a page with nothing changed keeps a clean address
export function withParam(params: URLSearchParams, key: string, value: string, fallback: string): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value === fallback || value === '') next.delete(key);
  else next.set(key, value);
  return next;
}

export function readPositiveInt(params: URLSearchParams, key: string, fallback: number): number {
  const parsed = Number.parseInt(params.get(key) ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// an address can carry any text, so a value outside the allowed set falls back to the default
export function readChoice<T extends string>(params: URLSearchParams, key: string, choices: readonly T[], fallback: T): T {
  const value = params.get(key);
  return choices.find(choice => choice === value) ?? fallback;
}
