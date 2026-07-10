import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search, RefreshCw, List, LayoutGrid, ExternalLink, ThumbsUp, MessageSquare,
  Play, Eye, Tv,
} from 'lucide-react';
import { Empty, EmptyMedia, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import StatCard from '../../../components/ui/StatCard';
import MainCard from '../../../components/MainCard';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, fmtDate, fmtDuration, fmtPercent, timeAgo } from '../../../utils/formatters';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 25;

function parseDurationToSeconds(iso) {
  if (!iso || iso === 'P0D') return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

const PERFORMANCE_TIERS = [
  { label: 'All',                value: 'all' },
  { label: 'Viral (>1M)',        value: 'viral',  min: 1000000 },
  { label: 'High (100K-1M)',     value: 'high',   min: 100000, max: 1000000 },
  { label: 'Medium (10K-100K)', value: 'medium', min: 10000,  max: 100000 },
  { label: 'Low (<10K)',         value: 'low',    max: 10000 },
];

function SortButton({ field, label, sortField, sortOrder, onSort }) {
  const active = sortField === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={cn('flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors', active ? 'text-foreground' : 'text-muted-foreground')}
    >
      {label}
      <span className="text-[10px]">{active ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</span>
    </button>
  );
}

export default function VideoExplorer() {
  const { accounts, showToast } = useAppContext();
  const [videos,          setVideos]          = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [search,          setSearch]          = useState('');
  const [channelFilter,   setChannelFilter]   = useState('all');
  const [performanceTier, setPerformanceTier] = useState('all');
  const [sortField,       setSortField]       = useState('viewCount');
  const [sortOrder,       setSortOrder]       = useState('desc');
  const [viewMode,        setViewMode]        = useState('table');
  const [page,            setPage]            = useState(1);
  const [channels,        setChannels]        = useState([]);

  useEffect(() => { loadAllVideos(); }, [accounts]);

  const loadAllVideos = async () => {
    setLoading(true);
    try {
      const allVids = [];
      const channelList = [];
      for (const acct of (accounts || [])) {
        if (acct.platform === 'instagram') continue;
        try {
          const res = await api.getVideos(acct.id);
          const vids = res.videos || res.data?.videos || [];
          const channelTitle = acct.title || acct.channelTitle || 'Unknown';
          channelList.push({ id: acct.id, title: channelTitle, thumbnail: acct.thumbnails?.default || acct.thumbnailUrl || '' });
          allVids.push(...vids.map(v => ({
            ...v,
            thumbnail: v.thumbnail || v.thumbnails?.medium || v.thumbnails?.high || v.thumbnails?.default || '',
            channelTitle,
            channelId: acct.id,
            engagementRate: (v.viewCount || 0) > 0 ? (((v.likeCount || 0) + (v.commentCount || 0)) / v.viewCount * 100).toFixed(2) : '0.00',
            durationSeconds: v.durationSeconds || parseDurationToSeconds(v.duration),
          })));
        } catch (e) { /* skip failed channels */ }
      }
      setVideos(allVids);
      setChannels(channelList);
    } catch (err) {
      showToast('Failed to load videos: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredVideos = useMemo(() => {
    let result = [...videos];
    if (channelFilter !== 'all')   result = result.filter(v => v.channelId === channelFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(v => v.title?.toLowerCase().includes(q) || (v.tags || []).some(t => t.toLowerCase().includes(q)));
    }
    if (performanceTier !== 'all') {
      const tier = PERFORMANCE_TIERS.find(t => t.value === performanceTier);
      if (tier?.min != null) result = result.filter(v => (v.viewCount || 0) >= tier.min);
      if (tier?.max != null) result = result.filter(v => (v.viewCount || 0) < tier.max);
    }
    result.sort((a, b) => {
      const aVal = a[sortField] ?? 0, bVal = b[sortField] ?? 0;
      if (typeof aVal === 'string') return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return result;
  }, [videos, channelFilter, search, performanceTier, sortField, sortOrder]);

  const pageCount       = Math.ceil(filteredVideos.length / ITEMS_PER_PAGE);
  const paginatedVideos = filteredVideos.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleSort = (field) => {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('desc'); }
  };

  const stats = useMemo(() => ({
    total:         filteredVideos.length,
    totalViews:    filteredVideos.reduce((s, v) => s + (v.viewCount || 0), 0),
    totalLikes:    filteredVideos.reduce((s, v) => s + (v.likeCount || 0), 0),
    totalComments: filteredVideos.reduce((s, v) => s + (v.commentCount || 0), 0),
    avgViews:      filteredVideos.length > 0 ? Math.round(filteredVideos.reduce((s, v) => s + (v.viewCount || 0), 0) / filteredVideos.length) : 0,
  }), [filteredVideos]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Progress className="h-1" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Video Explorer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {videos.length} total videos across {channels.length} channel{channels.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAllVideos} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {[
          { icon: <Play />,        label: 'Videos',       value: fmtNum(stats.total),         gradient: 'blue'   },
          { icon: <Eye />,         label: 'Total Views',  value: fmtNum(stats.totalViews),    gradient: 'red'    },
          { icon: <ThumbsUp />,    label: 'Total Likes',  value: fmtNum(stats.totalLikes),    gradient: 'green'  },
          { icon: <MessageSquare />, label: 'Comments',   value: fmtNum(stats.totalComments), gradient: 'orange' },
          { icon: <Eye />,         label: 'Avg Views',   value: fmtNum(stats.avgViews),      gradient: 'purple' },
        ].map((s, i) => <StatCard key={i} {...s} small />)}
      </div>

      {/* Filters */}
      <MainCard>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by title or tag…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={channelFilter} onValueChange={v => { setChannelFilter(v); setPage(1); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All Channels ({channels.length})</SelectItem>
                {channels.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      {c.thumbnail && <Avatar className="size-4"><AvatarImage src={c.thumbnail} /></Avatar>}
                      <span className="truncate max-w-28">{c.title}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={performanceTier} onValueChange={v => { setPerformanceTier(v); setPage(1); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Performance" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {PERFORMANCE_TIERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
          <div className="flex border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={cn('px-3 py-1.5 transition-colors', viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn('px-3 py-1.5 transition-colors', viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Showing {paginatedVideos.length} of {filteredVideos.length} videos
        </p>
      </MainCard>

      {/* Table view */}
      {viewMode === 'table' && (
        <MainCard content={false}>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead className="w-16" />
                  <TableHead><SortButton field="title" label="Video" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
                  {channels.length > 1 && <TableHead>Channel</TableHead>}
                  <TableHead className="text-right"><SortButton field="viewCount" label="Views" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
                  <TableHead className="text-right"><SortButton field="likeCount" label="Likes" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
                  <TableHead className="text-right"><SortButton field="commentCount" label="Comments" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
                  <TableHead className="text-right"><SortButton field="engagementRate" label="Eng%" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
                  <TableHead className="text-right"><SortButton field="durationSeconds" label="Duration" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
                  <TableHead className="text-right"><SortButton field="publishedAt" label="Published" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} /></TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedVideos.map((v, i) => (
                  <TableRow
                    key={`${v.videoId}-${i}`}
                    className="cursor-pointer"
                    onClick={() => window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank', 'noopener')}
                  >
                    <TableCell className="text-xs text-muted-foreground">{(page - 1) * ITEMS_PER_PAGE + i + 1}</TableCell>
                    <TableCell>
                      {v.thumbnail && (
                        <img src={v.thumbnail} className="w-16 h-9 object-cover rounded" alt="" />
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium max-w-[280px] truncate">{v.title}</p>
                    </TableCell>
                    {channels.length > 1 && (
                      <TableCell>
                        <Badge variant="outline" className="text-xs max-w-28 truncate">{v.channelTitle}</Badge>
                      </TableCell>
                    )}
                    <TableCell className="text-right text-sm font-semibold">{fmtNum(v.viewCount)}</TableCell>
                    <TableCell className="text-right text-sm">{fmtNum(v.likeCount)}</TableCell>
                    <TableCell className="text-right text-sm">{fmtNum(v.commentCount)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={cn('text-xs', parseFloat(v.engagementRate) > 5 ? 'border-green-200 bg-green-50 text-green-700' : '')}>
                        {fmtPercent(v.engagementRate)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">{fmtDuration(v.durationSeconds)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{fmtDate(v.publishedAt)}</TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger render={<Button variant="ghost" size="icon" className="size-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={e => { e.stopPropagation(); window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank', 'noopener'); }} />}>
                          <Play />
                        </TooltipTrigger>
                        <TooltipContent>Watch on YouTube</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </MainCard>
      )}

      {/* Grid view */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedVideos.map((v, i) => (
            <div
              key={`${v.videoId}-${i}`}
              className="border border-border rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow bg-card group"
              onClick={() => window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank', 'noopener')}
            >
              <div className="relative">
                {v.thumbnail
                  ? <img src={v.thumbnail} className="w-full aspect-video object-cover" alt="" />
                  : <div className="w-full aspect-video bg-muted flex items-center justify-center"><Tv className="h-8 w-8 text-muted-foreground" /></div>}
                {v.durationSeconds > 0 && (
                  <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">{fmtDuration(v.durationSeconds)}</span>
                )}
                <span className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-black/75 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                  <Eye className="h-2.5 w-2.5" />{fmtNum(v.viewCount)}
                </span>
              </div>
              <div className="p-3 space-y-1.5">
                <p className="text-xs font-semibold leading-snug line-clamp-2">{v.title}</p>
                {channels.length > 1 && <p className="text-[10px] text-muted-foreground">{v.channelTitle}</p>}
                <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
                  <span className="flex items-center gap-0.5"><ThumbsUp className="h-2.5 w-2.5" />{fmtNum(v.likeCount)}</span>
                  <span className="flex items-center gap-0.5"><MessageSquare className="h-2.5 w-2.5" />{fmtNum(v.commentCount)}</span>
                  <span className="ml-auto">{timeAgo(v.publishedAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filteredVideos.length === 0 && !loading && (
        <MainCard>
          <Empty>
            <EmptyMedia><Tv className="size-10 text-muted-foreground/40" /></EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>No videos found</EmptyTitle>
              <EmptyDescription>
                {accounts?.length === 0 ? 'Add a channel first to explore videos' : 'Try adjusting your filters'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </MainCard>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
          <span className="text-sm text-muted-foreground px-2">Page {page} of {pageCount}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount}>Next</Button>
        </div>
      )}
    </div>
  );
}
