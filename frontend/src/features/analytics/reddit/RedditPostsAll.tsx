import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/PageHeader';
import MetricBox from '@/components/MetricBox';
import Num from '@/components/Num';
import SurfaceBox from '@/components/SurfaceBox';
import Pager from '@/components/Pager';
import RefreshButton from '@/components/RefreshButton';
import DataFreshness from '@/components/DataFreshness';
import ActiveFilters from '@/components/ActiveFilters';
import NoResults from '@/components/NoResults';
import FailedSourcesAlert from '@/components/FailedSourcesAlert';
import { EmptyState } from '@/components/StateViews';
import { accountName } from '@/lib/accounts';
import { pageSlice, resultCountLabel } from '@/lib/library';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum } from '../../../utils/formatters';
import type { AppAccount } from '../../../utils/formatters';
import { useLibrarySources } from '../useLibrarySources';
import { useLibraryParams } from '../useLibraryParams';
import RedditPostFilters from './RedditPostFilters';
import RedditPostTable from './RedditPostTable';
import { filterAndSortRedditPosts, mergeAccountPosts, redditSortOf, subredditsOf } from './redditPostUtils';

const ITEMS_PER_PAGE = 25;
const RESULTS_ID = 'reddit-results';

const DEFAULTS = { q: '', account: 'all', subreddit: 'all', sort: 'score-desc' };

const { redditPosts: Posts, karma: Karma, comments: Comments } = METRIC_ICONS;

// the analytics read carries the posts and the time they were fetched, so the page can say how old they are
function fetchAccountPosts(id: string, fresh: boolean) {
  return api.getRedditAnalytics(id, fresh);
}

function nameOf(account: AppAccount): string {
  return accountName(account);
}

export default function RedditPostsAll() {
  const { accounts } = useAppContext();
  const redditAccounts = useMemo(() => accounts.filter(account => account.platform === 'reddit'), [accounts]);
  const accountsById = useMemo(() => Object.fromEntries(redditAccounts.map(account => [account.id, account])), [redditAccounts]);
  const library = useLibrarySources(redditAccounts, fetchAccountPosts, nameOf, 'Reddit posts');
  const posts = useMemo(() => mergeAccountPosts(library.sources, library.results), [library.sources, library.results]);
  const { values, page, update, clear, setPage } = useLibraryParams(DEFAULTS);
  const sort = redditSortOf(values.sort);

  const subreddits = useMemo(() => subredditsOf(posts), [posts]);
  const filtered = useMemo(
    () => filterAndSortRedditPosts(posts, { query: values.q, sort, subreddit: values.subreddit, accountId: values.account }),
    [posts, values.q, sort, values.subreddit, values.account],
  );
  const paged = pageSlice(filtered, page, ITEMS_PER_PAGE);
  const totals = useMemo(() => ({
    score: filtered.reduce((sum, post) => sum + post.score, 0),
    comments: filtered.reduce((sum, post) => sum + post.numComments, 0),
  }), [filtered]);
  const average = (total: number) => (filtered.length > 0 ? `${fmtNum(Math.round(total / filtered.length))} per post on average` : '');

  const clearFilters = () => clear(['q', 'account', 'subreddit']);
  const activeAccount = accountsById[values.account];
  const activeFilters = [
    values.q && { key: 'q', label: `"${values.q}"`, onRemove: () => update({ q: '' }) },
    activeAccount && { key: 'account', label: `u/${activeAccount.username}`, onRemove: () => update({ account: 'all' }) },
    values.subreddit !== 'all' && { key: 'subreddit', label: `r/${values.subreddit}`, onRemove: () => update({ subreddit: 'all' }) },
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

  if (redditAccounts.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Reddit posts" description="Posts from every connected Reddit account" />
        <SurfaceBox>
          <EmptyState
            icon={<Posts />}
            title="No Reddit accounts yet"
            description="Connect a Reddit account to see its posts, karma and comments here."
            action={<Button render={<Link to="/accounts?add=1" />}><Plus data-icon="inline-start" aria-hidden="true" />Add account</Button>}
          />
        </SurfaceBox>
      </div>
    );
  }

  const loading = library.initialLoading;
  const accountWord = `account${redditAccounts.length === 1 ? '' : 's'}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reddit posts"
        description={
          <span className="flex flex-col gap-1">
            <span>{loading ? `Loading posts from ${redditAccounts.length} ${accountWord}` : `${posts.length} posts across ${redditAccounts.length} ${accountWord}`}</span>
            {!loading && <DataFreshness fetchedAt={library.fetchedAt} qualifier={redditAccounts.length > 1 ? 'oldest account' : undefined} />}
          </span>
        }
        actions={<RefreshButton refreshing={library.refreshing} onRefresh={library.refresh} disabled={loading} />}
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
          <FailedSourcesAlert failures={library.failures} total={redditAccounts.length} noun="accounts" onRetry={library.refresh} retrying={library.refreshing} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-busy={library.refreshing}>
            <MetricBox icon={<Posts />}    label="Posts"    value={<Num value={filtered.length} />} period="Matching posts" subtitle={`${posts.length} loaded in total`} />
            <MetricBox icon={<Karma />}    label="Karma"    value={<Num value={totals.score} />}    period="Matching posts" subtitle={average(totals.score)} highlight />
            <MetricBox icon={<Comments />} label="Comments" value={<Num value={totals.comments} />} period="Matching posts" subtitle={average(totals.comments)} />
          </div>

          <RedditPostFilters
            query={values.q} onQuery={value => update({ q: value }, { replace: true })}
            sort={sort} onSort={value => update({ sort: value })}
            subreddit={values.subreddit} onSubreddit={value => update({ subreddit: value })} subreddits={subreddits}
            accountId={values.account} onAccount={value => update({ account: value })} accounts={redditAccounts}
          />

          <ActiveFilters countLabel={resultCountLabel(filtered.length, posts.length, 'posts')} filters={activeFilters} onClearAll={clearFilters} />

          <div id={RESULTS_ID} tabIndex={-1} className="outline-none" aria-busy={library.refreshing}>
            {filtered.length === 0 ? (
              <SurfaceBox><NoResults noun="posts" query={values.q} onClear={clearFilters} /></SurfaceBox>
            ) : (
              <RedditPostTable posts={paged.items} offset={paged.offset} showAccount={redditAccounts.length > 1} accountsById={accountsById} />
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
