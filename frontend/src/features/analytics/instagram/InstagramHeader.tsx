import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import { AccountAvatar } from '@/components/platform';
import { cn } from '@/lib/utils';

export default function InstagramHeader({ account, profile, back, refreshing, onRefresh }) {
  return (
    <PageHeader
      back={back}
      media={<AccountAvatar account={{ ...account, profilePictureUrl: profile.profilePictureUrl || account.profilePictureUrl }} size="xl" showPlatform />}
      title={profile.name || profile.username}
      description={
        <span className="flex flex-col gap-1">
          <span>@{profile.username}</span>
          {profile.biography && <span className="line-clamp-2 max-w-xl text-small text-ink-faint">{profile.biography}</span>}
        </span>
      }
      actions={
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw data-icon="inline-start" className={cn(refreshing && 'animate-spin')} />
          {refreshing ? 'Refreshing' : 'Refresh'}
        </Button>
      }
    />
  );
}
