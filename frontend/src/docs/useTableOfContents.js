import { useEffect, useState } from 'react';

export function useTableOfContents(articleRef, pathname) {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return undefined;
    const collect = () => {
      const headings = [...article.querySelectorAll('[data-toc]')];
      setItems(headings.map(heading => ({ id: heading.id, text: heading.textContent, level: Number(heading.dataset.toc) })));
      return headings;
    };
    let headings = collect();
    // pages are lazy-loaded, so headings can appear after the first render
    const mutations = new MutationObserver(() => { headings = collect(); observeAll(); });
    const spy = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-120px 0px -65% 0px' });
    function observeAll() { spy.disconnect(); headings.forEach(heading => spy.observe(heading)); }
    observeAll();
    mutations.observe(article, { childList: true, subtree: true });
    return () => { mutations.disconnect(); spy.disconnect(); };
  }, [articleRef, pathname]);

  return { items, active };
}
