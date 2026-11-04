import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PlaySquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/PageHeader';
import MetricBox from '@/components/MetricBox';
import Num from '@/components/Num';
import SurfaceBox from '@/components/SurfaceBox';
import Pager from '@/components/Pager';
import RefreshButton from '@/components/RefreshButton';
import DataFreshness from '@/components/DataFreshness';
import ActiveFilters from '@/components/ActiveFilters';
import NoResults from '@/components/NoResults';
import FailedSourcesAlert from '@/components/FailedSourcesAlert';
import StackedBars from '@/components/StackedBars';
import { EmptyState } from '@/components/StateViews';
import { VIEW_TIERS, pageSlice, resultCountLabel } from '@/lib/library';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { SERIES } from '@/lib/chart';
import { useChannelVideos } from './useChannelVideos';
import { useLibraryParams } from '../useLibraryParams';
import { VIDEO_SORT_OPTIONS, filterAndSortVideos, nextSort, sortFromKey, sortKeyOf, videoStatsOf, videosDescription } from './videoLibrary.ts';
import type { VideoSortField } from './videoLibrary.ts';
import VideoFilters from './VideoFilters';
import VideoListTable from './VideoListTable';
import VideoGrid from './VideoGrid';
import type { LayoutMode } from './LayoutToggle';
import { uploadsByPeriod } from './uploadsChart.ts';

const ITEMS_PER_PAGE = 25;
const RESULTS_ID = 'video-results';

// a year by month and a quarter by week show the publishing rhythm without crowding the bars
const UPLOAD_MONTHS = 12;
const UPLOAD_WEEKS = 13;
// both kinds are YouTube, so they share its red family and leave the other hues to the other platforms
const UPLOAD_SERIES = [{ label: 'Videos', color: SERIES.primary }, { label: 'Shorts', color: SERIES.deep }];

const DEFAULTS = { q: '', channel: 'all', views: 'all', sort: 'viewCount:desc', view: 'table' };

const { videos: Videos, views: Views, likes: Likes, comments: Comments, averageViews: AverageViews } = METRIC_ICONS;

export default function VideoExplorer() {
  const { videos, channels, channelCount, failures, fetchedAt, loading, refreshing, refresh } = useChannelVideos();
  const { values, page, update, clear, setPage } = useLibraryParams(DEFAULTS);
  const sort = sortFromKey(values.sort);
  const viewMode: LayoutMode = values.view === 'grid' ? 'grid' : 'table';

  const filtered = useMemo(
    () => filterAndSortVideos(videos, { channelFilter: values.channel, search: values.q, tier: values.views, sort: sortFromKey(values.sort) }),
    [videos, values.channel, values.q, values.views, values.sort],
  );
  const paged = pageSlice(filtered, page, ITEMS_PER_PAGE);
  const stats = useMemo(() => videoStatsOf(filtered), [filtered]);
  // the rhythm follows the channel filter only; a search or a view tier would hide uploads, not explain them
  const uploadViews = useMemo(() => {
    const channelVideos = values.channel === 'all' ? videos : videos.filter(video => video.channelId === values.channel);
    return [
      { id: 'month', label: 'Month', points: uploadsByPeriod(channelVideos, 'month', UPLOAD_MONTHS) },
      { id: 'week', label: 'Week', points: uploadsByPeriod(channelVideos, 'week', UPLOAD_WEEKS) },
    ];
  }, [videos, values.channel]);

  const handleSort = (field: VideoSortField) => update({ sort: sortKeyOf(nextSort(sort, field)) });
  const clearFilters = () => clear(['q', 'channel', 'views']);
  const channelTitle = channels.find(channel => channel.id === values.channel)?.title;
  const tierLabel = VIEW_TIERS.find(tier => tier.value === values.views)?.label;
  const activeFilters = [
    values.q && { key: 'q', label: `"${values.q}"`, onRemove: () => update({ q: '' }) },
    values.channel !== 'all' && channelTitle && { key: 'channel', label: channelTitle, onRemove: () => update({ channel: 'all' }) },
    values.views !== 'all' && tierLabel && { key: 'views', label: tierLabel, onRemove: () => update({ views: 'all' }) },
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

  const header = (
    <PageHeader
      title="Videos"
      description={
        <span className="flex flex-col gap-1">
          <span>{videosDescription(loading, videos.length, channels.length)}</span>
          {!loading && <DataFreshness fetchedAt={fetchedAt} qualifier={channels.length > 1 ? 'oldest channel' : undefined} />}
        </span>
      }
      actions={<RefreshButton refreshing={refreshing} onRefresh={refresh} disabled={loading || channelCount === 0} />}
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

  if (channelCount === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <SurfaceBox>
          <EmptyState
            icon={<PlaySquare />}
            title="No YouTube channels yet"
            description="Add a channel to browse and compare its videos here."
            action={<Button render={<Link to="/accounts?add=1" />}><Plus data-icon="inline-start" aria-hidden="true" />Add a channel</Button>}
          />
        </SurfaceBox>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      <FailedSourcesAlert failures={failures} total={channelCount} noun="channels" onRetry={refresh} retrying={refreshing} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" aria-busy={refreshing}>
        <MetricBox small icon={<Videos />}       label="Videos"        value={<Num value={stats.total} />}    period="Matching videos" />
        <MetricBox small icon={<Views />}        label="Views"         value={<Num value={stats.views} />}    period="Matching videos" highlight />
        <MetricBox small icon={<Likes />}        label="Likes"         value={<Num value={stats.likes} />}    period="Matching videos" />
        <MetricBox small icon={<Comments />}     label="Comments"      value={<Num value={stats.comments} />} period="Matching videos" />
        <MetricBox small icon={<AverageViews />} label="Average views" value={<Num value={stats.avgViews} />} period="Per matching video" />
      </div>

      <StackedBars
        title="Uploads"
        subtitle={`Videos and Shorts published${channelTitle ? ` on ${channelTitle}` : ''}, newest on the right`}
        unit="uploads"
        series={UPLOAD_SERIES}
        views={uploadViews}
      />

      <VideoFilters
        channels={channels}
        search={values.q}
        onSearchChange={value => update({ q: value }, { replace: true })}
        channelFilter={values.channel}
        onChannelChange={value => update({ channel: value })}
        sortOptions={VIDEO_SORT_OPTIONS}
        sortKey={sortKeyOf(sort)}
        onSortChange={value => update({ sort: value })}
        viewMode={viewMode}
        onViewModeChange={value => update({ view: value, page: String(page) })}
        tier={values.views}
        onTierChange={value => update({ views: value })}
      />

      <ActiveFilters countLabel={resultCountLabel(filtered.length, videos.length, 'videos')} filters={activeFilters} onClearAll={clearFilters} />

      <div id={RESULTS_ID} tabIndex={-1} className="outline-none" aria-busy={refreshing}>
        {filtered.length === 0 ? (
          <SurfaceBox><NoResults noun="videos" query={values.q} onClear={clearFilters} /></SurfaceBox>
        ) : viewMode === 'table' ? (
          <VideoListTable paged={paged} sort={sort} onSort={handleSort} showChannel={channels.length > 1} />
        ) : (
          <VideoGrid items={paged.items} showChannel={channels.length > 1} />
        )}
      </div>

      <Pager
        page={paged.page}
        pageCount={paged.pageCount}
        onPageChange={setPage}
        total={filtered.length}
        shown={paged.items.length}
        pageSize={ITEMS_PER_PAGE}
        noun="videos"
        resultsId={RESULTS_ID}
      />
    </div>
  );
}
