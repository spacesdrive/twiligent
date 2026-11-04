// keyboard shortcuts are shown the way the person's own keyboard labels them

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function shortcutLabel(key: string): string {
  return `${isMac ? 'Cmd' : 'Ctrl'} ${key}`;
}

export const APP_SHORTCUTS: ReadonlyArray<{ keys: string; action: string }> = [
  { keys: shortcutLabel('K'), action: 'Search' },
  { keys: shortcutLabel('B'), action: 'Show or hide the sidebar' },
];
