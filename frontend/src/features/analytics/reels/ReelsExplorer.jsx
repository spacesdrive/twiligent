import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Heart, MessageCircle, Eye, Clapperboard, Image, Film, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/PageHeader';
import MetricBox from '@/components/MetricBox';
import SurfaceBox from '@/components/SurfaceBox';
import SearchField from '@/components/SearchField';
import FilterChips from '@/components/FilterChips';
import Pager from '@/components/Pager';
import MediaCard, { MediaChip } from '@/components/MediaCard';
import { EmptyState } from '@/components/StateViews';
import { InstagramIcon } from '@/components/brand/platform-icons';
import { LIKE_TIERS, filterByTier, matchesText, pageSlice } from '@/lib/library';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, timeAgo } from '../../../utils/formatters';
import { IG_CONTENT_TYPES, IG_CONTENT_TYPE_META, igContentTypeMeta, fmtIGViews } from '../../../utils/instagramContent';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 24;
const CONTENT_TYPE_ICONS = { reel: Clapperboard, post: Image, video: Film };

const SORT_OPTIONS = [
  { value: 'viewCount',      label: 'Most viewed' },
  { value: 'likeCount',      label: 'Most liked' },
  { value: 'commentsCount',  label: 'Most comments' },
  { value: 'engagementRate', label: 'Best engagement' },
  { value: 'timestamp',      label: 'Newest first' },
];

function sortValue(item, field) {
  if (field === 'timestamp') return new Date(item.timestamp).getTime() || 0;
  return item[field] ?? -1;
}

export default function ReelsExplorer() {
  const { accounts, showToast } = useAppContext();
  const igAccounts = useMemo(() => accounts.filter(a => a.platform === 'instagram'), [accounts]);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [tier, setTier] = useState('all');
  const [sortField, setSortField] = useState('viewCount');
  const [page, setPage] = useState(1);

  const loadAllMedia = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled(igAccounts.map(acct => api.getIGMedia(acct.id)));
      const all = [];
      results.forEach((result, i) => {
        if (result.status !== 'fulfilled') return;
        const acct = igAccounts[i];
        for (const m of result.value.media || []) {
          all.push({
            ...m,
            accountTitle: acct.title || acct.username || 'Unknown account',
            accountId: acct.id,
            engagementRate: m.viewCount > 0 ? ((m.likeCount || 0) + (m.commentsCount || 0)) / m.viewCount * 100 : null,
          });
        }
      });
      setMedia(all);
    } catch (err) {
      showToast(`Couldn't load Instagram content. ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [igAccounts, showToast]);

  useEffect(() => { loadAllMedia(); }, [loadAllMedia]);

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
    let result = typeFilter === 'all' ? accountMedia : accountMedia.filter(m => m.contentType === typeFilter);
    result = result.filter(m => matchesText([m.caption], search));
    result = filterByTier(result, LIKE_TIERS, tier, 'likeCount');
    return [...result].sort((a, b) => sortValue(b, sortField) - sortValue(a, sortField));
  }, [accountMedia, typeFilter, search, tier, sortField]);

  const paged = pageSlice(filtered, page, ITEMS_PER_PAGE);
  const resetPage = setter => value => { setter(value); setPage(1); };

  const typeChips = [
    { value: 'all', label: 'All types', count: accountMedia.length },
    ...IG_CONTENT_TYPES.map(t => ({ value: t, label: IG_CONTENT_TYPE_META[t].plural, icon: CONTENT_TYPE_ICONS[t], count: typeTotals[t].count })),
  ];

  const header = (
    <PageHeader
      title="Instagram content"
      description={loading ? 'Loading content from your accounts' : `${fmtNum(media.length)} item${media.length === 1 ? '' : 's'} across ${igAccounts.length} account${igAccounts.length === 1 ? '' : 's'}`}
      actions={
        <Button variant="outline" size="sm" onClick={loadAllMedia} disabled={loading}>
          <RefreshCw data-icon="inline-start" className={cn(loading && 'animate-spin')} />
          Refresh
        </Button>
      }
    />
  );

  if (igAccounts.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <SurfaceBox>
          <EmptyState
            icon={<InstagramIcon />}
            title="No Instagram accounts yet"
            description="Connect a Business or Creator account to browse its reels, posts and videos."
            action={<Button render={<Link to="/accounts?add=1" />}><Plus data-icon="inline-start" />Add an account</Button>}
          />
        </SurfaceBox>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-card" />)}
        </div>
        <Skeleton className="h-10 rounded-field" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-card" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricBox small icon={<Eye />} label="Views" value={fmtNum(totalViews)} subtitle={`${viewsReported} of ${accountMedia.length} items report views`} highlight />
        {IG_CONTENT_TYPES.map(type => {
          const Icon = CONTENT_TYPE_ICONS[type];
          return (
            <MetricBox
              key={type}
              small
              icon={<Icon />}
              label={IG_CONTENT_TYPE_META[type].plural}
              value={fmtNum(typeTotals[type].count)}
              subtitle={typeTotals[type].viewsReported > 0 ? `${fmtNum(typeTotals[type].views)} views` : 'No views reported'}
            />
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={search} onChange={resetPage(setSearch)} placeholder="Search captions" className="min-w-56 flex-1" />
          {igAccounts.length > 1 && (
            <Select
              value={accountFilter}
              onValueChange={resetPage(setAccountFilter)}
              items={[{ value: 'all', label: 'All accounts' }, ...igAccounts.map(a => ({ value: a.id, label: a.title || a.username }))]}
            >
              <SelectTrigger className="w-44" aria-label="Account"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All accounts</SelectItem>
                  {igAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.title || a.username}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
          <Select value={tier} onValueChange={resetPage(setTier)} items={LIKE_TIERS}>
            <SelectTrigger className="w-36" aria-label="Likes"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {LIKE_TIERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={sortField} onValueChange={setSortField} items={SORT_OPTIONS}>
            <SelectTrigger className="w-44" aria-label="Sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <FilterChips label="Content type" options={typeChips} value={typeFilter} onChange={resetPage(setTypeFilter)} />
      </div>

      {filtered.length === 0 ? (
        <SurfaceBox>
          <EmptyState compact icon={<InstagramIcon />} title="No content matches" description="Clear the search or choose a different type or like range." />
        </SurfaceBox>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {paged.items.map((m, i) => {
            const meta = igContentTypeMeta(m.contentType);
            return (
              <MediaCard
                key={`${m.id}-${i}`}
                aspect="square"
                href={m.permalink}
                image={m.contentType === 'post' ? (m.thumbnailUrl || m.mediaUrl) : m.thumbnailUrl}
                title={m.caption}
                topLeft={<MediaChip>{meta.label}</MediaChip>}
                meta={
                  <>
                    <span className="flex items-center gap-1"><Eye />{fmtIGViews(m.viewCount)}</span>
                    <span className="flex items-center gap-1"><Heart />{fmtNum(m.likeCount)}</span>
                    <span className="flex items-center gap-1"><MessageCircle />{fmtNum(m.commentsCount)}</span>
                    <span className="ml-auto">{timeAgo(m.timestamp)}</span>
                  </>
                }
              />
            );
          })}
        </div>
      )}

      <Pager page={paged.page} pageCount={paged.pageCount} onPageChange={setPage} total={filtered.length} shown={paged.items.length} noun="items" />
    </div>
  );
}
