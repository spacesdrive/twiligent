import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Eye, ThumbsUp, MessageSquare, Scissors, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/PageHeader';
import SurfaceBox from '@/components/SurfaceBox';
import SearchField from '@/components/SearchField';
import FilterChips from '@/components/FilterChips';
import Pager from '@/components/Pager';
import MediaCard, { MediaChip } from '@/components/MediaCard';
import { EmptyState } from '@/components/StateViews';
import { VIEW_TIERS, filterByTier, matchesText, pageSlice } from '@/lib/library';
import { useChannelVideos } from '../videos/useChannelVideos';
import { fmtNum, fmtDuration } from '../../../utils/formatters';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 24;
const SHORT_MAX_SECONDS = 60;

const SORT_OPTIONS = [
  { value: 'viewCount',      label: 'Most viewed' },
  { value: 'likeCount',      label: 'Most liked' },
  { value: 'commentCount',   label: 'Most comments' },
  { value: 'engagementRate', label: 'Best engagement' },
  { value: 'publishedAt',    label: 'Newest first' },
];

function sortValue(item, field) {
  if (field === 'publishedAt') return new Date(item.publishedAt).getTime() || 0;
  return Number(item[field] ?? 0);
}

export default function ShortsExplorer() {
  const { videos, channels, loading, reload } = useChannelVideos();
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [tier, setTier] = useState('all');
  const [sortField, setSortField] = useState('viewCount');
  const [page, setPage] = useState(1);

  const shorts = useMemo(
    () => videos.filter(v => v.durationSeconds > 0 && v.durationSeconds <= SHORT_MAX_SECONDS),
    [videos],
  );

  const filtered = useMemo(() => {
    let result = channelFilter === 'all' ? shorts : shorts.filter(v => v.channelId === channelFilter);
    result = result.filter(v => matchesText([v.title], search));
    result = filterByTier(result, VIEW_TIERS, tier, 'viewCount');
    return [...result].sort((a, b) => sortValue(b, sortField) - sortValue(a, sortField));
  }, [shorts, channelFilter, search, tier, sortField]);

  const paged = pageSlice(filtered, page, ITEMS_PER_PAGE);
  const resetPage = setter => value => { setter(value); setPage(1); };

  const header = (
    <PageHeader
      title="Shorts"
      description={loading ? 'Loading Shorts from your channels' : `${fmtNum(shorts.length)} Shorts across ${channels.length} channel${channels.length === 1 ? '' : 's'}`}
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

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={search} onChange={resetPage(setSearch)} placeholder="Search Shorts" className="min-w-56 flex-1" />
          {channels.length > 1 && (
            <Select
              value={channelFilter}
              onValueChange={resetPage(setChannelFilter)}
              items={[{ value: 'all', label: 'All channels' }, ...channels.map(c => ({ value: c.id, label: c.title }))]}
            >
              <SelectTrigger className="w-48" aria-label="Channel"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All channels</SelectItem>
                  {channels.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
          <Select value={sortField} onValueChange={setSortField} items={SORT_OPTIONS}>
            <SelectTrigger className="w-44" aria-label="Sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <FilterChips label="Views" options={VIEW_TIERS} value={tier} onChange={resetPage(setTier)} />
      </div>

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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {paged.items.map((v, i) => (
            <MediaCard
              key={`${v.videoId}-${i}`}
              aspect="vertical"
              href={`https://www.youtube.com/shorts/${v.videoId}`}
              image={v.thumbnail}
              title={v.title}
              topRight={<MediaChip><Eye />{fmtNum(v.viewCount)}</MediaChip>}
              bottomRight={<MediaChip>{fmtDuration(v.durationSeconds)}</MediaChip>}
              meta={
                <>
                  <span className="flex items-center gap-1"><ThumbsUp />{fmtNum(v.likeCount)}</span>
                  <span className="flex items-center gap-1"><MessageSquare />{fmtNum(v.commentCount)}</span>
                </>
              }
            />
          ))}
        </div>
      )}

      <Pager page={paged.page} pageCount={paged.pageCount} onPageChange={setPage} total={filtered.length} shown={paged.items.length} noun="Shorts" />
    </div>
  );
}
