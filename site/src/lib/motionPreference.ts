// the stored value is text anyone can edit, so only the exact word pauses
export function isPausedValue(value: string | null): boolean {
  return value === 'paused';
}
