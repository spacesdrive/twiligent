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
import CategoryYouTubeSection from './CategoryYouTubeSection';
import { fmtNum } from '../../../utils/formatters';
import { categoryDescription, shortsSubtitle, youtubeStatsOf } from './trackedCategoryStats.ts';
import type { TrackedContentItem } from '@shared/types/domain.ts';

const BACK_LINK = { to: '/tracked-content', label: 'Tracked content' };

const { tracked: Items, views: Views, likes: Likes, comments: Comments, category: Category } = METRIC_ICONS;

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

  const stats = useMemo(() => youtubeStatsOf(items), [items]);

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
            description="Assign this category to a YouTube video in Tracked content and its analytics appear here."
            action={<Button size="sm" render={<Link to="/tracked-content" />}>Open tracked content</Button>}
          />
        </SurfaceBox>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={BACK_LINK}
        eyebrow="Category"
        title={categoryName}
        description={categoryDescription(stats)}
        actions={<Button variant="outline" render={<Link to="/tracked-content" />}>Manage content</Button>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricBox icon={<Items />}    label="Videos"   value={stats.count}                    subtitle={shortsSubtitle(stats)} />
        <MetricBox icon={<Views />}    label="Views"    value={<Num value={stats.views} />}    subtitle={`${fmtNum(stats.avgViews)} per video on average`} highlight />
        <MetricBox icon={<Likes />}    label="Likes"    value={<Num value={stats.likes} />}    subtitle={`${stats.likeRatio}% of views`} />
        <MetricBox icon={<Comments />} label="Comments" value={<Num value={stats.comments} />} subtitle={`${fmtNum(stats.avgComments)} per video on average`} />
      </div>

      <CategoryYouTubeSection items={items} />
    </div>
  );
}
