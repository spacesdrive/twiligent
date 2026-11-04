// typed work kept in the tab's session storage, so a reload or a wrong click does not lose it; storage can be
// missing or full (private windows, blocked site data), and then the draft is simply not kept

export interface DraftStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const PREFIX = 'twiligent:draft:';

function defaultStorage(): DraftStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function readDraft<T>(key: string, storage: DraftStorage | null = defaultStorage()): T | null {
  try {
    const raw = storage?.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeDraft<T>(key: string, value: T, storage: DraftStorage | null = defaultStorage()): void {
  try {
    storage?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // a full or blocked storage only means the draft is not kept
  }
}

export function clearDraft(key: string, storage: DraftStorage | null = defaultStorage()): void {
  try {
    storage?.removeItem(PREFIX + key);
  } catch {
    // nothing to clear when storage is blocked
  }
}
