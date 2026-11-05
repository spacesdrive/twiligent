import React from 'react';
import { Badge } from '@/components/ui/badge';
import SectionHeader from '@/components/SectionHeader';
import { PlatformIcon } from '@/components/platform';
import AccountCard from './AccountCard';
import type { AccountSectionInfo } from './accountManagerData';
import type { AppAccount } from '../../utils/formatters';

export interface AccountSectionProps {
  section: AccountSectionInfo;
  accounts: AppAccount[];
  refreshingId: string | null;
  onRefresh: (acct: AppAccount) => void;
  onDelete: (acct: AppAccount) => void;
  // one message for the whole section, so it is not repeated on every card
  notice?: React.ReactNode;
  extraFor?: (acct: AppAccount) => React.ReactNode;
}

export default function AccountSection({ section, accounts, refreshingId, onRefresh, onDelete, notice, extraFor }: AccountSectionProps) {
  return (
    <section id={section.key} aria-labelledby={`${section.key}-accounts-title`} className="flex scroll-mt-20 flex-col gap-3">
      <SectionHeader
        title={
          <span id={`${section.key}-accounts-title`} className="flex items-center gap-2">
            <PlatformIcon platform={section.key} className="size-4 text-ink-muted" />
            {section.title}
            <Badge variant="secondary">{accounts.length}</Badge>
          </span>
        }
      />
      {notice}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map(acct => (
          <AccountCard
            key={acct.id}
            acct={acct}
            platform={section.key}
            refreshing={refreshingId === acct.id}
            onRefresh={() => onRefresh(acct)}
            onDelete={() => onDelete(acct)}
            extra={extraFor?.(acct)}
          />
        ))}
      </div>
    </section>
  );
}
