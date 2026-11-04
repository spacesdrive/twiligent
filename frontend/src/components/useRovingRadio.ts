import { useCallback } from 'react';
import type { KeyboardEvent } from 'react';

const NEXT_KEYS = ['ArrowRight', 'ArrowDown'];
const PREVIOUS_KEYS = ['ArrowLeft', 'ArrowUp'];

// a radio group is one tab stop: arrows move and select, as the WAI-ARIA radio group pattern expects
export function useRovingRadio<V extends string>(values: readonly V[], value: V, onChange: (value: V) => void) {
  const onKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    const index = values.indexOf(value);
    let next = -1;
    if (NEXT_KEYS.includes(event.key)) next = (index + 1) % values.length;
    else if (PREVIOUS_KEYS.includes(event.key)) next = (index - 1 + values.length) % values.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = values.length - 1;
    if (next < 0) return;
    event.preventDefault();
    onChange(values[next]);
    const group = event.currentTarget.closest('[role="radiogroup"]');
    const target = group?.querySelectorAll<HTMLElement>('[role="radio"]')[next];
    target?.focus();
  }, [values, value, onChange]);

  const tabIndexOf = useCallback((option: V) => {
    const selectedExists = values.includes(value);
    if (selectedExists) return option === value ? 0 : -1;
    return option === values[0] ? 0 : -1;
  }, [values, value]);

  return { onKeyDown, tabIndexOf };
}
