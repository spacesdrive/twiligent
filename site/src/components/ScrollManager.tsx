import { useEffect } from 'react';
import { useLocation } from 'react-router';

// the address the page was last on; module state survives the switch between the site and docs layouts
let lastPath: string | null = null;

// after moving to another page, focus its heading so a screen reader announces where the reader landed
function focusPageHeading() {
  let tries = 0;
  const find = () => {
    const heading = document.querySelector<HTMLElement>('main h1, #doc-content h1');
    if (!heading) {
      if (tries++ < 20) window.setTimeout(find, 50);
      return;
    }
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  };
  find();
}

// a new page starts at the top; a link with #section lands on that section once it has rendered
export function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const moved = lastPath !== null && lastPath !== pathname;
    lastPath = pathname;
    if (!hash) {
      window.scrollTo({ top: 0 });
      if (moved) focusPageHeading();
      return;
    }
    const id = decodeURIComponent(hash.slice(1));
    let tries = 0;
    const find = () => {
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ block: 'start' });
      else if (tries++ < 20) window.setTimeout(find, 50);
    };
    find();
  }, [pathname, hash]);
  return null;
}
