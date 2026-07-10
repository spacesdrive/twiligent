import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, RefreshCw, Eye, ThumbsUp, MessageSquare, Play, Tv } from 'lucide-react';
import { Empty, EmptyMedia, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import MainCard from '../../../components/MainCard';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, fmtDuration, timeAgo } from '../../../utils/formatters';

const ITEMS_PER_PAGE = 24;

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

const SORT_OPTIONS = [
  { label: 'Most Viewed',     field: 'viewCount' },
  { label: 'Most Liked',      field: 'likeCount' },
  { label: 'Most Comments',   field: 'commentCount' },
  { label: 'Best Engagement', field: 'engagementRate' },
  { label: 'Newest First',    field: 'publishedAt' },
];

export default function ShortsExplorer() {
  const { accounts, showToast } = useAppContext();
  const [shorts,          setShorts]          = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [search,          setSearch]          = useState('');
  const [channelFilter,   setChannelFilter]   = useState('all');
  const [performanceTier, setPerformanceTier] = useState('all');
  const [sortField,       setSortField]       = useState('viewCount');
  const [page,            setPage]            = useState(1);
  const [channels,        setChannels]        = useState([]);

  useEffect(() => { loadAllShorts(); }, [accounts]);

  const loadAllShorts = async () => {
    setLoading(true);
    try {
      const all = [];
      const channelList = [];
      for (const acct of (accounts || [])) {
        if (acct.platform === 'instagram') continue;
        try {
          const res = await api.getVideos(acct.id);
          const vids = res.videos || res.data?.videos || [];
          const channelTitle = acct.title || 'Unknown';
          channelList.push({ id: acct.id, title: channelTitle, thumbnail: acct.thumbnails?.default || '' });
          const shortsOnly = vids.filter(v => {
            const secs = v.durationSeconds || parseDurationToSeconds(v.duration);
            return secs > 0 && secs <= 60;
          });
          all.push(...shortsOnly.map(v => ({
            ...v,
            thumbnail: v.thumbnail || v.thumbnails?.medium || v.thumbnails?.default || '',
            channelTitle,
            channelId: acct.id,
            engagementRate: (v.viewCount || 0) > 0 ? (((v.likeCount || 0) + (v.commentCount || 0)) / v.viewCount * 100).toFixed(2) : '0.00',
            durationSeconds: v.durationSeconds || parseDurationToSeconds(v.duration),
          })));
        } catch (e) { /* skip */ }
      }
      setShorts(all);
      setChannels(channelList);
    } catch (err) {
      showToast('Failed to load Shorts: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = [...shorts];
    if (channelFilter !== 'all') result = result.filter(v => v.channelId === channelFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(v => v.title?.toLowerCase().includes(q));
    }
    if (performanceTier !== 'all') {
      const tier = PERFORMANCE_TIERS.find(t => t.value === performanceTier);
      if (tier?.min != null) result = result.filter(v => (v.viewCount || 0) >= tier.min);
      if (tier?.max != null) result = result.filter(v => (v.viewCount || 0) < tier.max);
    }
    result.sort((a, b) => (b[sortField] ?? 0) - (a[sortField] ?? 0));
    return result;
  }, [shorts, channelFilter, search, performanceTier, sortField]);

  const pageCount = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged     = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 mb-2" />
        <Progress className="h-1" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {[...Array(12)].map((_, i) => <Skeleton key={i} className="aspect-[9/16] rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shorts Explorer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {shorts.length} Shorts across {channels.length} channel{channels.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAllShorts} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <MainCard>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search Shorts…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          {channels.length > 1 && (
            <Select value={channelFilter} onValueChange={v => { setChannelFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Channels" /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All Channels</SelectItem>
                  {channels.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
          <Select value={performanceTier} onValueChange={v => { setPerformanceTier(v); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>{PERFORMANCE_TIERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
          <Select value={sortField} onValueChange={setSortField}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>{SORT_OPTIONS.map(o => <SelectItem key={o.field} value={o.field}>{o.label}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Showing {paged.length} of {filtered.length} Shorts</p>
      </MainCard>

      {/* Vertical card grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
        {paged.map((v, i) => (
          <div
            key={`${v.videoId}-${i}`}
            className="border border-border rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow bg-card"
            onClick={() => window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank', 'noopener')}
          >
            <div className="relative">
              {v.thumbnail
                ? <img src={v.thumbnail} className="w-full aspect-[9/16] object-cover" alt="" />
                : <div className="w-full aspect-[9/16] bg-muted flex items-center justify-center"><Tv className="h-6 w-6 text-muted-foreground" /></div>}
              <span className="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-black/75 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                <Eye className="h-2.5 w-2.5" />{fmtNum(v.viewCount)}
              </span>
              {v.durationSeconds > 0 && (
                <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">{fmtDuration(v.durationSeconds)}</span>
              )}
            </div>
            <div className="p-2 space-y-1">
              <p className="text-[11px] font-semibold line-clamp-2 leading-snug">{v.title}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5"><ThumbsUp className="h-2.5 w-2.5" />{fmtNum(v.likeCount)}</span>
                <span className="flex items-center gap-0.5"><MessageSquare className="h-2.5 w-2.5" />{fmtNum(v.commentCount)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <MainCard>
          <Empty>
            <EmptyMedia><Tv className="size-10 text-muted-foreground/40" /></EmptyMedia>
            <EmptyHeader>
              <EmptyDescription>No Shorts found. Try adjusting filters or add a YouTube channel.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </MainCard>
      )}

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
