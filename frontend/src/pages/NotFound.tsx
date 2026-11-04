import React from 'react';
import { Link, useLocation, useOutletContext } from 'react-router-dom';
import { LayoutDashboard, Search } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { shortcutLabel } from '@/layout/shortcuts';
import type { ShellOutletContext } from '@/layout/shellContext';

// a mistyped or outdated link says what happened instead of silently landing on the overview
export default function NotFound() {
  const { pathname } = useLocation();
  const shell = useOutletContext<ShellOutletContext | undefined>();
  const onOpenSearch = shell?.openPalette;
  useDocumentTitle('Page not found');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Page not found"
        description={
          <>
            There is no page at <code className="rounded-row bg-surface-sunken px-1.5 py-0.5 font-mono text-small break-all">{pathname}</code>.
            The link may be mistyped, or the page may have moved.
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        <Button render={<Link to="/" />}>
          <LayoutDashboard data-icon="inline-start" />Go to the overview
        </Button>
        {onOpenSearch && (
          <Button variant="outline" onClick={onOpenSearch}>
            <Search data-icon="inline-start" />Search pages and accounts ({shortcutLabel('K')})
          </Button>
        )}
      </div>
    </div>
  );
}
