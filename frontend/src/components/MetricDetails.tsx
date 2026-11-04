import React from 'react';
import SurfaceBox from './SurfaceBox';

export interface MetricDetail {
  label: string;
  value: React.ReactNode;
  // what the number means, for derived scores a reader cannot guess
  hint?: string;
}

export interface MetricDetailGroup {
  title: string;
  items: MetricDetail[];
}

export interface MetricDetailsProps {
  title?: string;
  subheader?: React.ReactNode;
  groups: MetricDetailGroup[];
}

// the supporting numbers as a quiet list, so the headline tiles above stay few and the page has one entry point
export default function MetricDetails({ title = 'Details', subheader, groups }: MetricDetailsProps) {
  return (
    <SurfaceBox title={title} subheader={subheader}>
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
        {groups.map(group => (
          <section key={group.title} aria-label={group.title} className="flex flex-col gap-2">
            <h3 className="text-small font-semibold text-ink-muted">{group.title}</h3>
            <dl className="flex flex-col divide-y divide-divider">
              {group.items.map(item => (
                <div key={item.label} className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="min-w-0 text-sm text-ink">
                    {item.label}
                    {item.hint && <span className="block text-caption text-ink-faint">{item.hint}</span>}
                  </dt>
                  <dd className="shrink-0 text-sm font-semibold text-ink tabular-nums">{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </SurfaceBox>
  );
}
