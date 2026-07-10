import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, RefreshCw, Heart, MessageCircle, Play, Image, Film, LayoutGrid, Camera } from 'lucide-react';
import { Empty, EmptyMedia, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import MainCard from '../../../components/MainCard';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, timeAgo } from '../../../utils/formatters';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 24;

const MEDIA_TYPE_FILTER = [
  { label: 'All Types',  value: 'all' },
  { label: 'Reels',      value: 'REEL' },
  { label: 'Videos',     value: 'VIDEO' },
  { label: 'Photos',     value: 'IMAGE' },
  { label: 'Carousels',  value: 'CAROUSEL_ALBUM' },
];

const MEDIA_TYPE_META = {
  REEL:           { label: 'Reel',     className: 'bg-pink-600' },
  VIDEO:          { label: 'Video',    className: 'bg-purple-600' },
  IMAGE:          { label: 'Photo',    className: 'bg-orange-500' },
  CAROUSEL_ALBUM: { label: 'Carousel', className: 'bg-blue-600' },
};

const PERFORMANCE_TIERS = [
  { label: 'All',              value: 'all' },
  { label: 'Viral (>100K)',    value: 'viral',  min: 100000 },
  { label: 'High (10K-100K)', value: 'high',   min: 10000, max: 100000 },
  { label: 'Medium (1K-10K)', value: 'medium', min: 1000,  max: 10000 },
  { label: 'Low (<1K)',        value: 'low',    max: 1000 },
];

const SORT_OPTIONS = [
  { label: 'Most Liked',      field: 'likeCount' },
  { label: 'Most Comments',   field: 'commentsCount' },
  { label: 'Best Engagement', field: 'engagementRate' },
  { label: 'Newest First',    field: 'timestamp' },
];

export default function ReelsExplorer() {
  const { accounts, showToast } = useAppContext();
  const [media,           setMedia]           = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [search,          setSearch]          = useState('');
  const [accountFilter,   setAccountFilter]   = useState('all');
  const [mediaTypeFilter, setMediaTypeFilter] = useState('all');
  const [performanceTier, setPerformanceTier] = useState('all');
  const [sortField,       setSortField]       = useState('likeCount');
  const [page,            setPage]            = useState(1);
  const [igAccounts,      setIgAccounts]      = useState([]);

  useEffect(() => { loadAllReels(); }, [accounts]);

  const loadAllReels = async () => {
    setLoading(true);
    try {
      const all = [];
      const accList = [];
      for (const acct of (accounts || [])) {
        if (acct.platform !== 'instagram') continue;
        try {
          const res = await api.getIGMedia(acct.id);
          const items = res.media || res.data || [];
          accList.push({ id: acct.id, title: acct.title || acct.username || 'Unknown', thumbnail: acct.profilePictureUrl || '' });
          all.push(...items.map(m => ({
            ...m,
            accountTitle: acct.title || acct.username || 'Unknown',
            accountId: acct.id,
            engagementRate: (m.likeCount || 0) > 0 ? (((m.likeCount || 0) + (m.commentsCount || 0)) / (m.likeCount || 1) * 100).toFixed(2) : '0.00',
          })));
        } catch (e) { console.warn('Failed to load media for', acct.id, e.message); }
      }
      setMedia(all);
      setIgAccounts(accList);
    } catch (err) {
      showToast('Failed to load content: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = [...media];
    if (accountFilter !== 'all')   result = result.filter(m => m.accountId === accountFilter);
    if (mediaTypeFilter !== 'all') result = result.filter(m => m.mediaType === mediaTypeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(m => m.caption?.toLowerCase().includes(q));
    }
    if (performanceTier !== 'all') {
      const tier = PERFORMANCE_TIERS.find(t => t.value === performanceTier);
      if (tier?.min != null) result = result.filter(m => (m.likeCount || 0) >= tier.min);
      if (tier?.max != null) result = result.filter(m => (m.likeCount || 0) < tier.max);
    }
    result.sort((a, b) => (b[sortField] ?? 0) - (a[sortField] ?? 0));
    return result;
  }, [media, accountFilter, mediaTypeFilter, search, performanceTier, sortField]);

  const pageCount = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged     = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 mb-2" />
        <Progress className="h-1" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">IG Content Explorer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {media.length} posts across {igAccounts.length} account{igAccounts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAllReels} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <MainCard>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search captions…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          {igAccounts.length > 1 && (
            <Select value={accountFilter} onValueChange={v => { setAccountFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Accounts" /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {igAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
          <Select value={mediaTypeFilter} onValueChange={v => { setMediaTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>{MEDIA_TYPE_FILTER.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
          <Select value={performanceTier} onValueChange={v => { setPerformanceTier(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>{PERFORMANCE_TIERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
          <Select value={sortField} onValueChange={setSortField}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>{SORT_OPTIONS.map(o => <SelectItem key={o.field} value={o.field}>{o.label}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Showing {paged.length} of {filtered.length} posts</p>
      </MainCard>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
        {paged.map((m, i) => {
          const meta = MEDIA_TYPE_META[m.mediaType] || MEDIA_TYPE_META.IMAGE;
          const isVideo = m.mediaType === 'REEL' || m.mediaType === 'VIDEO';
          const thumb = isVideo ? m.thumbnailUrl : (m.thumbnailUrl || m.mediaUrl);
          return (
            <div
              key={`${m.id}-${i}`}
              className="border border-border rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow bg-card group"
              onClick={() => m.permalink && window.open(m.permalink, '_blank', 'noopener')}
            >
              <div className="relative aspect-square">
                {thumb
                  ? <img src={thumb} className="w-full h-full object-cover" alt="" />
                  : <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center"><Camera className="h-8 w-8 text-white" /></div>}
                <span className={cn('absolute top-1.5 left-1.5 text-white text-[9px] font-bold px-1.5 py-0.5 rounded', meta.className)}>
                  {meta.label}
                </span>
              </div>
              <div className="p-2.5 space-y-1.5">
                {m.caption && (
                  <p className="text-[11px] leading-snug line-clamp-2 text-foreground/80">{m.caption}</p>
                )}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-0.5"><Heart className="h-3 w-3 text-pink-500" />{fmtNum(m.likeCount)}</span>
                  <span className="flex items-center gap-0.5"><MessageCircle className="h-3 w-3" />{fmtNum(m.commentsCount)}</span>
                  <span className="ml-auto">{timeAgo(m.timestamp)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && !loading && (
        <MainCard>
          <Empty>
            <EmptyMedia><Camera className="size-10 text-muted-foreground/40" /></EmptyMedia>
            <EmptyHeader>
              <EmptyDescription>
                {accounts?.filter(a => a.platform === 'instagram').length === 0
                  ? 'Add an Instagram account to explore content'
                  : 'No posts match your filters'}
              </EmptyDescription>
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
