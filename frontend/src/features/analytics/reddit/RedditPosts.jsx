import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Spinner } from '@/components/ui/spinner';
import MainCard from '../../../components/MainCard';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, fmtDate } from '../../../utils/formatters';
import { ArrowLeft, Search, ExternalLink, TrendingUp, MessageSquare, FileText, Image, Video, Link2 } from 'lucide-react';

const MEDIA_TYPE_LABELS = { text: 'Text', image: 'Image', video: 'Video', link: 'Link' };
const SORT_OPTIONS = [
  { value: 'score-desc',    label: 'Karma (high to low)' },
  { value: 'score-asc',     label: 'Karma (low to high)' },
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

export default function RedditPosts() {
  const { id } = useParams();
  const { accounts, showToast } = useAppContext();
  const navigate = useNavigate();
  const account = accounts.find(a => a.id === id);

  const [loading,  setLoading]  = useState(true);
  const [posts,    setPosts]    = useState([]);
  const [query,    setQuery]    = useState('');
  const [sort,     setSort]     = useState('score-desc');
  const [subFilter, setSubFilter] = useState('all');

  useEffect(() => {
    if (!account) return;
    setLoading(true);
    api.getRedditPosts(account.id)
      .then(data => setPosts(Array.isArray(data) ? data : []))
      .catch(err => showToast('Failed to load posts: ' + err.message, 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  const subreddits = useMemo(() => {
    const seen = new Set();
    posts.forEach(p => seen.add(p.subreddit));
    return ['all', ...Array.from(seen).sort()];
  }, [posts]);

  const filtered = useMemo(() => {
    let result = posts;
    if (subFilter !== 'all') result = result.filter(p => p.subreddit === subFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.subreddit.toLowerCase().includes(q) ||
        (p.flair || '').toLowerCase().includes(q)
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
  }, [posts, query, sort, subFilter]);

  if (!account) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" onClick={() => navigate('/')} className="gap-2 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <p className="text-muted-foreground">Account not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" onClick={() => navigate(`/reddit/${account.id}`)} className="gap-2 -ml-2 text-muted-foreground mb-2">
            <ArrowLeft className="h-4 w-4" /> Back to Analytics
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Posts - u/{account.username}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? 'Loading...' : `${filtered.length} of ${posts.length} posts`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="size-10" />
            <p className="text-sm text-muted-foreground">Loading posts...</p>
          </div>
        </div>
      ) : (
        <>
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
              <Select value={subFilter} onValueChange={setSubFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="All subreddits" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subreddits</SelectItem>
                  {subreddits.filter(s => s !== 'all').map(s => (
                    <SelectItem key={s} value={s}>r/{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={setSort}>
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
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead className="text-right w-24">Karma</TableHead>
                  <TableHead className="text-right w-28">Comments</TableHead>
                  <TableHead className="text-right w-20">Upvote %</TableHead>
                  <TableHead className="text-right w-28">Date</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      No posts match the current filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((post, i) => (
                    <TableRow key={post.id}>
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
