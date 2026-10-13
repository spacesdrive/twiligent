import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Scissors, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/PageHeader';
import SurfaceBox from '@/components/SurfaceBox';
import Pager from '@/components/Pager';
import { EmptyState } from '@/components/StateViews';
import { pageSlice } from '@/lib/library';
import { useChannelVideos } from '../videos/useChannelVideos';
import { cn } from '@/lib/utils';
import ShortsFilters from './ShortsFilters';
import ShortsGrid from './ShortsGrid';
import { shortsOf, filterAndSortShorts, shortsDescription } from './shortsLibrary.ts';

const ITEMS_PER_PAGE = 24;

const SORT_OPTIONS = [
  { value: 'viewCount',      label: 'Most viewed' },
  { value: 'likeCount',      label: 'Most liked' },
  { value: 'commentCount',   label: 'Most comments' },
  { value: 'engagementRate', label: 'Best engagement' },
  { value: 'publishedAt',    label: 'Newest first' },
];

export default function ShortsExplorer() {
  const { videos, channels, loading, reload } = useChannelVideos();
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [tier, setTier] = useState('all');
  const [sortField, setSortField] = useState('viewCount');
  const [page, setPage] = useState(1);

  const shorts = useMemo(() => shortsOf(videos), [videos]);

  const filtered = useMemo(
    () => filterAndSortShorts(shorts, { channelFilter, search, tier, sortField }),
    [shorts, channelFilter, search, tier, sortField],
  );

  const paged = pageSlice(filtered, page, ITEMS_PER_PAGE);

  function resetPage(setter) {
    return value => {
      setter(value);
      setPage(1);
    };
  }

  const header = (
    <PageHeader
      title="Shorts"
      description={shortsDescription(loading, shorts.length, channels.length)}
      actions={
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          <RefreshCw data-icon="inline-start" className={cn(loading && 'animate-spin')} />
          Refresh
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Skeleton className="h-10 rounded-field" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-[9/16] rounded-card" />)}
        </div>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <SurfaceBox>
          <EmptyState
            icon={<Scissors />}
            title="No YouTube channels yet"
            description="Add a channel and its Shorts appear here, ranked by views."
            action={<Button render={<Link to="/accounts?add=1" />}><Plus data-icon="inline-start" />Add a channel</Button>}
          />
        </SurfaceBox>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      <ShortsFilters
        channels={channels}
        sortOptions={SORT_OPTIONS}
        search={search}
        onSearchChange={resetPage(setSearch)}
        channelFilter={channelFilter}
        onChannelChange={resetPage(setChannelFilter)}
        sortField={sortField}
        onSortChange={setSortField}
        tier={tier}
        onTierChange={resetPage(setTier)}
      />

      {filtered.length === 0 ? (
        <SurfaceBox>
          <EmptyState
            compact
            icon={<Scissors />}
            title={shorts.length === 0 ? 'No Shorts yet' : 'No Shorts match'}
            description={shorts.length === 0 ? 'Videos of 60 seconds or less appear here once your channels publish them.' : 'Clear the search or choose a different view range.'}
          />
        </SurfaceBox>
      ) : (
        <ShortsGrid shorts={paged.items} />
      )}

      <Pager page={paged.page} pageCount={paged.pageCount} onPageChange={setPage} total={filtered.length} shown={paged.items.length} noun="Shorts" />
    </div>
  );
}
