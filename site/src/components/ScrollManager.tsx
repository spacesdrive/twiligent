import { useEffect } from 'react';
import { useLocation } from 'react-router';

// a new page starts at the top; a link with #section lands on that section once it has rendered
export function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0 });
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
