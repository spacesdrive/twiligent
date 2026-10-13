import React from 'react';
import { Badge } from '@/components/ui/badge';
import SectionHeader from '@/components/SectionHeader';
import { PlatformIcon } from '@/components/platform';
import AccountCard from './AccountCard';

export default function AccountSection({ section, accounts, refreshingId, onRefresh, onDelete }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            <PlatformIcon platform={section.key} className="size-4 text-ink-muted" />
            {section.title}
            <Badge variant="secondary">{accounts.length}</Badge>
          </span>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map(acct => (
          <AccountCard
            key={acct.id}
            acct={acct}
            platform={section.key}
            refreshing={refreshingId === acct.id}
            onRefresh={() => onRefresh(acct.id)}
            onDelete={() => onDelete(acct)}
          />
        ))}
      </div>
    </section>
  );
}
