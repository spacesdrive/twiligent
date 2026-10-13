import { Link } from 'react-router-dom';
import { BookmarkCheck, CirclePlay, MessagesSquare, Tag, VideoIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SurfaceBox from '@/components/SurfaceBox';
import MetricBox from '@/components/MetricBox';
import { EmptyState } from '@/components/StateViews';
import { fmtNum } from '../../../utils/formatters';
import { IG_CONTENT_TYPES } from '../../../utils/instagramContent';
import { countLabel, igTypeSummary, topContentLabel } from './overviewLabels.js';
import AccountRankRow from './AccountRankRow';
import CategoryRow from './CategoryRow';

function instagramContentSubtitle(stats) {
  const { igTypes } = stats.cacheTotals;
  if (IG_CONTENT_TYPES.some(type => igTypes[type].count > 0)) return igTypeSummary(igTypes, 'count');
  return countLabel(stats.groups.instagram.length, 'account');
}

function CategoryTrailing({ stat }) {
  return (
    <span className="flex flex-col items-end gap-0.5 text-caption">
      {stat.views > 0 && <span className="font-medium text-ink">{fmtNum(stat.views)} views</span>}
      {stat.rdCount > 0 && <span className="text-ink-faint">{fmtNum(stat.rdKarma)} karma</span>}
    </span>
  );
}

export default function ContentTab({ stats }) {
  const { groups, totals, cacheTotals, trackedStats, categoryStats } = stats;
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricBox icon={<CirclePlay />}     label="YouTube videos"    value={fmtNum(totals.videos)}       subtitle={countLabel(groups.youtube.length, 'channel')} />
        <MetricBox icon={<VideoIcon />}      label="Instagram content" value={fmtNum(totals.posts)}        subtitle={instagramContentSubtitle(stats)} />
        <MetricBox icon={<MessagesSquare />} label="Reddit posts"      value={fmtNum(cacheTotals.rdPosts)} subtitle={cacheTotals.rdPosts > 0 ? 'From the analytics cache' : 'Open Reddit analytics to load'} />
        <MetricBox icon={<BookmarkCheck />}  label="Tracked content"   value={fmtNum(trackedStats.total)}  subtitle={`${trackedStats.ytItems.length} YouTube, ${trackedStats.rdItems.length} Reddit`} />
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
              icon={<Tag />}
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
