import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/PageHeader';
import RefreshButton from '@/components/RefreshButton';
import DataFreshness from '@/components/DataFreshness';
import { AccountAvatar } from '@/components/platform';
import { fmtDate } from '../../../utils/formatters';
import type { AppAccount } from '../../../utils/formatters';
import type { PageHeaderBack } from '@/components/PageHeader';
import type { RedditProfileFields } from './redditAnalyticsData.ts';

export interface RedditHeaderProps {
  account: AppAccount;
  profile: RedditProfileFields;
  back: PageHeaderBack;
  refreshing: boolean;
  onRefresh: () => void;
  // when the posts were fetched; Reddit numbers are cached for up to 6 hours
  fetchedAt: string | null;
}

export default function RedditHeader({ account, profile, back, refreshing, onRefresh, fetchedAt }: RedditHeaderProps) {
  return (
    <PageHeader
      back={back}
      media={<AccountAvatar account={{ ...account, iconUrl: profile.iconUrl || account.iconUrl }} size="xl" showPlatform decorative />}
      title={`u/${profile.username || account.username}`}
      description={
        <span className="flex flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-1.5">
            {profile.isGold && <Badge variant="warning">Gold</Badge>}
            {profile.verified && <Badge variant="info">Verified</Badge>}
            {profile.isMod && <Badge variant="outline">Moderator</Badge>}
            {profile.createdAt && <span>Joined {fmtDate(profile.createdAt)}</span>}
          </span>
          <DataFreshness fetchedAt={fetchedAt} />
        </span>
      }
      actions={
        <>
          <Button variant="outline" render={<Link to={`/reddit-posts/${account.id}`} />}>
            <FileText data-icon="inline-start" aria-hidden="true" />
            View posts
          </Button>
          <RefreshButton refreshing={refreshing} onRefresh={onRefresh} />
        </>
      }
    />
  );
}
