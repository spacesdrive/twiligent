import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Scissors, Plus } from 'lucide-react';
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
import { EmptyState } from '@/components/StateViews';
import { VIEW_TIERS, pageSlice, resultCountLabel } from '@/lib/library';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { useChannelVideos } from '../videos/useChannelVideos';
import { useLibraryParams } from '../useLibraryParams';
import { videoStatsOf } from '../videos/videoLibrary.ts';
import ShortsFilters from './ShortsFilters';
import ShortsGrid from './ShortsGrid';
import { SHORTS_SORT_OPTIONS, filterAndSortShorts, shortsDescription, shortsOf, shortsSortOf } from './shortsLibrary.ts';

const ITEMS_PER_PAGE = 24;
const RESULTS_ID = 'shorts-results';

const DEFAULTS = { q: '', channel: 'all', views: 'all', sort: 'viewCount' };

const { shorts: ShortsIcon, views: Views, likes: Likes, comments: Comments, averageViews: AverageViews } = METRIC_ICONS;

export default function ShortsExplorer() {
  const { videos, channels, channelCount, failures, fetchedAt, loading, refreshing, refresh } = useChannelVideos();
  const { values, page, update, clear, setPage } = useLibraryParams(DEFAULTS);

  const shorts = useMemo(() => shortsOf(videos), [videos]);
  const filtered = useMemo(
    () => filterAndSortShorts(shorts, { channelFilter: values.channel, search: values.q, tier: values.views, sortField: shortsSortOf(values.sort) }),
    [shorts, values.channel, values.q, values.views, values.sort],
  );
  const paged = pageSlice(filtered, page, ITEMS_PER_PAGE);
  const stats = useMemo(() => videoStatsOf(filtered), [filtered]);

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
      title="Shorts"
      description={
        <span className="flex flex-col gap-1">
          <span>{shortsDescription(loading, shorts.length, channels.length)}</span>
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
        <Skeleton className="h-10 rounded-field" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-[9/16] rounded-card" />)}
        </div>
      </div>
    );
  }

  if (channelCount === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <SurfaceBox>
          <EmptyState
            icon={<Scissors />}
            title="No YouTube channels yet"
            description="Add a channel and its Shorts appear here, ranked by views."
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

      {shorts.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" aria-busy={refreshing}>
          <MetricBox small icon={<ShortsIcon />}   label="Shorts"        value={<Num value={stats.total} />}    period="Matching Shorts" />
          <MetricBox small icon={<Views />}        label="Views"         value={<Num value={stats.views} />}    period="Matching Shorts" highlight />
          <MetricBox small icon={<Likes />}        label="Likes"         value={<Num value={stats.likes} />}    period="Matching Shorts" />
          <MetricBox small icon={<Comments />}     label="Comments"      value={<Num value={stats.comments} />} period="Matching Shorts" />
          <MetricBox small icon={<AverageViews />} label="Average views" value={<Num value={stats.avgViews} />} period="Per matching Short" />
        </div>
      )}

      <ShortsFilters
        channels={channels}
        sortOptions={SHORTS_SORT_OPTIONS}
        search={values.q}
        onSearchChange={value => update({ q: value }, { replace: true })}
        channelFilter={values.channel}
        onChannelChange={value => update({ channel: value })}
        sortField={shortsSortOf(values.sort)}
        onSortChange={value => update({ sort: value })}
        tier={values.views}
        onTierChange={value => update({ views: value })}
      />

      <ActiveFilters countLabel={resultCountLabel(filtered.length, shorts.length, 'Shorts')} filters={activeFilters} onClearAll={clearFilters} />

      <div id={RESULTS_ID} tabIndex={-1} className="outline-none" aria-busy={refreshing}>
        {shorts.length === 0 ? (
          <SurfaceBox>
            <EmptyState
              compact
              icon={<Scissors />}
              title="No Shorts yet"
              description="Videos of 60 seconds or less appear here once your channels publish them."
            />
          </SurfaceBox>
        ) : filtered.length === 0 ? (
          <SurfaceBox><NoResults noun="Shorts" query={values.q} onClear={clearFilters} /></SurfaceBox>
        ) : (
          <ShortsGrid shorts={paged.items} />
        )}
      </div>

      <Pager
        page={paged.page}
        pageCount={paged.pageCount}
        onPageChange={setPage}
        total={filtered.length}
        shown={paged.items.length}
        pageSize={ITEMS_PER_PAGE}
        noun="Shorts"
        resultsId={RESULTS_ID}
      />
    </div>
  );
}
