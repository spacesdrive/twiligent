// after a client-side navigation, focus moves to the new page's heading so a screen reader announces where the
// person landed; the heading may appear only once the page has loaded, so the request waits until then

let headingFocusPending = false;

export function requestHeadingFocus(): void {
  headingFocusPending = true;
}

// only the first heading to mount after a navigation takes focus, and only if the person has not moved it since
export function takeHeadingFocus(heading: HTMLElement | null): void {
  if (!headingFocusPending || !heading) return;
  headingFocusPending = false;
  const active = document.activeElement;
  const untouched = !active || active === document.body || active.id === 'main-content';
  if (untouched) heading.focus({ preventScroll: true });
}
