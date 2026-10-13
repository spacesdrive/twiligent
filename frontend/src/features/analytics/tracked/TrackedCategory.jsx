import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Eye, MessageSquare, MessagesSquare, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import MetricBox from '@/components/MetricBox';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState, PageSkeleton } from '@/components/StateViews';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum } from '../../../utils/formatters';
import { isRedditItem } from '../../../utils/trackedContent';
import CategoryRedditSection from './CategoryRedditSection';
import CategoryYouTubeSection from './CategoryYouTubeSection';
import {
  categoryDescription, commentsSubtitle, itemsSubtitle, karmaMetric, redditStatsOf, viewsMetric, youtubeStatsOf,
} from './trackedCategoryStats.js';

const BACK_LINK = { to: '/tracked-content', label: 'Tracked content' };

export default function TrackedCategory() {
  const { name } = useParams();
  const { showToast } = useAppContext();
  const categoryName = decodeURIComponent(name || '');

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTrackedContent()
      .then(data => setItems((Array.isArray(data) ? data : []).filter(item => item.category === categoryName)))
      .catch(err => showToast(`Couldn't load this category. ${err.message}`, 'error'))
      .finally(() => setLoading(false));
  }, [categoryName, showToast]);

  const ytItems = useMemo(() => items.filter(item => item.contentType === 'youtube'), [items]);
  const rdItems = useMemo(() => items.filter(isRedditItem), [items]);
  const ytStats = useMemo(() => youtubeStatsOf(ytItems), [ytItems]);
  const rdStats = useMemo(() => redditStatsOf(rdItems), [rdItems]);

  if (loading) return <PageSkeleton metrics={4} />;

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader back={BACK_LINK} eyebrow="Category" title={categoryName} description="No items in this category" />
        <SurfaceBox>
          <EmptyState
            icon={<Tag />}
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
        <MetricBox icon={<Tag />} label="Items" value={items.length} subtitle={itemsSubtitle(ytStats, rdStats)} />
        <MetricBox icon={<Eye />} label="Views" value={views.value} subtitle={views.subtitle} highlight />
        <MetricBox icon={<MessagesSquare />} label="Reddit karma" value={karma.value} subtitle={karma.subtitle} />
        <MetricBox icon={<MessageSquare />} label="Comments" value={fmtNum(ytStats.comments + rdStats.comments)} subtitle={commentsSubtitle(ytStats, rdStats)} />
      </div>

      {ytItems.length > 0 && <CategoryYouTubeSection items={ytItems} stats={ytStats} />}
      {rdItems.length > 0 && <CategoryRedditSection items={rdItems} stats={rdStats} />}
    </div>
  );
}
