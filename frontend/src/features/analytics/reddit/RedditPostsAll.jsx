import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Spinner } from '@/components/ui/spinner';
import StatCard from '../../../components/ui/StatCard';
import MainCard from '../../../components/MainCard';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, fmtDate } from '../../../utils/formatters';
import {
  Search, ExternalLink, TrendingUp, MessageSquare, FileText,
  Image, Video, Link2, Award, RefreshCw,
} from 'lucide-react';

const MEDIA_TYPE_LABELS = { text: 'Text', image: 'Image', video: 'Video', link: 'Link' };
const SORT_OPTIONS = [
  { value: 'score-desc',    label: 'Score (high to low)' },
  { value: 'score-asc',     label: 'Score (low to high)' },
  { value: 'comments-desc', label: 'Comments (most)' },
  { value: 'date-desc',     label: 'Newest first' },
  { value: 'date-asc',      label: 'Oldest first' },
];

function MediaTypeIcon({ type }) {
  const props = { className: 'h-3.5 w-3.5' };
  if (type === 'image') return <Image {...props} />;
  if (type === 'video') return <Video {...props} />;
  if (type === 'link')  return <Link2 {...props} />;
  return <FileText {...props} />;
}

export default function RedditPostsAll() {
  const { accounts, showToast } = useAppContext();
  const navigate = useNavigate();

  const redditAccounts = accounts.filter(a => a.platform === 'reddit');

  const [posts,      setPosts]      = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query,      setQuery]      = useState('');
  const [sort,       setSort]       = useState('score-desc');
  const [accountFilter, setAccountFilter] = useState('all');
  const [subFilter,  setSubFilter]  = useState('all');

  const loadPosts = async () => {
    if (redditAccounts.length === 0) return;
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        redditAccounts.map(acc => api.getRedditPosts(acc.id).then(data => ({
          accountId: acc.id,
          username: acc.username,
          iconUrl: acc.iconUrl,
          posts: Array.isArray(data) ? data : [],
        })))
      );
      const combined = [];
      results.forEach(r => {
        if (r.status === 'fulfilled') {
          r.value.posts.forEach(post => combined.push({
            ...post,
            accountId: r.value.accountId,
            accountUsername: r.value.username,
            accountIconUrl: r.value.iconUrl,
          }));
        } else {
          showToast('Failed to load posts for one account: ' + r.reason?.message, 'error');
        }
      });
      setPosts(combined);
    } catch (err) {
      showToast('Failed to load Reddit posts: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPosts(); }, [redditAccounts.length]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const subreddits = useMemo(() => {
    const seen = new Set();
    posts.forEach(p => seen.add(p.subreddit));
    return Array.from(seen).sort();
  }, [posts]);

  const filtered = useMemo(() => {
    let result = posts;
    if (accountFilter !== 'all') result = result.filter(p => p.accountId === accountFilter);
    if (subFilter !== 'all')     result = result.filter(p => p.subreddit === subFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.subreddit.toLowerCase().includes(q) ||
        (p.flair || '').toLowerCase().includes(q) ||
        p.accountUsername.toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      if (sort === 'score-desc')    return b.score - a.score;
      if (sort === 'score-asc')     return a.score - b.score;
      if (sort === 'comments-desc') return b.numComments - a.numComments;
      if (sort === 'date-desc')     return new Date(b.createdAt) - new Date(a.createdAt);
      if (sort === 'date-asc')      return new Date(a.createdAt) - new Date(b.createdAt);
      return 0;
    });
  }, [posts, query, sort, accountFilter, subFilter]);

  const totals = useMemo(() => ({
    posts: filtered.length,
    score: filtered.reduce((s, p) => s + p.score, 0),
    comments: filtered.reduce((s, p) => s + p.numComments, 0),
  }), [filtered]);

  if (redditAccounts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reddit Posts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Posts from all connected Reddit accounts</p>
        </div>
        <MainCard>
          <div className="flex flex-col items-center text-center py-12 gap-4">
            <p className="text-sm text-muted-foreground">No Reddit accounts connected.</p>
            <Button onClick={() => navigate('/accounts')}>Add Reddit Account</Button>
          </div>
        </MainCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reddit Posts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? 'Loading...' : `${filtered.length} of ${posts.length} posts across ${redditAccounts.length} account${redditAccounts.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={handleRefresh}
          disabled={loading || refreshing}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="size-10" />
            <p className="text-sm text-muted-foreground">Loading posts from {redditAccounts.length} account{redditAccounts.length !== 1 ? 's' : ''}...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={<TrendingUp />}    label="Posts Shown"    value={fmtNum(totals.posts)}    subtitle={`${posts.length} total fetched`} gradient="orange" />
            <StatCard icon={<Award />}         label="Combined Score" value={fmtNum(totals.score)}    subtitle={filtered.length > 0 ? `Avg ${fmtNum(Math.round(totals.score / filtered.length))} per post` : ''} gradient="red" />
            <StatCard icon={<MessageSquare />} label="Total Comments" value={fmtNum(totals.comments)} subtitle={filtered.length > 0 ? `Avg ${fmtNum(Math.round(totals.comments / filtered.length))} per post` : ''} gradient="blue" />
          </div>

          {/* Filters */}
          <MainCard>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search posts..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {redditAccounts.length > 1 && (
                <Select
                  value={accountFilter}
                  onValueChange={setAccountFilter}
                  items={[
                    { value: 'all', label: 'All accounts' },
                    ...redditAccounts.map(a => ({ value: a.id, label: `u/${a.username}` })),
                  ]}
                >
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="All accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All accounts</SelectItem>
                    {redditAccounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>u/{a.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select
                value={subFilter}
                onValueChange={setSubFilter}
                items={[
                  { value: 'all', label: 'All subreddits' },
                  ...subreddits.map(s => ({ value: s, label: `r/${s}` })),
                ]}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="All subreddits" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subreddits</SelectItem>
                  {subreddits.map(s => (
                    <SelectItem key={s} value={s}>r/{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sort} onValueChange={setSort} items={SORT_OPTIONS}>
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </MainCard>

          {/* Posts table */}
          <MainCard content={false}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Post</TableHead>
                  {redditAccounts.length > 1 && <TableHead className="w-36">Account</TableHead>}
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead className="text-right w-24">Score</TableHead>
                  <TableHead className="text-right w-28">Comments</TableHead>
                  <TableHead className="text-right w-20">Upvote %</TableHead>
                  <TableHead className="text-right w-28">Date</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={redditAccounts.length > 1 ? 9 : 8} className="text-center text-muted-foreground py-12">
                      No posts match the current filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((post, i) => (
                    <TableRow key={`${post.accountId}-${post.id}`}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          <p className="text-sm font-medium leading-snug line-clamp-2">{post.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{post.subredditPrefixed}</span>
                            {post.flair && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                {post.flair}
                              </Badge>
                            )}
                            {post.isNsfw && (
                              <Badge className="text-[10px] px-1 py-0 h-4 bg-red-100 text-red-700 border-red-200">
                                NSFW
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      {redditAccounts.length > 1 && (
                        <TableCell>
                          <button
                            onClick={() => navigate(`/reddit/${post.accountId}`)}
                            className="flex items-center gap-1.5 hover:underline"
                          >
                            <Avatar className="h-5 w-5 flex-shrink-0">
                              <AvatarImage src={post.accountIconUrl} />
                              <AvatarFallback className="bg-orange-500 text-white text-[0.5rem] font-bold">
                                {(post.accountUsername || '?').slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs">u/{post.accountUsername}</span>
                          </button>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MediaTypeIcon type={post.mediaType} />
                          <span>{MEDIA_TYPE_LABELS[post.mediaType] || post.mediaType}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums text-orange-500">
                        {fmtNum(post.score)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{fmtNum(post.numComments)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {Math.round((post.upvoteRatio ?? 0) * 100)}%
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {fmtDate(post.createdAt)}
                      </TableCell>
                      <TableCell>
                        <a href={post.permalink} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="size-7">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </MainCard>
        </>
      )}
    </div>
  );
}
