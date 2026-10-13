import { useState } from 'react';

function toggled(set, id) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

// selection is kept by id, so rows hidden by a filter stay selected
export function useTrackedSelection(filtered) {
  const [selected, setSelected] = useState(() => new Set());
  const allSelected = filtered.length > 0 && filtered.every(item => selected.has(item.id));

  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      filtered.forEach(item => (allSelected ? next.delete(item.id) : next.add(item.id)));
      return next;
    });
  };

  const toggleOne = id => setSelected(prev => toggled(prev, id));

  const drop = id => {
    setSelected(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const clear = () => setSelected(new Set());

  return { selected, allSelected, someSelected: selected.size > 0, toggleAll, toggleOne, drop, clear };
}
