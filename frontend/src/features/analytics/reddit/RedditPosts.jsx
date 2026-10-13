import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { UserX } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/PageHeader';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState } from '@/components/StateViews';
import { AccountAvatar } from '@/components/platform';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import RedditPostFilters from './RedditPostFilters';
import RedditPostTable from './RedditPostTable';
import { filterAndSortRedditPosts, subredditsOf } from './redditPostUtils';

export default function RedditPosts() {
  const { id } = useParams();
  const { accounts, showToast } = useAppContext();
  const account = accounts.find(a => a.id === id);

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('score-desc');
  const [subFilter, setSubFilter] = useState('all');

  useEffect(() => {
    if (!account) return;
    setLoading(true);
    api.getRedditPosts(account.id)
      .then(data => setPosts(Array.isArray(data) ? data : []))
      .catch(err => showToast(`Couldn't load posts. ${err.message}`, 'error'))
      .finally(() => setLoading(false));
    // reload per route, not per account list refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const subreddits = useMemo(() => subredditsOf(posts), [posts]);
  const filtered = useMemo(
    () => filterAndSortRedditPosts(posts, { query, sort, subreddit: subFilter }),
    [posts, query, sort, subFilter],
  );

  if (!account) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Reddit posts" back={{ to: '/reddit-posts', label: 'All Reddit posts' }} />
        <SurfaceBox>
          <EmptyState icon={<UserX />} title="Account not found" description="It may have been removed. Choose another account from the sidebar." />
        </SurfaceBox>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ to: `/reddit/${account.id}`, label: `u/${account.username} analytics` }}
        media={<AccountAvatar account={account} size="lg" />}
        title={`Posts by u/${account.username}`}
        description={loading ? 'Loading posts' : `${filtered.length} of ${posts.length} posts`}
      />

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 rounded-field" />
          <Skeleton className="h-96 rounded-card" />
        </div>
      ) : (
        <>
          <RedditPostFilters
            query={query} onQuery={setQuery}
            sort={sort} onSort={setSort}
            subreddit={subFilter} onSubreddit={setSubFilter} subreddits={subreddits}
          />
          <RedditPostTable posts={filtered} />
        </>
      )}
    </div>
  );
}
