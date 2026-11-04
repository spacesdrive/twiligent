import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import MetricBox from '@/components/MetricBox';
import Num from '@/components/Num';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/StateViews';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { api } from '../../../services/api';
import { isRedditItem } from '../../../utils/trackedContent';
import CategoryRedditSection from './CategoryRedditSection';
import CategoryYouTubeSection from './CategoryYouTubeSection';
import {
  categoryDescription, commentsSubtitle, itemsSubtitle, karmaMetric, redditStatsOf, viewsMetric, youtubeStatsOf,
} from './trackedCategoryStats.ts';
import type { TrackedContentItem } from '@shared/types/domain.ts';

const BACK_LINK = { to: '/tracked-content', label: 'Tracked content' };

const { tracked: Items, views: Views, karma: Karma, comments: Comments, category: Category } = METRIC_ICONS;

export default function TrackedCategory() {
  const { name } = useParams();
  const categoryName = decodeURIComponent(name || '');
  useDocumentTitle(categoryName ? `${categoryName} category` : null);

  const [items, setItems] = useState<TrackedContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getTrackedContent();
      setItems((Array.isArray(data) ? data : []).filter(item => item.category === categoryName));
      setError(null);
    } catch (err) {
      setError(`Couldn't load this category. ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [categoryName]);

  useEffect(() => { load(); }, [load]);

  const ytItems = useMemo(() => items.filter(item => item.contentType === 'youtube'), [items]);
  const rdItems = useMemo(() => items.filter(isRedditItem), [items]);
  const ytStats = useMemo(() => youtubeStatsOf(ytItems), [ytItems]);
  const rdStats = useMemo(() => redditStatsOf(rdItems), [rdItems]);

  if (loading) return <PageSkeleton metrics={4} />;

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader back={BACK_LINK} eyebrow="Category" title={categoryName} />
        <SurfaceBox><ErrorState title="This category could not load" description={error} onRetry={load} /></SurfaceBox>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader back={BACK_LINK} eyebrow="Category" title={categoryName} description="No items in this category" />
        <SurfaceBox>
          <EmptyState
            icon={<Category />}
            title={`Nothing tracked in ${categoryName}`}
            description="Assign this category to a Reddit post or YouTube video in Tracked content and its analytics appear here."
            action={<Button size="sm" render={<Link to="/tracked-content" />}>Open tracked content</Button>}
          />
        </SurfaceBox>
      </div>
    );
  }

  const views = viewsMetric(ytStats, rdStats);
  const karma = karmaMetric(rdStats);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={BACK_LINK}
        eyebrow="Category"
        title={categoryName}
        description={categoryDescription(items.length, ytItems.length, rdItems.length)}
        actions={<Button variant="outline" render={<Link to="/tracked-content" />}>Manage content</Button>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricBox icon={<Items />}    label="Items"        value={items.length} subtitle={itemsSubtitle(ytStats, rdStats)} />
        <MetricBox icon={<Views />}    label="Views"        value={views.value}  subtitle={views.subtitle} highlight />
        <MetricBox icon={<Karma />}    label="Reddit karma" value={karma.value}  subtitle={karma.subtitle} />
        <MetricBox icon={<Comments />} label="Comments"     value={<Num value={ytStats.comments + rdStats.comments} />} subtitle={commentsSubtitle(ytStats, rdStats)} />
      </div>

      {ytItems.length > 0 && <CategoryYouTubeSection items={ytItems} stats={ytStats} />}
      {rdItems.length > 0 && <CategoryRedditSection items={rdItems} stats={rdStats} />}
    </div>
  );
}
