import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SurfaceBox from '@/components/SurfaceBox';
import MetricBox from '@/components/MetricBox';
import Num from '@/components/Num';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { EmptyState } from '@/components/StateViews';
import { fmtNum } from '../../../utils/formatters';
import { IG_CONTENT_TYPES } from '../../../utils/instagramContent';
import { countLabel, igTypeSummary, topContentLabel } from './overviewLabels.ts';
import AccountRankRow from './AccountRankRow';
import CategoryRow from './CategoryRow';
import type { OverviewStats } from './useOverviewStats';
import type { CategoryStat } from './overviewTrackedStats.ts';

const { videos: Videos, instagram: Instagram, redditPosts: Reddit, tracked: Tracked, category: Category } = METRIC_ICONS;

function instagramContentSubtitle(stats: OverviewStats): string {
  const { igTypes } = stats.cacheTotals;
  if (IG_CONTENT_TYPES.some(type => igTypes[type].count > 0)) return igTypeSummary(igTypes, 'count');
  return countLabel(stats.groups.instagram.length, 'account');
}

function CategoryTrailing({ stat }: { stat: CategoryStat }) {
  return (
    <span className="flex flex-col items-end gap-0.5 text-caption">
      {stat.views > 0 && <span className="font-medium text-ink">{fmtNum(stat.views)} views</span>}
      {stat.rdCount > 0 && <span className="text-ink-faint">{fmtNum(stat.rdKarma)} karma</span>}
    </span>
  );
}

export interface ContentTabProps {
  stats: OverviewStats;
}

export default function ContentTab({ stats }: ContentTabProps) {
  const { groups, totals, cacheTotals, trackedStats, categoryStats } = stats;
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricBox icon={<Videos />}    label="YouTube videos"    value={<Num value={totals.videos} />}       period="All time"     subtitle={countLabel(groups.youtube.length, 'channel')} />
        <MetricBox icon={<Instagram />} label="Instagram content" value={<Num value={totals.posts} />}        period="All time"     subtitle={instagramContentSubtitle(stats)} />
        <MetricBox icon={<Reddit />}    label="Reddit posts"      value={<Num value={cacheTotals.rdPosts} />} period="Loaded posts" subtitle={cacheTotals.rdPosts > 0 ? 'From the analytics cache' : 'Open Reddit analytics to load'} />
        <MetricBox icon={<Tracked />}   label="Tracked content"   value={<Num value={trackedStats.total} />}  period="Now"          subtitle={`${trackedStats.ytItems.length} YouTube, ${trackedStats.rdItems.length} Reddit`} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SurfaceBox title="Top by content" contentClassName="px-2 py-2">
          <div className="flex flex-col">
            {stats.byContent.map((account, i) => (
              <AccountRankRow
                key={account.id}
                account={account}
                rank={i + 1}
                trailing={<span className="font-medium text-ink-muted">{topContentLabel(account)}</span>}
              />
            ))}
          </div>
        </SurfaceBox>

        <SurfaceBox title="Tracked categories" contentClassName="px-2 py-2">
          {categoryStats.length === 0 ? (
            <EmptyState
              compact
              icon={<Category />}
              title="No categories yet"
              description="Assign categories to tracked content to see this breakdown."
              action={<Button size="sm" variant="outline" render={<Link to="/tracked-content" />}>Open tracked content</Button>}
            />
          ) : (
            <div className="flex flex-col">
              {categoryStats.map(stat => <CategoryRow key={stat.category} stat={stat} trailing={<CategoryTrailing stat={stat} />} />)}
            </div>
          )}
        </SurfaceBox>
      </div>
    </>
  );
}
