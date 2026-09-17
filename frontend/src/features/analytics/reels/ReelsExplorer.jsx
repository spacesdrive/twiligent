import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, RefreshCw, Heart, MessageCircle, Camera, Eye, Clapperboard, Image, Film } from 'lucide-react';
import { Empty, EmptyMedia, EmptyHeader, EmptyDescription } from '@/components/ui/empty';
import StatCard from '../../../components/ui/StatCard';
import MainCard from '../../../components/MainCard';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, timeAgo } from '../../../utils/formatters';
import { IG_CONTENT_TYPES, IG_CONTENT_TYPE_META, igContentTypeMeta, fmtIGViews } from '../../../utils/instagramContent';

const ITEMS_PER_PAGE = 24;

const CONTENT_TYPE_FILTER = [
  { label: 'All Types', value: 'all' },
  ...IG_CONTENT_TYPES.map(type => ({ label: IG_CONTENT_TYPE_META[type].plural, value: type })),
];

const CONTENT_TYPE_ICONS = { reel: <Clapperboard />, post: <Image />, video: <Film /> };
const CONTENT_TYPE_GRADIENTS = { reel: 'pink', post: 'orange', video: 'purple' };

const PERFORMANCE_TIERS = [
  { label: 'All Likes',        value: 'all' },
  { label: 'Viral (>100K)',    value: 'viral',  min: 100000 },
  { label: 'High (10K-100K)',  value: 'high',   min: 10000, max: 100000 },
  { label: 'Medium (1K-10K)',  value: 'medium', min: 1000,  max: 10000 },
  { label: 'Low (<1K)',        value: 'low',    max: 1000 },
];

const SORT_OPTIONS = [
  { label: 'Most Viewed',     value: 'viewCount' },
  { label: 'Most Liked',      value: 'likeCount' },
  { label: 'Most Comments',   value: 'commentsCount' },
  { label: 'Best Engagement', value: 'engagementRate' },
  { label: 'Newest First',    value: 'timestamp' },
];

function sortValue(item, field) {
  if (field === 'timestamp') return new Date(item.timestamp).getTime() || 0;
  return item[field] ?? -1;
}

export default function ReelsExplorer() {
  const { accounts, showToast } = useAppContext();
  const [media,             setMedia]             = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [search,            setSearch]            = useState('');
  const [accountFilter,     setAccountFilter]     = useState('all');
  const [contentTypeFilter, setContentTypeFilter] = useState('all');
  const [performanceTier,   setPerformanceTier]   = useState('all');
  const [sortField,         setSortField]         = useState('viewCount');
  const [page,              setPage]              = useState(1);
  const [igAccounts,        setIgAccounts]        = useState([]);

  useEffect(() => { loadAllMedia(); }, [accounts]);

  const loadAllMedia = async () => {
    setLoading(true);
    try {
      const all = [];
      const accList = [];
      for (const acct of (accounts || [])) {
        if (acct.platform !== 'instagram') continue;
        try {
          const res = await api.getIGMedia(acct.id);
          const items = res.media || [];
          accList.push({ value: acct.id, label: acct.title || acct.username || 'Unknown' });
          all.push(...items.map(m => ({
            ...m,
            accountTitle: acct.title || acct.username || 'Unknown',
            accountId: acct.id,
            engagementRate: m.viewCount > 0 ? ((m.likeCount || 0) + (m.commentsCount || 0)) / m.viewCount * 100 : null,
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

  const accountMedia = useMemo(
    () => accountFilter === 'all' ? media : media.filter(m => m.accountId === accountFilter),
    [media, accountFilter],
  );

  const typeTotals = useMemo(() => {
    const totals = Object.fromEntries(IG_CONTENT_TYPES.map(t => [t, { count: 0, views: 0, viewsReported: 0 }]));
    accountMedia.forEach(m => {
      const t = totals[m.contentType] ?? totals.post;
      t.count++;
      if (typeof m.viewCount === 'number') {
        t.views += m.viewCount;
        t.viewsReported++;
      }
    });
    return totals;
  }, [accountMedia]);

  const totalViews = IG_CONTENT_TYPES.reduce((s, t) => s + typeTotals[t].views, 0);
  const viewsReported = IG_CONTENT_TYPES.reduce((s, t) => s + typeTotals[t].viewsReported, 0);

  const filtered = useMemo(() => {
    let result = [...accountMedia];
    if (contentTypeFilter !== 'all') result = result.filter(m => m.contentType === contentTypeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(m => m.caption?.toLowerCase().includes(q));
    }
    if (performanceTier !== 'all') {
      const tier = PERFORMANCE_TIERS.find(t => t.value === performanceTier);
      if (tier?.min != null) result = result.filter(m => (m.likeCount || 0) >= tier.min);
      if (tier?.max != null) result = result.filter(m => (m.likeCount || 0) < tier.max);
    }
    result.sort((a, b) => sortValue(b, sortField) - sortValue(a, sortField));
    return result;
  }, [accountMedia, contentTypeFilter, search, performanceTier, sortField]);

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
            {media.length} item{media.length !== 1 ? 's' : ''} across {igAccounts.length} account{igAccounts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAllMedia} className="gap-2">
          <RefreshCw data-icon="inline-start" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          icon={<Eye />}
          label="Total Views"
          value={fmtNum(totalViews)}
          subtitle={`${viewsReported} of ${accountMedia.length} items report views`}
          gradient="blue"
          small
        />
        {IG_CONTENT_TYPES.map(type => (
          <StatCard
            key={type}
            icon={CONTENT_TYPE_ICONS[type]}
            label={IG_CONTENT_TYPE_META[type].plural}
            value={fmtNum(typeTotals[type].count)}
            subtitle={typeTotals[type].viewsReported > 0 ? `${fmtNum(typeTotals[type].views)} views` : 'no views reported'}
            gradient={CONTENT_TYPE_GRADIENTS[type]}
            small
          />
        ))}
      </div>

      <MainCard>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search captions..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          {igAccounts.length > 1 && (
            <Select value={accountFilter} onValueChange={v => { setAccountFilter(v); setPage(1); }} items={[{ value: 'all', label: 'All Accounts' }, ...igAccounts]}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {igAccounts.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
          <Select value={contentTypeFilter} onValueChange={v => { setContentTypeFilter(v); setPage(1); }} items={CONTENT_TYPE_FILTER}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>{CONTENT_TYPE_FILTER.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
          <Select value={performanceTier} onValueChange={v => { setPerformanceTier(v); setPage(1); }} items={PERFORMANCE_TIERS}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>{PERFORMANCE_TIERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
          <Select value={sortField} onValueChange={setSortField} items={SORT_OPTIONS}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>{SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Showing {paged.length} of {filtered.length} items</p>
      </MainCard>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
        {paged.map((m, i) => {
          const meta = igContentTypeMeta(m.contentType);
          const thumb = m.contentType === 'post' ? (m.thumbnailUrl || m.mediaUrl) : m.thumbnailUrl;
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
                <span className="absolute top-1.5 left-1.5 text-white text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: meta.color }}>
                  {meta.label}
                </span>
              </div>
              <div className="p-2.5 space-y-1.5">
                {m.caption && (
                  <p className="text-[11px] leading-snug line-clamp-2 text-foreground/80">{m.caption}</p>
                )}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{fmtIGViews(m.viewCount)}</span>
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
                  : 'No content matches your filters'}
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
