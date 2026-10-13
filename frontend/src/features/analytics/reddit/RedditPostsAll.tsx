import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, TrendingUp, MessageSquare, Award, MessagesSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/PageHeader';
import MetricBox from '@/components/MetricBox';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState } from '@/components/StateViews';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum } from '../../../utils/formatters';
import RedditPostFilters from './RedditPostFilters';
import RedditPostTable from './RedditPostTable';
import { filterAndSortRedditPosts, subredditsOf } from './redditPostUtils';
import type { RedditPostRow } from './redditPostUtils';
import { cn } from '@/lib/utils';

export default function RedditPostsAll() {
  const { accounts, showToast } = useAppContext();
  const redditAccounts = useMemo(() => accounts.filter(a => a.platform === 'reddit'), [accounts]);
  const accountsById = useMemo(() => Object.fromEntries(redditAccounts.map(a => [a.id, a])), [redditAccounts]);

  const [posts, setPosts] = useState<RedditPostRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('score-desc');
  const [accountFilter, setAccountFilter] = useState('all');
  const [subFilter, setSubFilter] = useState('all');

  const loadPosts = useCallback(async () => {
    if (redditAccounts.length === 0) return;
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        redditAccounts.map(acc => api.getRedditPosts(acc.id).then(data => ({ acc, posts: Array.isArray(data) ? data : [] }))),
      );
      const combined: RedditPostRow[] = [];
      results.forEach(r => {
        if (r.status === 'fulfilled') {
          r.value.posts.forEach(post => combined.push({
            ...post,
            accountId: r.value.acc.id,
            accountUsername: r.value.acc.username,
            accountIconUrl: r.value.acc.iconUrl,
          }));
        } else {
          showToast(`Couldn't load posts for one account. ${r.reason?.message || ''}`.trim(), 'error');
        }
      });
      setPosts(combined);
    } finally {
      setLoading(false);
    }
  }, [redditAccounts, showToast]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const subreddits = useMemo(() => subredditsOf(posts), [posts]);
  const filtered = useMemo(
    () => filterAndSortRedditPosts(posts, { query, sort, subreddit: subFilter, accountId: accountFilter }),
    [posts, query, sort, subFilter, accountFilter],
  );
  const totals = useMemo(() => ({
    score: filtered.reduce((s, p) => s + p.score, 0),
    comments: filtered.reduce((s, p) => s + p.numComments, 0),
  }), [filtered]);
  const avg = (n: number) => filtered.length > 0 ? `${fmtNum(Math.round(n / filtered.length))} per post on average` : '';

  if (redditAccounts.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Reddit posts" description="Posts from every connected Reddit account" />
        <SurfaceBox>
          <EmptyState
            icon={<MessagesSquare />}
            title="No Reddit accounts yet"
            description="Connect a Reddit account to see its posts, karma and comments here."
            action={<Button render={<Link to="/accounts?add=1" />}><Plus data-icon="inline-start" />Add an account</Button>}
          />
        </SurfaceBox>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reddit posts"
        description={loading
          ? `Loading posts from ${redditAccounts.length} account${redditAccounts.length === 1 ? '' : 's'}`
          : `${filtered.length} of ${posts.length} posts across ${redditAccounts.length} account${redditAccounts.length === 1 ? '' : 's'}`}
        actions={
          <Button variant="outline" size="sm" onClick={loadPosts} disabled={loading}>
            <RefreshCw data-icon="inline-start" className={cn(loading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-28 rounded-card" />)}
          </div>
          <Skeleton className="h-10 rounded-field" />
          <Skeleton className="h-96 rounded-card" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricBox icon={<TrendingUp />} label="Posts shown" value={fmtNum(filtered.length)} subtitle={`${posts.length} fetched in total`} />
            <MetricBox icon={<Award />} label="Karma" value={fmtNum(totals.score)} subtitle={avg(totals.score)} highlight />
            <MetricBox icon={<MessageSquare />} label="Comments" value={fmtNum(totals.comments)} subtitle={avg(totals.comments)} />
          </div>

          <RedditPostFilters
            query={query} onQuery={setQuery}
            sort={sort} onSort={setSort}
            subreddit={subFilter} onSubreddit={setSubFilter} subreddits={subreddits}
            accountId={accountFilter} onAccount={setAccountFilter} accounts={redditAccounts}
          />

          <RedditPostTable posts={filtered} showAccount={redditAccounts.length > 1} accountsById={accountsById} />
        </>
      )}
    </div>
  );
}
