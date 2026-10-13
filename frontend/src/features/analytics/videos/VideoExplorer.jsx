import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw, List, LayoutGrid, ThumbsUp, MessageSquare, Play, Eye, PlaySquare, ArrowUp, ArrowDown, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/PageHeader';
import MetricBox from '@/components/MetricBox';
import SurfaceBox from '@/components/SurfaceBox';
import SearchField from '@/components/SearchField';
import FilterChips from '@/components/FilterChips';
import Pager from '@/components/Pager';
import MediaCard, { MediaChip } from '@/components/MediaCard';
import { EmptyState } from '@/components/StateViews';
import { VIEW_TIERS, filterByTier, matchesText, pageSlice } from '@/lib/library';
import { useChannelVideos } from './useChannelVideos';
import { fmtNum, fmtDate, fmtDuration, fmtPercent, timeAgo } from '../../../utils/formatters';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 25;
const watchUrl = id => `https://www.youtube.com/watch?v=${id}`;
const LAYOUTS = [{ value: 'table', label: 'List', Icon: List }, { value: 'grid', label: 'Grid', Icon: LayoutGrid }];

function SortHeader({ field, label, sort, onSort, align = 'left' }) {
  const active = sort.field === field;
  const Arrow = sort.order === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      aria-sort={active ? (sort.order === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm transition-colors hover:text-ink',
        align === 'right' && 'flex-row-reverse',
        active ? 'text-ink' : 'text-ink-muted',
      )}
    >
      {label}
      <Arrow className={cn('size-3', !active && 'invisible')} />
    </button>
  );
}

export default function VideoExplorer() {
  const { videos, channels, loading, reload } = useChannelVideos();
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [tier, setTier] = useState('all');
  const [sort, setSort] = useState({ field: 'viewCount', order: 'desc' });
  const [viewMode, setViewMode] = useState('table');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = channelFilter === 'all' ? videos : videos.filter(v => v.channelId === channelFilter);
    result = result.filter(v => matchesText([v.title, ...(v.tags || [])], search));
    result = filterByTier(result, VIEW_TIERS, tier, 'viewCount');
    const dir = sort.order === 'asc' ? 1 : -1;
    return [...result].sort((a, b) => {
      const av = a[sort.field] ?? 0;
      const bv = b[sort.field] ?? 0;
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
      return (Number(av) - Number(bv)) * dir;
    });
  }, [videos, channelFilter, search, tier, sort]);

  const paged = pageSlice(filtered, page, ITEMS_PER_PAGE);

  const stats = useMemo(() => {
    const sum = key => filtered.reduce((s, v) => s + (v[key] || 0), 0);
    const views = sum('viewCount');
    return {
      total: filtered.length,
      views,
      likes: sum('likeCount'),
      comments: sum('commentCount'),
      avgViews: filtered.length ? Math.round(views / filtered.length) : 0,
    };
  }, [filtered]);

  const resetPage = setter => value => { setter(value); setPage(1); };
  const handleSort = field => {
    setSort(prev => prev.field === field ? { field, order: prev.order === 'asc' ? 'desc' : 'asc' } : { field, order: 'desc' });
  };

  const header = (
    <PageHeader
      title="Videos"
      description={loading ? 'Loading videos from your channels' : `${fmtNum(videos.length)} videos across ${channels.length} channel${channels.length === 1 ? '' : 's'}`}
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

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            value={search}
            onChange={resetPage(setSearch)}
            placeholder="Search titles and tags"
            className="min-w-56 flex-1"
          />
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
          <div role="radiogroup" aria-label="Layout" className="flex h-(--control-h-lg) items-center gap-0.5 rounded-field border border-line-control p-1">
            {LAYOUTS.map(layout => {
              const { value, label, Icon } = layout;
              return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={viewMode === value}
                aria-label={`${label} layout`}
                onClick={() => setViewMode(value)}
                className={cn(
                  'flex size-8 items-center justify-center rounded-[8px] transition-colors',
                  viewMode === value ? 'bg-surface-selected text-ink' : 'text-ink-muted hover:text-ink',
                )}
              >
                <Icon className="size-4 stroke-[1.75]" />
              </button>
              );
            })}
          </div>
        </div>
        <FilterChips label="Views" options={VIEW_TIERS} value={tier} onChange={resetPage(setTier)} />
      </div>

      {filtered.length === 0 ? (
        <SurfaceBox>
          <EmptyState
            compact
            icon={<PlaySquare />}
            title="No videos match"
            description="Clear the search or choose a different view range."
            action={<Button variant="outline" size="sm" onClick={() => { setSearch(''); setTier('all'); setChannelFilter('all'); setPage(1); }}>Clear filters</Button>}
          />
        </SurfaceBox>
      ) : viewMode === 'table' ? (
        <SurfaceBox content={false} className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-right">#</TableHead>
                <TableHead><SortHeader field="title" label="Video" sort={sort} onSort={handleSort} /></TableHead>
                {channels.length > 1 && <TableHead>Channel</TableHead>}
                <TableHead className="text-right"><SortHeader field="viewCount" label="Views" sort={sort} onSort={handleSort} align="right" /></TableHead>
                <TableHead className="text-right"><SortHeader field="likeCount" label="Likes" sort={sort} onSort={handleSort} align="right" /></TableHead>
                <TableHead className="text-right"><SortHeader field="commentCount" label="Comments" sort={sort} onSort={handleSort} align="right" /></TableHead>
                <TableHead className="text-right"><SortHeader field="engagementRate" label="Engagement" sort={sort} onSort={handleSort} align="right" /></TableHead>
                <TableHead className="text-right"><SortHeader field="durationSeconds" label="Length" sort={sort} onSort={handleSort} align="right" /></TableHead>
                <TableHead className="text-right"><SortHeader field="publishedAt" label="Published" sort={sort} onSort={handleSort} align="right" /></TableHead>
                <TableHead className="w-10"><span className="sr-only">Watch</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.items.map((v, i) => (
                <TableRow key={`${v.videoId}-${i}`}>
                  <TableCell className="text-right font-mono text-caption text-ink-faint">{paged.offset + i + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {v.thumbnail
                        ? <img src={v.thumbnail} alt="" loading="lazy" className="h-9 w-16 shrink-0 rounded-sm object-cover" />
                        : <span className="h-9 w-16 shrink-0 rounded-sm bg-surface-sunken" />}
                      <a href={watchUrl(v.videoId)} target="_blank" rel="noopener noreferrer" className="max-w-[18rem] truncate text-sm font-medium text-ink hover:underline">
                        {v.title}
                      </a>
                    </div>
                  </TableCell>
                  {channels.length > 1 && <TableCell className="max-w-36 truncate text-small text-ink-muted">{v.channelTitle}</TableCell>}
                  <TableCell className="text-right font-semibold text-ink">{fmtNum(v.viewCount)}</TableCell>
                  <TableCell className="text-right text-ink-muted">{fmtNum(v.likeCount)}</TableCell>
                  <TableCell className="text-right text-ink-muted">{fmtNum(v.commentCount)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={parseFloat(v.engagementRate) > 5 ? 'success' : 'secondary'}>{fmtPercent(v.engagementRate)}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-ink-muted">{fmtDuration(v.durationSeconds)}</TableCell>
                  <TableCell className="text-right text-small text-ink-faint">{fmtDate(v.publishedAt)}</TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger render={<Button variant="ghost" size="icon-xs" render={<a href={watchUrl(v.videoId)} target="_blank" rel="noopener noreferrer" aria-label={`Watch ${v.title} on YouTube`} />} />}>
                        <Play />
                      </TooltipTrigger>
                      <TooltipContent>Watch on YouTube</TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SurfaceBox>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {paged.items.map((v, i) => (
            <MediaCard
              key={`${v.videoId}-${i}`}
              href={watchUrl(v.videoId)}
              image={v.thumbnail}
              title={v.title}
              topRight={<MediaChip><Eye />{fmtNum(v.viewCount)}</MediaChip>}
              bottomRight={v.durationSeconds > 0 && <MediaChip>{fmtDuration(v.durationSeconds)}</MediaChip>}
              meta={
                <>
                  <span className="flex items-center gap-1"><ThumbsUp />{fmtNum(v.likeCount)}</span>
                  <span className="flex items-center gap-1"><MessageSquare />{fmtNum(v.commentCount)}</span>
                  <span className="ml-auto">{channels.length > 1 ? v.channelTitle : timeAgo(v.publishedAt)}</span>
                </>
              }
            />
          ))}
        </div>
      )}

      <Pager page={paged.page} pageCount={paged.pageCount} onPageChange={setPage} total={filtered.length} shown={paged.items.length} noun="videos" />
    </div>
  );
}
