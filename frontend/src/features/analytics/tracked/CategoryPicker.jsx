export default function CategoryPicker({ categories, onPick }) {
  if (categories.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map(category => (
        <button
          key={category}
          type="button"
          onClick={() => onPick(category)}
          className="h-6 rounded-pill border border-line px-2.5 text-caption font-medium text-ink-muted transition-colors duration-(--duration-fast) hover:bg-surface-hover hover:text-ink"
        >
          {category}
        </button>
      ))}
    </div>
  );
}
