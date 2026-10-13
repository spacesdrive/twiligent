import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, MessageSquare, Play, PlaySquare, Plus, RefreshCw, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/PageHeader';
import MetricBox from '@/components/MetricBox';
import SurfaceBox from '@/components/SurfaceBox';
import Pager from '@/components/Pager';
import { EmptyState } from '@/components/StateViews';
import { pageSlice } from '@/lib/library';
import { cn } from '@/lib/utils';
import { fmtNum } from '../../../utils/formatters';
import { useChannelVideos } from './useChannelVideos';
import { filterAndSortVideos, nextSort, videoStatsOf, videosDescription } from './videoLibrary.js';
import VideoFilters from './VideoFilters';
import VideoListTable from './VideoListTable';
import VideoGrid from './VideoGrid';

const ITEMS_PER_PAGE = 25;

function VideoResults({ filtered, paged, viewMode, sort, onSort, showChannel, onClearFilters }) {
  if (filtered.length === 0) {
    return (
      <SurfaceBox>
        <EmptyState
          compact
          icon={<PlaySquare />}
          title="No videos match"
          description="Clear the search or choose a different view range."
          action={<Button variant="outline" size="sm" onClick={onClearFilters}>Clear filters</Button>}
        />
      </SurfaceBox>
    );
  }
  if (viewMode === 'table') return <VideoListTable paged={paged} sort={sort} onSort={onSort} showChannel={showChannel} />;
  return <VideoGrid items={paged.items} showChannel={showChannel} />;
}

export default function VideoExplorer() {
  const { videos, channels, loading, reload } = useChannelVideos();
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [tier, setTier] = useState('all');
  const [sort, setSort] = useState({ field: 'viewCount', order: 'desc' });
  const [viewMode, setViewMode] = useState('table');
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => filterAndSortVideos(videos, { channelFilter, search, tier, sort }),
    [videos, channelFilter, search, tier, sort],
  );
  const paged = pageSlice(filtered, page, ITEMS_PER_PAGE);
  const stats = useMemo(() => videoStatsOf(filtered), [filtered]);

  function resetPage(setter) {
    return value => {
      setter(value);
      setPage(1);
    };
  }
  const handleSort = field => setSort(prev => nextSort(prev, field));
  const clearFilters = () => { setSearch(''); setTier('all'); setChannelFilter('all'); setPage(1); };

  const header = (
    <PageHeader
      title="Videos"
      description={videosDescription(loading, videos.length, channels.length)}
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-card" />)}
        </div>
        <Skeleton className="h-10 rounded-pill" />
        <Skeleton className="h-96 rounded-card" />
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <SurfaceBox>
          <EmptyState
            icon={<PlaySquare />}
            title="No YouTube channels yet"
            description="Add a channel to browse and compare its videos here."
            action={<Button render={<Link to="/accounts?add=1" />}><Plus data-icon="inline-start" />Add a channel</Button>}
          />
        </SurfaceBox>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <MetricBox small icon={<Play />} label="Videos" value={fmtNum(stats.total)} />
        <MetricBox small icon={<Eye />} label="Views" value={fmtNum(stats.views)} highlight />
        <MetricBox small icon={<ThumbsUp />} label="Likes" value={fmtNum(stats.likes)} />
        <MetricBox small icon={<MessageSquare />} label="Comments" value={fmtNum(stats.comments)} />
        <MetricBox small icon={<Eye />} label="Average views" value={fmtNum(stats.avgViews)} />
      </div>

      <VideoFilters
        channels={channels}
        search={search}
        onSearchChange={resetPage(setSearch)}
        channelFilter={channelFilter}
        onChannelChange={resetPage(setChannelFilter)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        tier={tier}
        onTierChange={resetPage(setTier)}
      />

      <VideoResults
        filtered={filtered}
        paged={paged}
        viewMode={viewMode}
        sort={sort}
        onSort={handleSort}
        showChannel={channels.length > 1}
        onClearFilters={clearFilters}
      />

      <Pager page={paged.page} pageCount={paged.pageCount} onPageChange={setPage} total={filtered.length} shown={paged.items.length} noun="videos" />
    </div>
  );
}
