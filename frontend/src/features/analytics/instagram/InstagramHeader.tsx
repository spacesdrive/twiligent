import PageHeader from '@/components/PageHeader';
import RefreshButton from '@/components/RefreshButton';
import DataFreshness from '@/components/DataFreshness';
import { AccountAvatar } from '@/components/platform';
import type { PageHeaderBack } from '@/components/PageHeader';
import type { AppAccount } from '../../../utils/formatters';
import type { InstagramProfileFields } from './instagramAnalyticsData.ts';

export interface InstagramHeaderProps {
  account: AppAccount;
  profile: InstagramProfileFields;
  back: PageHeaderBack;
  refreshing: boolean;
  onRefresh: () => void;
  fetchedAt: string | null;
}

export default function InstagramHeader({ account, profile, back, refreshing, onRefresh, fetchedAt }: InstagramHeaderProps) {
  return (
    <PageHeader
      back={back}
      media={<AccountAvatar account={{ ...account, profilePictureUrl: profile.profilePictureUrl || account.profilePictureUrl }} size="xl" showPlatform decorative />}
      title={profile.name || profile.username}
      description={
        <span className="flex flex-col gap-1">
          <span>@{profile.username}</span>
          {profile.biography && <span className="line-clamp-2 max-w-prose text-small text-ink-faint" title={profile.biography}>{profile.biography}</span>}
          <DataFreshness fetchedAt={fetchedAt} />
        </span>
      }
      actions={<RefreshButton refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
}
