import React from 'react';

export default function SettingsSection({ id, title, description, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid scroll-mt-20 grid-cols-1 gap-4 border-t border-line pt-8 first:border-t-0 first:pt-0 lg:grid-cols-[16rem_1fr] lg:gap-10">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="font-heading text-section font-semibold text-ink">{title}</h2>
        {description && <p className="text-small text-ink-muted">{description}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}
