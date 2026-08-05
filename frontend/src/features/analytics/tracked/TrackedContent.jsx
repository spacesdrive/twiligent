import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import StatCard from '../../../components/ui/StatCard';
import MainCard from '../../../components/MainCard';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, fmtDate } from '../../../utils/formatters';
import { trackedViews, hasTrackedViews } from '../../../utils/trackedContent';
import {
  Plus, RefreshCw, Trash2, Pencil, ExternalLink,
  Tag, Bookmark, BookmarkCheck, CirclePlay, Flame, Eye,
} from 'lucide-react';

function detectContentType(url) {
  const lower = (url || '').toLowerCase();
  if (lower.includes('reddit.com') || lower.includes('redd.it')) return 'reddit';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  return null;
}

function getEngagement(item) {
  if (item.contentType === 'youtube') return item.likeCount ?? 0;
  return item.score ?? 0;
}

function getComments(item) {
  if (item.contentType === 'youtube') return item.commentCount ?? 0;
  return item.numComments ?? 0;
}

function isRedditItem(item) {
  return (item?.contentType || 'reddit') === 'reddit';
}

function ContentTypeBadge({ type }) {
  if (type === 'youtube') {
    return (
      <Badge variant="outline" className="text-[10px] border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400 gap-1 px-1.5 py-0">
        <CirclePlay className="h-2.5 w-2.5" />
        YouTube
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-400 gap-1 px-1.5 py-0">
      <Flame className="h-2.5 w-2.5" />
      Reddit
    </Badge>
  );
}

export default function TrackedContent() {
  const { accounts, showToast } = useAppContext();
  const redditAccounts = accounts.filter(a => a.platform === 'reddit');

  const [items,          setItems]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [addOpen,        setAddOpen]        = useState(false);
  const [editItem,       setEditItem]       = useState(null);
  const [selected,       setSelected]       = useState(new Set());
  const [bulkCategory,   setBulkCategory]   = useState('');
  const [query,          setQuery]          = useState('');
  const [typeFilter,     setTypeFilter]     = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sort,           setSort]           = useState('date-desc');
  const [refreshingIds,  setRefreshingIds]  = useState(new Set());

  // Add dialog state
  const [addUrl,       setAddUrl]       = useState('');
  const [detectedType, setDetectedType] = useState(null);
  const [addAccountId, setAddAccountId] = useState(redditAccounts[0]?.id ?? 'none');
  const [addLabel,     setAddLabel]     = useState('');
  const [addCategory,  setAddCategory]  = useState('');
  const [adding,       setAdding]       = useState(false);

  // Edit dialog state
  const [editLabel,    setEditLabel]    = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editViews,    setEditViews]    = useState('');
  const [saving,       setSaving]       = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getTrackedContent();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function handleUrlChange(val) {
    setAddUrl(val);
    setDetectedType(detectContentType(val));
  }

  const categories = useMemo(() => {
    const seen = new Set(items.map(p => p.category).filter(Boolean));
    return Array.from(seen).sort();
  }, [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (typeFilter !== 'all') result = result.filter(p => (p.contentType || 'reddit') === typeFilter);
    if (categoryFilter !== 'all') result = result.filter(p => p.category === categoryFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.subreddit || '').toLowerCase().includes(q) ||
        (p.channelTitle || '').toLowerCase().includes(q) ||
        (p.label || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      if (sort === 'engagement-desc') return getEngagement(b) - getEngagement(a);
      if (sort === 'comments-desc')   return getComments(b) - getComments(a);
      if (sort === 'views-desc')      return trackedViews(b) - trackedViews(a);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [items, query, typeFilter, categoryFilter, sort]);

  const stats = useMemo(() => {
    const ytItems = items.filter(p => p.contentType === 'youtube');
    const rdItems = items.filter(p => (p.contentType || 'reddit') === 'reddit');
    return {
      total: items.length,
      categories: categories.length,
      youtube: ytItems.length,
      reddit: rdItems.length,
    };
  }, [items, categories]);

  const allSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(prev => { const n = new Set(prev); filtered.forEach(p => n.delete(p.id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); filtered.forEach(p => n.add(p.id)); return n; });
    }
  }

  function toggleOne(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function handleAdd() {
    if (!addUrl.trim()) { showToast('Paste a URL to track', 'error'); return; }
    const type = detectContentType(addUrl.trim());
    if (!type) { showToast('Only Reddit and YouTube URLs are supported', 'error'); return; }
    setAdding(true);
    try {
      const accountId = (type === 'reddit' && addAccountId !== 'none') ? addAccountId : null;
      const item = await api.addTrackedContent(addUrl.trim(), accountId, addLabel.trim(), addCategory.trim());
      setItems(prev => [item, ...prev]);
      setAddOpen(false);
      setAddUrl(''); setDetectedType(null); setAddLabel(''); setAddCategory('');
      showToast('Content is now tracked');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAdding(false);
    }
  }

  function openEdit(item) {
    setEditItem(item);
    setEditLabel(item.label || '');
    setEditCategory(item.category || '');
    setEditViews(item.manualViews != null ? String(item.manualViews) : '');
  }

  async function handleSaveEdit() {
    if (!editItem) return;

    const updates = { label: editLabel, category: editCategory };

    if (isRedditItem(editItem)) {
      const raw = editViews.trim();
      if (raw === '') {
        updates.manualViews = null;
      } else {
        const views = Number(raw);
        if (!Number.isInteger(views) || views < 0) {
          showToast('Views must be a whole number of 0 or more', 'error');
          return;
        }
        updates.manualViews = views;
      }
    }

    setSaving(true);
    try {
      const updated = await api.updateTrackedContent(editItem.id, updates);
      setItems(prev => prev.map(p => p.id === editItem.id ? updated : p));
      setEditItem(null);
      showToast('Updated');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.deleteTrackedContent(id);
      setItems(prev => prev.filter(p => p.id !== id));
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleRefresh(id) {
    setRefreshingIds(prev => new Set(prev).add(id));
    try {
      const updated = await api.refreshTrackedContent(id);
      setItems(prev => prev.map(p => p.id === id ? updated : p));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRefreshingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  async function handleBulkCategory() {
    if (!bulkCategory.trim() || selected.size === 0) return;
    try {
      const results = await Promise.allSettled(
        [...selected].map(id => api.updateTrackedContent(id, { category: bulkCategory.trim() }))
      );
      const succeeded = results
        .map((r, i) => r.status === 'fulfilled' ? { id: [...selected][i], data: r.value } : null)
        .filter(Boolean);
      setItems(prev => prev.map(p => {
        const hit = succeeded.find(s => s.id === p.id);
        return hit ? hit.data : p;
      }));
      setSelected(new Set());
      setBulkCategory('');
      showToast(`Category assigned to ${succeeded.length} item${succeeded.length !== 1 ? 's' : ''}`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tracked Content</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor Reddit posts and YouTube videos - track karma, likes, and comments over time
          </p>
        </div>
        <Button size="sm" className="gap-2 shrink-0" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Track Content
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={<BookmarkCheck />} label="Tracked Content" value={stats.total}    subtitle="across all categories" gradient="orange" />
        <StatCard icon={<Tag />}           label="Categories"      value={stats.categories} subtitle={stats.categories === 0 ? 'none assigned yet' : `${stats.categories} group${stats.categories !== 1 ? 's' : ''}`} gradient="blue" />
        <StatCard icon={<CirclePlay />}       label="YouTube"         value={stats.youtube}  subtitle={stats.youtube === 0 ? 'no videos tracked' : `video${stats.youtube !== 1 ? 's' : ''} tracked`} gradient="red" />
        <StatCard icon={<Flame />}         label="Reddit"          value={stats.reddit}   subtitle={stats.reddit === 0 ? 'no posts tracked' : `post${stats.reddit !== 1 ? 's' : ''} tracked`} gradient="purple" />
      </div>

      {/* Bulk category bar */}
      {someSelected && (
        <MainCard>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">{selected.size} selected</span>
            <div className="flex-1 flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Category name"
                value={bulkCategory}
                onChange={e => setBulkCategory(e.target.value)}
                className="h-8 max-w-xs"
                onKeyDown={e => e.key === 'Enter' && handleBulkCategory()}
              />
              <Button size="sm" onClick={handleBulkCategory} disabled={!bulkCategory.trim()}>
                Assign
              </Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </MainCard>
      )}

      {/* Filters */}
      <MainCard>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Search by title, channel, subreddit..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1"
          />
          <Select
            value={typeFilter}
            onValueChange={setTypeFilter}
            items={[
              { value: 'all', label: 'All types' },
              { value: 'reddit', label: 'Reddit posts' },
              { value: 'youtube', label: 'YouTube videos' },
            ]}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="reddit">Reddit posts</SelectItem>
              <SelectItem value="youtube">YouTube videos</SelectItem>
            </SelectContent>
          </Select>
          {categories.length > 0 && (
            <Select
              value={categoryFilter}
              onValueChange={setCategoryFilter}
              items={[{ value: 'all', label: 'All categories' }, ...categories.map(c => ({ value: c, label: c }))]}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select
            value={sort}
            onValueChange={setSort}
            items={[
              { value: 'date-desc',        label: 'Newest first' },
              { value: 'engagement-desc',  label: 'Likes / Karma' },
              { value: 'comments-desc',    label: 'Most comments' },
              { value: 'views-desc',       label: 'Most views' },
            ]}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Newest first</SelectItem>
              <SelectItem value="engagement-desc">Likes / Karma</SelectItem>
              <SelectItem value="comments-desc">Most comments</SelectItem>
              <SelectItem value="views-desc">Most views (YouTube)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </MainCard>

      {/* Table */}
      <MainCard content={false}>
        {items.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Bookmark className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">No content tracked yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Paste a Reddit post URL or a YouTube video URL to start tracking
              </p>
            </div>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Track your first item
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-28">Category</TableHead>
                <TableHead className="text-right w-24">Views</TableHead>
                <TableHead className="text-right w-24">Likes / Karma</TableHead>
                <TableHead className="text-right w-24">Comments</TableHead>
                <TableHead className="text-right w-20">Ratio</TableHead>
                <TableHead className="text-right w-28">Fetched</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                    No items match the current filters
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(item => {
                  const isYT = item.contentType === 'youtube';
                  const isRefreshing = refreshingIds.has(item.id);
                  return (
                    <TableRow key={item.id} className={selected.has(item.id) ? 'bg-muted/30' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(item.id)}
                          onCheckedChange={() => toggleOne(item.id)}
                          aria-label={`Select ${item.title}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="max-w-sm flex items-start gap-2.5">
                          {isYT && item.thumbnail ? (
                            <img src={item.thumbnail} alt="" className="h-10 w-16 rounded object-cover flex-shrink-0 mt-0.5" />
                          ) : null}
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-snug line-clamp-2">
                              {item.title || item.label || item.url}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <ContentTypeBadge type={item.contentType || 'reddit'} />
                              {isYT ? (
                                item.channelTitle && (
                                  <span className="text-xs text-muted-foreground">{item.channelTitle}</span>
                                )
                              ) : (
                                item.subredditPrefixed && (
                                  <span className="text-xs text-muted-foreground">{item.subredditPrefixed}</span>
                                )
                              )}
                              {item.label && (
                                <span className="text-xs text-muted-foreground italic">{item.label}</span>
                              )}
                              {isYT && item.isShort && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Short</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.category ? (
                          <Badge variant="outline" className="text-xs font-medium">{item.category}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {hasTrackedViews(item) ? (
                          <span className={isYT ? '' : 'text-foreground'}>{fmtNum(trackedViews(item))}</span>
                        ) : isYT ? (
                          '-'
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-xs font-normal text-muted-foreground gap-1"
                            onClick={() => openEdit(item)}
                            title="Reddit does not report views - enter them manually"
                          >
                            <Eye className="h-3 w-3" />
                            Set
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">
                        {isYT
                          ? (item.likeCount !== undefined ? (
                            <span className="text-red-500">{fmtNum(item.likeCount)}</span>
                          ) : '-')
                          : (item.score !== undefined ? (
                            <span className="text-orange-500">{fmtNum(item.score)}</span>
                          ) : '-')
                        }
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {isYT
                          ? (item.commentCount !== undefined ? fmtNum(item.commentCount) : '-')
                          : (item.numComments !== undefined ? fmtNum(item.numComments) : '-')
                        }
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {!isYT && item.upvoteRatio !== undefined && (item.score ?? 0) >= 10
                          ? `${Math.round(item.upvoteRatio * 100)}%`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {item.lastFetchedAt ? fmtDate(item.lastFetchedAt) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5 justify-end">
                          <Button
                            variant="ghost" size="icon" className="size-7"
                            onClick={() => handleRefresh(item.id)}
                            disabled={isRefreshing}
                            title="Refresh live data"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="size-7"
                            onClick={() => openEdit(item)}
                            title="Edit label or category"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <a href={item.permalink || item.url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="size-7" title="Open original">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                          <Button
                            variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(item.id)}
                            title="Stop tracking"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </MainCard>

      {/* Add content dialog */}
      <Dialog open={addOpen} onOpenChange={v => { setAddOpen(v); if (!v) { setAddUrl(''); setDetectedType(null); setAddLabel(''); setAddCategory(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Track Content</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">URL</label>
              <div className="relative">
                <Input
                  placeholder="Reddit post or YouTube video URL"
                  value={addUrl}
                  onChange={e => handleUrlChange(e.target.value)}
                  autoFocus
                />
              </div>
              {detectedType ? (
                <div className="flex items-center gap-1.5">
                  <ContentTypeBadge type={detectedType} />
                  <span className="text-xs text-muted-foreground">
                    {detectedType === 'youtube' ? 'YouTube video detected' : 'Reddit post detected'}
                  </span>
                </div>
              ) : addUrl.trim() ? (
                <p className="text-xs text-destructive">Only Reddit and YouTube URLs are supported</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Paste a Reddit post URL or a YouTube video / Shorts URL
                </p>
              )}
            </div>

            {detectedType === 'reddit' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Account cookie <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Select
                  value={addAccountId}
                  onValueChange={setAddAccountId}
                  items={[
                    { value: 'none', label: 'No cookie (public posts only)' },
                    ...redditAccounts.map(a => ({ value: a.id, label: `u/${a.username}` })),
                  ]}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No cookie (public posts only)</SelectItem>
                    {redditAccounts.map(a => (
                      <SelectItem key={a.id} value={a.id} textValue={`u/${a.username}`}>
                        u/{a.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  A session cookie improves access from datacenter IPs
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Label <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Input placeholder="My content" value={addLabel} onChange={e => setAddLabel(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Category <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Input placeholder="Campaign A" value={addCategory} onChange={e => setAddCategory(e.target.value)} />
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {categories.map(c => (
                      <button
                        key={c}
                        onClick={() => setAddCategory(c)}
                        className="text-[10px] px-2 py-0.5 rounded-full border border-border hover:bg-muted transition-colors"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={adding}>Cancel</Button>
            <Button onClick={handleAdd} disabled={adding || !addUrl.trim() || !detectedType}>
              {adding ? 'Fetching...' : 'Track'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={v => !v && setEditItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit tracked item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Label</label>
              <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="My content" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Category</label>
              <Input value={editCategory} onChange={e => setEditCategory(e.target.value)} placeholder="Campaign A" />
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {categories.map(c => (
                    <button
                      key={c}
                      onClick={() => setEditCategory(c)}
                      className="text-xs px-2 py-0.5 rounded-full border border-border hover:bg-muted transition-colors"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {editItem && isRedditItem(editItem) && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Views <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={editViews}
                  onChange={e => setEditViews(e.target.value)}
                  placeholder="e.g. 12500"
                />
                <p className="text-xs text-muted-foreground">
                  Reddit does not report view counts through its API. Copy the number from the post
                  insights page to include it in your totals. Leave empty to remove it.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
