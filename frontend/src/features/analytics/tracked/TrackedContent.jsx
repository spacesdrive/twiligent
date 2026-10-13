import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Plus, RefreshCw, Trash2, Pencil, ExternalLink, Upload, X, Tag, Bookmark, BookmarkCheck, CirclePlay,
  MessagesSquare, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Spinner } from '@/components/ui/spinner';
import PageHeader from '@/components/PageHeader';
import MetricBox from '@/components/MetricBox';
import SurfaceBox from '@/components/SurfaceBox';
import SearchField from '@/components/SearchField';
import FilterChips from '@/components/FilterChips';
import ConfirmDialog from '@/components/ConfirmDialog';
import ImageLightbox from '@/components/ImageLightbox';
import { FieldRow } from '@/components/DetailPanel';
import { EmptyState } from '@/components/StateViews';
import { PlatformBadge } from '@/components/platform';
import { matchesText } from '@/lib/library';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, fmtDate } from '../../../utils/formatters';
import {
  trackedViews, hasTrackedViews, detectContentType, isRedditItem, trackedEngagement, trackedComments,
} from '../../../utils/trackedContent';
import { cn } from '@/lib/utils';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const SORT_OPTIONS = [
  { value: 'date-desc',       label: 'Newest first' },
  { value: 'engagement-desc', label: 'Most likes or karma' },
  { value: 'comments-desc',   label: 'Most comments' },
  { value: 'views-desc',      label: 'Most views' },
];

function CategoryPicker({ categories, onPick }) {
  if (categories.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          className="h-6 rounded-pill border border-line px-2.5 text-caption font-medium text-ink-muted transition-colors duration-(--duration-fast) hover:bg-surface-hover hover:text-ink"
        >
          {c}
        </button>
      ))}
    </div>
  );
}

function RowAction({ label, onClick, disabled, children, href, danger }) {
  const button = href
    ? <Button variant="ghost" size="icon-xs" render={<a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} />} />
    : <Button variant="ghost" size="icon-xs" onClick={onClick} disabled={disabled} aria-label={label} className={cn(danger && 'hover:bg-danger-soft hover:text-danger')} />;
  return (
    <Tooltip>
      <TooltipTrigger render={button}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export default function TrackedContent() {
  const { accounts, showToast } = useAppContext();
  const redditAccounts = accounts.filter(a => a.platform === 'reddit');

  const [items,          setItems]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [addOpen,        setAddOpen]        = useState(false);
  const [editItem,       setEditItem]       = useState(null);
  const [deleteItem,     setDeleteItem]     = useState(null);
  const [deleting,       setDeleting]       = useState(false);
  const [selected,       setSelected]       = useState(new Set());
  const [bulkCategory,   setBulkCategory]   = useState('');
  const [query,          setQuery]          = useState('');
  const [typeFilter,     setTypeFilter]     = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sort,           setSort]           = useState('date-desc');
  const [refreshingIds,  setRefreshingIds]  = useState(new Set());

  const [addUrl,       setAddUrl]       = useState('');
  const [detectedType, setDetectedType] = useState(null);
  const [addAccountId, setAddAccountId] = useState(redditAccounts[0]?.id ?? 'none');
  const [addLabel,     setAddLabel]     = useState('');
  const [addCategory,  setAddCategory]  = useState('');
  const [adding,       setAdding]       = useState(false);

  const [editLabel,    setEditLabel]    = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editViews,    setEditViews]    = useState('');
  const [editImageUrl, setEditImageUrl] = useState(null);
  const [uploading,    setUploading]    = useState(false);
  const [saving,       setSaving]       = useState(false);

  const [cloudConfig,  setCloudConfig]  = useState(null);
  const imageInputRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getTrackedContent();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(`Couldn't load tracked content. ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  // Cloudinary config is only needed for Reddit image uploads; a missing config disables that field
  useEffect(() => {
    api.getCloudinaryConfig()
      .then(res => { if (res?.success) setCloudConfig(res); })
      .catch(() => {});
  }, []);

  function handleUrlChange(val) {
    setAddUrl(val);
    setDetectedType(detectContentType(val));
  }

  function resetAddForm() {
    setAddUrl(''); setDetectedType(null); setAddLabel(''); setAddCategory('');
  }

  const categories = useMemo(() => [...new Set(items.map(p => p.category).filter(Boolean))].sort(), [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (typeFilter !== 'all') result = result.filter(p => (p.contentType || 'reddit') === typeFilter);
    if (categoryFilter !== 'all') result = result.filter(p => p.category === categoryFilter);
    result = result.filter(p => matchesText([p.title, p.subreddit, p.channelTitle, p.label, p.category], query));
    return [...result].sort((a, b) => {
      if (sort === 'engagement-desc') return trackedEngagement(b) - trackedEngagement(a);
      if (sort === 'comments-desc')   return trackedComments(b) - trackedComments(a);
      if (sort === 'views-desc')      return trackedViews(b) - trackedViews(a);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [items, query, typeFilter, categoryFilter, sort]);

  const stats = useMemo(() => ({
    total: items.length,
    categories: categories.length,
    youtube: items.filter(p => p.contentType === 'youtube').length,
    reddit: items.filter(p => isRedditItem(p)).length,
  }), [items, categories]);

  const allSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    setSelected(prev => {
      const next = new Set(prev);
      filtered.forEach(p => (allSelected ? next.delete(p.id) : next.add(p.id)));
      return next;
    });
  }

  function toggleOne(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleAdd(e) {
    e?.preventDefault();
    if (!addUrl.trim()) { showToast('Paste a Reddit post or YouTube video link to track it.', 'error'); return; }
    const type = detectContentType(addUrl.trim());
    if (!type) { showToast('That link is not a Reddit post or a YouTube video. Paste one of those.', 'error'); return; }
    setAdding(true);
    try {
      const accountId = (type === 'reddit' && addAccountId !== 'none') ? addAccountId : null;
      const item = await api.addTrackedContent(addUrl.trim(), accountId, addLabel.trim(), addCategory.trim());
      setItems(prev => [item, ...prev]);
      setAddOpen(false);
      resetAddForm();
      showToast('Now tracking this content');
    } catch (err) {
      showToast(`Couldn't track that link. ${err.message}`, 'error');
    } finally {
      setAdding(false);
    }
  }

  function openEdit(item) {
    setEditItem(item);
    setEditLabel(item.label || '');
    setEditCategory(item.category || '');
    setEditViews(item.manualViews != null ? String(item.manualViews) : '');
    setEditImageUrl(item.imageUrl || null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  // The Worker never handles binary uploads: the browser posts straight to Cloudinary with the
  // unsigned preset and only the returned URL is saved on the tracked item
  async function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!cloudConfig) {
      showToast('Image uploads need Cloudinary set up on the server. Check Settings.', 'error');
      return;
    }
    if (!file.type.startsWith('image/')) {
      showToast('That file is not an image. Choose a PNG, JPG or WebP file.', 'error');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showToast(`That image is too large. Choose one under ${MAX_IMAGE_BYTES / 1024 / 1024}MB.`, 'error');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', cloudConfig.uploadPreset);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudConfig.cloudName}/image/upload`,
        { method: 'POST', body: formData },
      );
      const json = await res.json();
      if (!res.ok || !json.secure_url) {
        throw new Error(json.error?.message || 'Cloudinary did not return an image URL');
      }
      setEditImageUrl(json.secure_url);
      showToast('Image uploaded');
    } catch (err) {
      showToast(`Image upload failed. ${err.message}`, 'error');
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  }

  async function handleSaveEdit(e) {
    e?.preventDefault();
    if (!editItem) return;

    const updates = { label: editLabel, category: editCategory };

    if (isRedditItem(editItem)) {
      const raw = editViews.trim();
      if (raw === '') {
        updates.manualViews = null;
      } else {
        const views = Number(raw);
        if (!Number.isInteger(views) || views < 0) {
          showToast('Views must be a whole number of 0 or more.', 'error');
          return;
        }
        updates.manualViews = views;
      }
      updates.imageUrl = editImageUrl || null;
    }

    setSaving(true);
    try {
      const updated = await api.updateTrackedContent(editItem.id, updates);
      setItems(prev => prev.map(p => p.id === editItem.id ? updated : p));
      setEditItem(null);
      showToast('Changes saved');
    } catch (err) {
      showToast(`Couldn't save the changes. ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteItem) return;
    const id = deleteItem.id;
    setDeleting(true);
    try {
      await api.deleteTrackedContent(id);
      setItems(prev => prev.filter(p => p.id !== id));
      setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
      setDeleteItem(null);
      showToast('Stopped tracking this content');
    } catch (err) {
      showToast(`Couldn't stop tracking. ${err.message}`, 'error');
    } finally {
      setDeleting(false);
    }
  }

  async function handleRefresh(id) {
    setRefreshingIds(prev => new Set(prev).add(id));
    try {
      const updated = await api.refreshTrackedContent(id);
      setItems(prev => prev.map(p => p.id === id ? updated : p));
    } catch (err) {
      showToast(`Refresh failed. ${err.message}`, 'error');
    } finally {
      setRefreshingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  async function handleBulkCategory(e) {
    e?.preventDefault();
    if (!bulkCategory.trim() || selected.size === 0) return;
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map(id => api.updateTrackedContent(id, { category: bulkCategory.trim() })));
    const succeeded = results
      .map((r, i) => (r.status === 'fulfilled' ? { id: ids[i], data: r.value } : null))
      .filter(Boolean);
    setItems(prev => prev.map(p => succeeded.find(s => s.id === p.id)?.data ?? p));
    setSelected(new Set());
    setBulkCategory('');
    const failed = ids.length - succeeded.length;
    showToast(
      failed > 0
        ? `Category set on ${succeeded.length} item${succeeded.length !== 1 ? 's' : ''}. ${failed} could not be updated; try those again.`
        : `Category set on ${succeeded.length} item${succeeded.length !== 1 ? 's' : ''}`,
      failed > 0 ? 'warning' : 'success',
    );
  }

  const header = (
    <PageHeader
      title="Tracked content"
      description="Reddit posts and YouTube videos you follow, with karma, likes and comments."
      actions={
        <Button onClick={() => setAddOpen(true)}>
          <Plus data-icon="inline-start" />
          Track content
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-card" />)}
        </div>
        <Skeleton className="h-10 rounded-field" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    );
  }

  const typeChips = [
    { value: 'all', label: 'All', count: stats.total },
    { value: 'reddit', label: 'Reddit posts', count: stats.reddit },
    { value: 'youtube', label: 'YouTube videos', count: stats.youtube },
  ];

  return (
    <div className="flex flex-col gap-6">
      {header}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricBox icon={<BookmarkCheck />}  label="Tracked items" value={stats.total}      subtitle="Across all categories" highlight />
        <MetricBox icon={<Tag />}            label="Categories"    value={stats.categories} subtitle={stats.categories === 0 ? 'None assigned yet' : `${stats.categories} group${stats.categories !== 1 ? 's' : ''}`} />
        <MetricBox icon={<CirclePlay />}     label="YouTube"       value={stats.youtube}    subtitle={stats.youtube === 0 ? 'No videos tracked' : `Video${stats.youtube !== 1 ? 's' : ''} tracked`} />
        <MetricBox icon={<MessagesSquare />} label="Reddit"        value={stats.reddit}     subtitle={stats.reddit === 0 ? 'No posts tracked' : `Post${stats.reddit !== 1 ? 's' : ''} tracked`} />
      </div>

      {items.length === 0 ? (
        <SurfaceBox>
          <EmptyState
            icon={<Bookmark />}
            title="Nothing tracked yet"
            description="Paste a Reddit post or YouTube video link to follow its karma, likes and comments."
            action={<Button onClick={() => setAddOpen(true)}><Plus data-icon="inline-start" />Track your first item</Button>}
          />
        </SurfaceBox>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <SearchField value={query} onChange={setQuery} placeholder="Search titles, channels, subreddits and labels" className="min-w-56 flex-1" />
              {categories.length > 0 && (
                <Select
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                  items={[{ value: 'all', label: 'All categories' }, ...categories.map(c => ({ value: c, label: c }))]}
                >
                  <SelectTrigger className="w-44" aria-label="Category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              <Select value={sort} onValueChange={setSort} items={SORT_OPTIONS}>
                <SelectTrigger className="w-48" aria-label="Sort"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <FilterChips label="Content type" options={typeChips} value={typeFilter} onChange={setTypeFilter} />
          </div>

          {someSelected && (
            <form
              onSubmit={handleBulkCategory}
              className="sticky top-[calc(var(--topbar-h)+0.75rem)] z-10 flex flex-wrap items-center gap-3 rounded-card border border-brand/30 bg-surface-raised px-4 py-3 shadow-md"
              aria-label="Bulk actions"
            >
              <span className="text-sm font-medium text-ink">{selected.size} selected</span>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Tag className="size-4 shrink-0 text-ink-faint" />
                <Input
                  placeholder="Category name"
                  aria-label="Category to assign"
                  value={bulkCategory}
                  onChange={e => setBulkCategory(e.target.value)}
                  className="h-(--control-h-sm) max-w-xs"
                />
                <Button type="submit" size="sm" disabled={!bulkCategory.trim()}>Assign category</Button>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear selection</Button>
            </form>
          )}

          <SurfaceBox content={false} className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all shown items" />
                  </TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead className="w-32">Category</TableHead>
                  <TableHead className="w-24 text-right">Views</TableHead>
                  <TableHead className="w-28 text-right">Likes or karma</TableHead>
                  <TableHead className="w-24 text-right">Comments</TableHead>
                  <TableHead className="w-20 text-right">Upvoted</TableHead>
                  <TableHead className="w-28 text-right">Fetched</TableHead>
                  <TableHead className="w-32"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9}>
                      <EmptyState compact icon={<Bookmark />} title="No items match" description="Clear the search or choose a different type or category." />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(item => {
                    const isYT = item.contentType === 'youtube';
                    const isRefreshing = refreshingIds.has(item.id);
                    const title = item.title || item.label || item.url;
                    const engagement = isYT ? item.likeCount : item.score;
                    const comments = isYT ? item.commentCount : item.numComments;
                    return (
                      <TableRow key={item.id} data-state={selected.has(item.id) ? 'selected' : undefined}>
                        <TableCell>
                          <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleOne(item.id)} aria-label={`Select ${title}`} />
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <div className="flex max-w-sm items-start gap-3">
                            {isYT && item.thumbnail ? (
                              <img src={item.thumbnail} alt="" loading="lazy" className="mt-0.5 h-10 w-16 shrink-0 rounded-sm object-cover" />
                            ) : !isYT && item.imageUrl ? (
                              <ImageLightbox src={item.imageUrl} alt={title || 'Reddit post'} className="mt-0.5" />
                            ) : null}
                            <div className="min-w-0">
                              <p className="line-clamp-2 text-sm font-medium leading-snug text-ink">{title}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <PlatformBadge platform={item.contentType || 'reddit'} className="h-5" />
                                <span className="text-caption text-ink-faint">{isYT ? item.channelTitle : item.subredditPrefixed}</span>
                                {item.label && <span className="text-caption text-ink-faint italic">{item.label}</span>}
                                {isYT && item.isShort && <Badge variant="outline">Short</Badge>}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.category ? <Badge variant="secondary">{item.category}</Badge> : <span className="text-ink-faint">-</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {hasTrackedViews(item) ? (
                            <span className="text-ink">{fmtNum(trackedViews(item))}</span>
                          ) : isYT ? (
                            <span className="text-ink-faint">-</span>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger render={<Button variant="ghost" size="xs" onClick={() => openEdit(item)} />}>
                                <Eye />Add
                              </TooltipTrigger>
                              <TooltipContent>Reddit does not report views. Enter them by hand.</TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-ink">{engagement !== undefined ? fmtNum(engagement) : '-'}</TableCell>
                        <TableCell className="text-right text-ink-muted">{comments !== undefined ? fmtNum(comments) : '-'}</TableCell>
                        <TableCell className="text-right text-ink-muted">
                          {!isYT && item.upvoteRatio !== undefined && (item.score ?? 0) >= 10 ? `${Math.round(item.upvoteRatio * 100)}%` : '-'}
                        </TableCell>
                        <TableCell className="text-right text-small text-ink-faint">{item.lastFetchedAt ? fmtDate(item.lastFetchedAt) : '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-0.5">
                            <RowAction label="Refresh live data" onClick={() => handleRefresh(item.id)} disabled={isRefreshing}>
                              <RefreshCw className={cn(isRefreshing && 'animate-spin')} />
                            </RowAction>
                            <RowAction label="Edit" onClick={() => openEdit(item)}><Pencil /></RowAction>
                            <RowAction label="Open original" href={item.permalink || item.url}><ExternalLink /></RowAction>
                            <RowAction label="Stop tracking" onClick={() => setDeleteItem(item)} danger><Trash2 /></RowAction>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </SurfaceBox>
        </>
      )}

      <Dialog open={addOpen} onOpenChange={open => { setAddOpen(open); if (!open) resetAddForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Track content</DialogTitle>
            <DialogDescription>Paste a Reddit post or a YouTube video or Shorts link.</DialogDescription>
          </DialogHeader>
          <form id="track-form" onSubmit={handleAdd} className="flex flex-col gap-5">
            <FieldRow label="Link" htmlFor="track-url">
              <Input id="track-url" className="h-(--control-h-lg)" placeholder="https://" value={addUrl} onChange={e => handleUrlChange(e.target.value)} autoFocus />
              {detectedType ? (
                <p className="flex items-center gap-1.5 text-caption text-success">
                  <PlatformBadge platform={detectedType} className="h-5" />
                  {detectedType === 'youtube' ? 'YouTube video found' : 'Reddit post found'}
                </p>
              ) : addUrl.trim() ? (
                <p className="text-caption text-danger">Error: only Reddit posts and YouTube videos can be tracked.</p>
              ) : null}
            </FieldRow>

            {detectedType === 'reddit' && (
              <FieldRow label="Fetch with account" hint="A session cookie helps Reddit accept requests from the server." htmlFor="track-account">
                <Select
                  value={addAccountId}
                  onValueChange={setAddAccountId}
                  items={[{ value: 'none', label: 'No account (public posts only)' }, ...redditAccounts.map(a => ({ value: a.id, label: `u/${a.username}` }))]}
                >
                  <SelectTrigger id="track-account" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="none">No account (public posts only)</SelectItem>
                      {redditAccounts.map(a => <SelectItem key={a.id} value={a.id}>u/{a.username}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FieldRow>
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldRow label="Label" hint="Optional" htmlFor="track-label">
                <Input id="track-label" placeholder="Launch teaser" value={addLabel} onChange={e => setAddLabel(e.target.value)} />
              </FieldRow>
              <FieldRow label="Category" hint="Optional" htmlFor="track-category">
                <Input id="track-category" placeholder="Campaign A" value={addCategory} onChange={e => setAddCategory(e.target.value)} />
                <CategoryPicker categories={categories} onPick={setAddCategory} />
              </FieldRow>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={adding}>Cancel</Button>
            <Button type="submit" form="track-form" disabled={adding || !addUrl.trim() || !detectedType}>
              {adding && <Spinner className="size-4" />}
              {adding ? 'Fetching details' : 'Track'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={open => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit tracked item</DialogTitle>
            <DialogDescription className="line-clamp-2">{editItem?.title || editItem?.url}</DialogDescription>
          </DialogHeader>
          <form id="edit-tracked-form" onSubmit={handleSaveEdit} className="flex flex-col gap-5">
            <FieldRow label="Label" htmlFor="edit-label">
              <Input id="edit-label" value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="Launch teaser" />
            </FieldRow>
            <FieldRow label="Category" htmlFor="edit-category">
              <Input id="edit-category" value={editCategory} onChange={e => setEditCategory(e.target.value)} placeholder="Campaign A" />
              <CategoryPicker categories={categories} onPick={setEditCategory} />
            </FieldRow>

            {editItem && isRedditItem(editItem) && (
              <FieldRow
                label="Views"
                hint="Reddit does not report views through its API. Copy the number from the post's insights page. Leave empty to remove it."
                htmlFor="edit-views"
              >
                <Input id="edit-views" type="number" min="0" step="1" inputMode="numeric" value={editViews} onChange={e => setEditViews(e.target.value)} placeholder="12500" />
              </FieldRow>
            )}

            {editItem && isRedditItem(editItem) && (
              <FieldRow
                label="Image"
                hint={cloudConfig
                  ? 'Reddit posts have no thumbnail in the public API. Upload a screenshot to recognise the post at a glance.'
                  : 'Image uploads need Cloudinary set up on the server. Check Settings.'}
              >
                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" aria-label="Choose an image" />
                {editImageUrl ? (
                  <div className="flex items-center gap-3 rounded-control border border-line p-2">
                    <ImageLightbox src={editImageUrl} alt={editItem.title || 'Reddit post'} thumbClassName="size-14" />
                    <p className="min-w-0 flex-1 text-caption text-ink-faint">Select the image to view it full size.</p>
                    <Button variant="ghost" size="icon-xs" onClick={() => setEditImageUrl(null)} disabled={uploading} aria-label="Remove image">
                      <X />
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" className="justify-start" onClick={() => imageInputRef.current?.click()} disabled={uploading || !cloudConfig}>
                    {uploading ? <Spinner className="size-4" /> : <Upload data-icon="inline-start" />}
                    {uploading ? 'Uploading image' : 'Upload image'}
                  </Button>
                )}
              </FieldRow>
            )}
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)} disabled={saving}>Cancel</Button>
            <Button type="submit" form="edit-tracked-form" disabled={saving || uploading}>
              {saving && <Spinner className="size-4" />}
              {saving ? 'Saving' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={open => { if (!open) setDeleteItem(null); }}
        title="Stop tracking this content?"
        description={deleteItem ? `"${deleteItem.title || deleteItem.label || deleteItem.url}" and its saved views, image and category are removed from Twiligent. The original post or video is not affected.` : ''}
        confirmLabel="Stop tracking"
        onConfirm={handleDelete}
        busy={deleting}
        hold
      />
    </div>
  );
}
