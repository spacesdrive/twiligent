import { TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function MetricTabsList({ tabs }) {
  return (
    <TabsList
      variant="none"
      aria-label="Overview metrics"
      className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
    >
      {tabs.map(tab => (
        <TabsTrigger
          key={tab.value}
          value={tab.value}
          className="h-auto min-w-0 flex-col items-start justify-start gap-1 rounded-card border border-line bg-surface-raised p-4 text-left after:hidden hover:border-line-strong/40 data-active:border-brand data-active:bg-brand-soft/40"
        >
          <span className="text-small font-medium text-ink-muted">{tab.label}</span>
          <span className="font-heading text-2xl font-semibold tracking-[-0.02em] text-ink tabular-nums">{tab.figure}</span>
          <span className="w-full truncate text-caption font-normal text-ink-faint">{tab.detail}</span>
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
