import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/PageHeader';
import SurfaceBox from '@/components/SurfaceBox';
import Pager from '@/components/Pager';
import RefreshButton from '@/components/RefreshButton';
import DataFreshness from '@/components/DataFreshness';
import ActiveFilters from '@/components/ActiveFilters';
import NoResults from '@/components/NoResults';
import FailedSourcesAlert from '@/components/FailedSourcesAlert';
import { EmptyState } from '@/components/StateViews';
import { InstagramIcon } from '@/components/brand/platform-icons';
import { LIKE_TIERS, pageSlice, resultCountLabel } from '@/lib/library';
import { IG_CONTENT_TYPE_META } from '../../../utils/instagramContent';
import type { InstagramContentType } from '@shared/types/instagram.ts';
import { useInstagramMedia } from './useInstagramMedia';
import { useLibraryParams } from '../useLibraryParams';
import { filterAndSortMedia, mediaSortOf, reelsDescription, typeTotalsOf } from './reelsLibrary.ts';
import ReelsMetrics from './ReelsMetrics';
import ReelsFilters from './ReelsFilters';
import ReelsGrid from './ReelsGrid';

const ITEMS_PER_PAGE = 24;
const RESULTS_ID = 'instagram-results';

const DEFAULTS = { q: '', account: 'all', type: 'all', likes: 'all', sort: 'viewCount' };

export default function ReelsExplorer() {
  const { igAccounts, media, failures, fetchedAt, loading, refreshing, refresh } = useInstagramMedia();
  const { values, page, update, clear, setPage } = useLibraryParams(DEFAULTS);
  const sortField = mediaSortOf(values.sort);

  const accountMedia = useMemo(
    () => values.account === 'all' ? media : media.filter(item => item.accountId === values.account),
    [media, values.account],
  );
  const typeTotals = useMemo(() => typeTotalsOf(accountMedia), [accountMedia]);
  const filtered = useMemo(
    () => filterAndSortMedia(accountMedia, { typeFilter: values.type, search: values.q, tier: values.likes, sortField }),
    [accountMedia, values.type, values.q, values.likes, sortField],
  );
  const paged = pageSlice(filtered, page, ITEMS_PER_PAGE);

  const clearFilters = () => clear(['q', 'account', 'type', 'likes']);
  const accountLabel = igAccounts.find(account => account.id === values.account);
  const typeLabel = IG_CONTENT_TYPE_META[values.type as InstagramContentType]?.plural;
  const likesLabel = LIKE_TIERS.find(tier => tier.value === values.likes)?.label;
  const activeFilters = [
    values.q && { key: 'q', label: `"${values.q}"`, onRemove: () => update({ q: '' }) },
    accountLabel && { key: 'account', label: accountLabel.title || accountLabel.username || 'Account', onRemove: () => update({ account: 'all' }) },
    typeLabel && { key: 'type', label: typeLabel, onRemove: () => update({ type: 'all' }) },
    values.likes !== 'all' && likesLabel && { key: 'likes', label: likesLabel, onRemove: () => update({ likes: 'all' }) },
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

  const filters = { search: values.q, accountFilter: values.account, typeFilter: values.type, tier: values.likes, sortField };
  const handlers = {
    onSearchChange: (value: string) => update({ q: value }, { replace: true }),
    onAccountChange: (value: string) => update({ account: value }),
    onTierChange: (value: string) => update({ likes: value }),
    onSortChange: (value: string) => update({ sort: value }),
    onTypeChange: (value: string) => update({ type: value }),
  };

  const header = (
    <PageHeader
      title="Instagram content"
      description={
        <span className="flex flex-col gap-1">
          <span>{reelsDescription(loading, media.length, igAccounts.length)}</span>
          {!loading && <DataFreshness fetchedAt={fetchedAt} qualifier={igAccounts.length > 1 ? 'oldest account' : undefined} />}
        </span>
      }
      actions={<RefreshButton refreshing={refreshing} onRefresh={refresh} disabled={loading || igAccounts.length === 0} />}
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
            action={<Button render={<Link to="/accounts?add=1" />}><Plus data-icon="inline-start" aria-hidden="true" />Add account</Button>}
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

      <FailedSourcesAlert failures={failures} total={igAccounts.length} noun="accounts" onRetry={refresh} retrying={refreshing} />

      <div aria-busy={refreshing}>
        <ReelsMetrics typeTotals={typeTotals} itemCount={accountMedia.length} />
      </div>

      <ReelsFilters igAccounts={igAccounts} itemCount={accountMedia.length} typeTotals={typeTotals} filters={filters} handlers={handlers} />

      <ActiveFilters countLabel={resultCountLabel(filtered.length, media.length, 'items')} filters={activeFilters} onClearAll={clearFilters} />

      <div id={RESULTS_ID} tabIndex={-1} className="outline-none" aria-busy={refreshing}>
        {filtered.length === 0 ? (
          <SurfaceBox><NoResults noun="posts" query={values.q} onClear={clearFilters} /></SurfaceBox>
        ) : (
          <ReelsGrid items={paged.items} />
        )}
      </div>

      <Pager
        page={paged.page}
        pageCount={paged.pageCount}
        onPageChange={setPage}
        total={filtered.length}
        shown={paged.items.length}
        pageSize={ITEMS_PER_PAGE}
        noun="items"
        resultsId={RESULTS_ID}
      />
    </div>
  );
}
