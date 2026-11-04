import { Users } from 'lucide-react';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState } from '@/components/StateViews';
import { PlatformBadge } from '@/components/platform';
import { platformOf } from '@/lib/accounts';
import AudienceChart from './AudienceChart';
import AccountRankRow from './AccountRankRow';
import type { OverviewStats } from './useOverviewStats';

export interface AudienceTabProps {
  stats: OverviewStats;
}

export default function AudienceTab({ stats }: AudienceTabProps) {
  const audienceData = stats.charts.audience;
  return (
    <>
      <SurfaceBox title="Audience by account" subheader="Subscribers for each YouTube channel and followers for each Instagram account">
        {audienceData.length === 0 ? (
          <EmptyState compact icon={<Users />} title="No audience data yet" description="Refresh your accounts to load subscriber and follower counts." />
        ) : (
          <AudienceChart data={audienceData} legend={stats.legend} />
        )}
      </SurfaceBox>

      <SurfaceBox title="Top by audience" contentClassName="px-2 py-2">
        <div className="flex flex-col">
          {stats.byAudience.map((account, i) => (
            <AccountRankRow key={account.id} account={account} rank={i + 1} trailing={<PlatformBadge platform={platformOf(account)} />} />
          ))}
        </div>
      </SurfaceBox>
    </>
  );
}
