import React from 'react';
import { Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { DOC_TABS, firstPagePath } from './nav';
import type { DocTab } from './nav';
import DocsSidebarNav from './DocsSidebarNav';

interface DocsMobileNavProps {
  tab: DocTab;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DocsMobileNav({ tab, open, onOpenChange }: DocsMobileNavProps) {
  const close = () => onOpenChange(false);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 overflow-y-auto p-5">
        <SheetTitle className="sr-only">Documentation navigation</SheetTitle>
        <div className="mb-6 flex flex-col gap-1">
          {DOC_TABS.map(docTab => (
            <Link key={docTab.id} to={firstPagePath(docTab)} onClick={close} className={cn('rounded-row px-2 py-1.5 text-sm font-medium', docTab.id === tab.id ? 'text-ink' : 'text-ink-muted')}>
              {docTab.label}
            </Link>
          ))}
        </div>
        <DocsSidebarNav tab={tab} onNavigate={close} />
      </SheetContent>
    </Sheet>
  );
}
