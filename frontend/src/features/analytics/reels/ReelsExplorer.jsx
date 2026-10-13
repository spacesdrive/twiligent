import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/PageHeader';
import SurfaceBox from '@/components/SurfaceBox';
import Pager from '@/components/Pager';
import { EmptyState } from '@/components/StateViews';
import { InstagramIcon } from '@/components/brand/platform-icons';
import { pageSlice } from '@/lib/library';
import { cn } from '@/lib/utils';
import { useInstagramMedia } from './useInstagramMedia';
import { filterAndSortMedia, reelsDescription, typeTotalsOf } from './reelsLibrary.js';
import ReelsMetrics from './ReelsMetrics';
import ReelsFilters from './ReelsFilters';
import ReelsGrid from './ReelsGrid';

const ITEMS_PER_PAGE = 24;

export default function ReelsExplorer() {
  const { igAccounts, media, loading, loadAllMedia } = useInstagramMedia();
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [tier, setTier] = useState('all');
  const [sortField, setSortField] = useState('viewCount');
  const [page, setPage] = useState(1);

  const accountMedia = useMemo(
    () => accountFilter === 'all' ? media : media.filter(item => item.accountId === accountFilter),
    [media, accountFilter],
  );
  const typeTotals = useMemo(() => typeTotalsOf(accountMedia), [accountMedia]);
  const filtered = useMemo(
    () => filterAndSortMedia(accountMedia, { typeFilter, search, tier, sortField }),
    [accountMedia, typeFilter, search, tier, sortField],
  );
  const paged = pageSlice(filtered, page, ITEMS_PER_PAGE);

  function resetPage(setter) {
    return value => {
      setter(value);
      setPage(1);
    };
  }
  const filters = { search, accountFilter, typeFilter, tier, sortField };
  const handlers = {
    onSearchChange: resetPage(setSearch),
    onAccountChange: resetPage(setAccountFilter),
    onTierChange: resetPage(setTier),
    onSortChange: setSortField,
    onTypeChange: resetPage(setTypeFilter),
  };

  const header = (
    <PageHeader
      title="Instagram content"
      description={reelsDescription(loading, media.length, igAccounts.length)}
      actions={
        <Button variant="outline" size="sm" onClick={loadAllMedia} disabled={loading}>
          <RefreshCw data-icon="inline-start" className={cn(loading && 'animate-spin')} />
          Refresh
        </Button>
      }
    />
  );

  if (igAccounts.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <SurfaceBox>
          <EmptyState
            icon={<InstagramIcon />}
            title="No Instagram accounts yet"
            description="Connect a Business or Creator account to browse its reels, posts and videos."
            action={<Button render={<Link to="/accounts?add=1" />}><Plus data-icon="inline-start" />Add an account</Button>}
          />
        </SurfaceBox>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-card" />)}
        </div>
        <Skeleton className="h-10 rounded-field" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-card" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      <ReelsMetrics typeTotals={typeTotals} itemCount={accountMedia.length} />

      <ReelsFilters igAccounts={igAccounts} itemCount={accountMedia.length} typeTotals={typeTotals} filters={filters} handlers={handlers} />

      {filtered.length === 0 ? (
        <SurfaceBox>
          <EmptyState compact icon={<InstagramIcon />} title="No content matches" description="Clear the search or choose a different type or like range." />
        </SurfaceBox>
      ) : (
        <ReelsGrid items={paged.items} />
      )}

      <Pager page={paged.page} pageCount={paged.pageCount} onPageChange={setPage} total={filtered.length} shown={paged.items.length} noun="items" />
    </div>
  );
}
