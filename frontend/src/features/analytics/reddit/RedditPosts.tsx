import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { UserX } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/PageHeader';
import SurfaceBox from '@/components/SurfaceBox';
import Pager from '@/components/Pager';
import RefreshButton from '@/components/RefreshButton';
import DataFreshness from '@/components/DataFreshness';
import ActiveFilters from '@/components/ActiveFilters';
import NoResults from '@/components/NoResults';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { AccountAvatar } from '@/components/platform';
import { accountName } from '@/lib/accounts';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { pageSlice, resultCountLabel } from '@/lib/library';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import type { AppAccount } from '../../../utils/formatters';
import { useLibrarySources } from '../useLibrarySources';
import { useLibraryParams } from '../useLibraryParams';
import RedditPostFilters from './RedditPostFilters';
import RedditPostTable from './RedditPostTable';
import { filterAndSortRedditPosts, mergeAccountPosts, redditSortOf, subredditsOf } from './redditPostUtils';

const ITEMS_PER_PAGE = 25;
const RESULTS_ID = 'account-reddit-results';

const DEFAULTS = { q: '', subreddit: 'all', sort: 'score-desc' };

function fetchAccountPosts(id: string, fresh: boolean) {
  return api.getRedditAnalytics(id, fresh);
}

function nameOf(account: AppAccount): string {
  return accountName(account);
}

export default function RedditPosts() {
  const { id } = useParams();
  const { accounts } = useAppContext();
  const account = accounts.find(item => item.id === id);
  const sources = useMemo(() => (account ? [account] : []), [account]);
  const library = useLibrarySources(sources, fetchAccountPosts, nameOf, 'Reddit posts');
  const posts = useMemo(() => mergeAccountPosts(library.sources, library.results), [library.sources, library.results]);
  const { values, page, update, clear, setPage } = useLibraryParams(DEFAULTS);
  const sort = redditSortOf(values.sort);
  useDocumentTitle(account ? `Posts by u/${account.username}` : null);

  const subreddits = useMemo(() => subredditsOf(posts), [posts]);
  const filtered = useMemo(
    () => filterAndSortRedditPosts(posts, { query: values.q, sort, subreddit: values.subreddit }),
    [posts, values.q, sort, values.subreddit],
  );
  const paged = pageSlice(filtered, page, ITEMS_PER_PAGE);
  const clearFilters = () => clear(['q', 'subreddit']);
  const activeFilters = [
    values.q && { key: 'q', label: `"${values.q}"`, onRemove: () => update({ q: '' }) },
    values.subreddit !== 'all' && { key: 'subreddit', label: `r/${values.subreddit}`, onRemove: () => update({ subreddit: 'all' }) },
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

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

  const loading = library.initialLoading;
  const failure = library.failures[0];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ to: `/reddit/${account.id}`, label: `u/${account.username} analytics` }}
        media={<AccountAvatar account={account} size="lg" decorative />}
        title={`Posts by u/${account.username}`}
        description={
          <span className="flex flex-col gap-1">
            <span>{loading ? 'Loading posts' : `${posts.length} posts loaded`}</span>
            {!loading && <DataFreshness fetchedAt={library.fetchedAt} />}
          </span>
        }
        actions={<RefreshButton refreshing={library.refreshing} onRefresh={library.refresh} disabled={loading} />}
      />

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 rounded-field" />
          <Skeleton className="h-96 rounded-card" />
        </div>
      ) : failure && posts.length === 0 ? (
        <SurfaceBox>
          <ErrorState title="These posts could not load" description={failure.message} onRetry={library.refresh} />
        </SurfaceBox>
      ) : (
        <>
          <RedditPostFilters
            query={values.q} onQuery={value => update({ q: value }, { replace: true })}
            sort={sort} onSort={value => update({ sort: value })}
            subreddit={values.subreddit} onSubreddit={value => update({ subreddit: value })} subreddits={subreddits}
          />
          <ActiveFilters countLabel={resultCountLabel(filtered.length, posts.length, 'posts')} filters={activeFilters} onClearAll={clearFilters} />
          <div id={RESULTS_ID} tabIndex={-1} className="outline-none" aria-busy={library.refreshing}>
            {posts.length === 0 ? (
              <SurfaceBox><EmptyState compact icon={<UserX />} title="No posts yet" description={`u/${account.username} has not submitted any posts Reddit lets Twiligent read.`} /></SurfaceBox>
            ) : filtered.length === 0 ? (
              <SurfaceBox><NoResults noun="posts" query={values.q} onClear={clearFilters} /></SurfaceBox>
            ) : (
              <RedditPostTable posts={paged.items} offset={paged.offset} />
            )}
          </div>
          <Pager
            page={paged.page}
            pageCount={paged.pageCount}
            onPageChange={setPage}
            total={filtered.length}
            shown={paged.items.length}
            pageSize={ITEMS_PER_PAGE}
            noun="posts"
            resultsId={RESULTS_ID}
          />
        </>
      )}
    </div>
  );
}
