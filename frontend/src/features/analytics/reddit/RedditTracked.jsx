import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import StatCard from '../../../components/ui/StatCard';
import MainCard from '../../../components/MainCard';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, fmtDate } from '../../../utils/formatters';
import {
  Plus, RefreshCw, Trash2, Pencil, ExternalLink,
  Tag, Bookmark, TrendingUp, BookmarkCheck,
} from 'lucide-react';

export default function RedditTracked() {
  const { accounts, showToast } = useAppContext();
  const redditAccounts = accounts.filter(a => a.platform === 'reddit');

  const [posts,          setPosts]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [addOpen,        setAddOpen]        = useState(false);
  const [editPost,       setEditPost]       = useState(null);
  const [selected,       setSelected]       = useState(new Set());
  const [bulkCategory,   setBulkCategory]   = useState('');
  const [query,          setQuery]          = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sort,           setSort]           = useState('date-desc');
  const [refreshingIds,  setRefreshingIds]  = useState(new Set());

  // Add dialog state
  const [addUrl,       setAddUrl]       = useState('');
  const [addAccountId, setAddAccountId] = useState(redditAccounts[0]?.id ?? 'none');
  const [addLabel,     setAddLabel]     = useState('');
  const [addCategory,  setAddCategory]  = useState('');
  const [adding,       setAdding]       = useState(false);

  // Edit dialog state
  const [editLabel,    setEditLabel]    = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [saving,       setSaving]       = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getTrackedPosts();
      setPosts(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => {
    const seen = new Set(posts.map(p => p.category).filter(Boolean));
    return Array.from(seen).sort();
  }, [posts]);

  const filtered = useMemo(() => {
    let result = posts;
    if (categoryFilter !== 'all') result = result.filter(p => p.category === categoryFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.subreddit || '').toLowerCase().includes(q) ||
        (p.label || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      if (sort === 'score-desc')    return (b.score ?? 0) - (a.score ?? 0);
      if (sort === 'comments-desc') return (b.numComments ?? 0) - (a.numComments ?? 0);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [posts, query, categoryFilter, sort]);

  const totals = useMemo(() => ({
    tracked: posts.length,
    categories: categories.length,
    avgScore: posts.length > 0 ? Math.round(posts.reduce((s, p) => s + (p.score ?? 0), 0) / posts.length) : 0,
  }), [posts, categories]);

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
    if (!addUrl.trim()) { showToast('Paste a Reddit post URL', 'error'); return; }
    setAdding(true);
    try {
      const accountId = addAccountId === 'none' ? null : addAccountId;
      const post = await api.addTrackedPost(addUrl.trim(), accountId, addLabel.trim(), addCategory.trim());
      setPosts(prev => [post, ...prev]);
      setAddOpen(false);
      setAddUrl(''); setAddLabel(''); setAddCategory('');
      showToast('Post is now tracked');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAdding(false);
    }
  }

  function openEdit(post) {
    setEditPost(post);
    setEditLabel(post.label || '');
    setEditCategory(post.category || '');
  }

  async function handleSaveEdit() {
    if (!editPost) return;
    setSaving(true);
    try {
      const updated = await api.updateTrackedPost(editPost.id, { label: editLabel, category: editCategory });
      setPosts(prev => prev.map(p => p.id === editPost.id ? updated : p));
      setEditPost(null);
      showToast('Post updated');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.deleteTrackedPost(id);
      setPosts(prev => prev.filter(p => p.id !== id));
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleRefresh(id) {
    setRefreshingIds(prev => new Set(prev).add(id));
    try {
      const updated = await api.refreshTrackedPost(id);
      setPosts(prev => prev.map(p => p.id === id ? updated : p));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRefreshingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  async function handleBulkCategory() {
    if (!bulkCategory.trim() || selected.size === 0) return;
    try {
      const updates = await Promise.allSettled(
        [...selected].map(id => api.updateTrackedPost(id, { category: bulkCategory.trim() }))
      );
      const succeeded = updates
        .map((r, i) => r.status === 'fulfilled' ? { id: [...selected][i], data: r.value } : null)
        .filter(Boolean);
      setPosts(prev => prev.map(p => {
        const hit = succeeded.find(s => s.id === p.id);
        return hit ? hit.data : p;
      }));
      setSelected(new Set());
      setBulkCategory('');
      showToast(`Category assigned to ${succeeded.length} post${succeeded.length !== 1 ? 's' : ''}`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
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
          <h1 className="text-2xl font-bold tracking-tight">Tracked Posts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor score and comments on specific Reddit posts using your account cookies
          </p>
        </div>
        <Button size="sm" className="gap-2 shrink-0" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Track Post
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<BookmarkCheck />} label="Tracked Posts"  value={totals.tracked}    subtitle="across all categories" gradient="orange" />
        <StatCard icon={<Tag />}           label="Categories"     value={totals.categories}  subtitle={totals.categories === 0 ? 'none assigned yet' : `${totals.categories} group${totals.categories !== 1 ? 's' : ''}`} gradient="blue" />
        <StatCard icon={<TrendingUp />}    label="Avg Score"      value={fmtNum(totals.avgScore)} subtitle="across all tracked posts" gradient="red" />
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
            placeholder="Search posts..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1"
          />
          {categories.length > 0 && (
            <Select
              value={categoryFilter}
              onValueChange={setCategoryFilter}
              items={[{ value: 'all', label: 'All categories' }, ...categories.map(c => ({ value: c, label: c }))]}
            >
              <SelectTrigger className="w-full sm:w-48">
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
              { value: 'date-desc',     label: 'Newest first' },
              { value: 'score-desc',    label: 'Score (high to low)' },
              { value: 'comments-desc', label: 'Comments (most)' },
            ]}
          >
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Newest first</SelectItem>
              <SelectItem value="score-desc">Score (high to low)</SelectItem>
              <SelectItem value="comments-desc">Comments (most)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </MainCard>

      {/* Table */}
      <MainCard content={false}>
        {posts.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 gap-4">
            <div className="h-14 w-14 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Bookmark className="h-7 w-7 text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">No posts tracked yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Paste a Reddit post URL and pick which account cookie to use for fetching
              </p>
            </div>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Track your first post
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Post</TableHead>
                <TableHead className="w-32">Account</TableHead>
                <TableHead className="w-28">Category</TableHead>
                <TableHead className="text-right w-20">Score</TableHead>
                <TableHead className="text-right w-24">Comments</TableHead>
                <TableHead className="text-right w-20">Upvote %</TableHead>
                <TableHead className="text-right w-28">Fetched</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                    No posts match the current filters
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(post => {
                  const acc = accounts.find(a => a.id === post.accountId);
                  const isRefreshing = refreshingIds.has(post.id);
                  return (
                    <TableRow key={post.id} className={selected.has(post.id) ? 'bg-muted/30' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(post.id)}
                          onCheckedChange={() => toggleOne(post.id)}
                          aria-label={`Select ${post.title}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="max-w-sm">
                          <p className="text-sm font-medium leading-snug line-clamp-2">
                            {post.title || post.label || post.url}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {post.subredditPrefixed && (
                              <span className="text-xs text-muted-foreground">{post.subredditPrefixed}</span>
                            )}
                            {post.label && (
                              <span className="text-xs text-muted-foreground italic">{post.label}</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {acc ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-5 w-5 flex-shrink-0">
                              <AvatarImage src={acc.iconUrl} />
                              <AvatarFallback className="bg-orange-500 text-white text-[0.5rem] font-bold">
                                {(acc.username || '?').slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">u/{acc.username}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Public</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {post.category ? (
                          <Badge variant="outline" className="text-xs font-medium">
                            {post.category}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums text-orange-500">
                        {post.score !== undefined ? fmtNum(post.score) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {post.numComments !== undefined ? fmtNum(post.numComments) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {post.upvoteRatio !== undefined && (post.score ?? 0) >= 10
                          ? `${Math.round(post.upvoteRatio * 100)}%`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {post.lastFetchedAt ? fmtDate(post.lastFetchedAt) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => handleRefresh(post.id)}
                            disabled={isRefreshing}
                            title="Refresh live data"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => openEdit(post)}
                            title="Edit label or category"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <a href={post.permalink} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="size-7" title="Open on Reddit">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(post.id)}
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

      {/* Add post dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Track a Reddit post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Post URL</label>
              <Input
                placeholder="https://www.reddit.com/r/.../comments/..."
                value={addUrl}
                onChange={e => setAddUrl(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Paste the full URL of the Reddit post you want to track
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Account cookie</label>
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
                Using a session cookie improves access from datacenter IPs
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Label <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Input placeholder="My post" value={addLabel} onChange={e => setAddLabel(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Category <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Input placeholder="Campaign A" value={addCategory} onChange={e => setAddCategory(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={adding}>Cancel</Button>
            <Button onClick={handleAdd} disabled={adding || !addUrl.trim()}>
              {adding ? 'Fetching...' : 'Track Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editPost} onOpenChange={v => !v && setEditPost(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit tracked post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Label</label>
              <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="My post" />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPost(null)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
