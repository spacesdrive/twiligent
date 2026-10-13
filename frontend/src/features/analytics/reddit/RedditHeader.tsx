import { Link } from 'react-router-dom';
import { FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/PageHeader';
import { AccountAvatar } from '@/components/platform';
import { cn } from '@/lib/utils';
import { fmtDate, timeAgo } from '../../../utils/formatters';

export default function RedditHeader({ account, profile, back, refreshing, onRefresh }) {
  return (
    <PageHeader
      back={back}
      media={<AccountAvatar account={{ ...account, iconUrl: profile.iconUrl || account.iconUrl }} size="xl" showPlatform />}
      title={`u/${profile.username || account.username}`}
      description={
        <span className="flex flex-wrap items-center gap-1.5">
          {profile.isGold && <Badge variant="warning">Gold</Badge>}
          {profile.verified && <Badge variant="info">Verified</Badge>}
          {profile.isMod && <Badge variant="outline">Moderator</Badge>}
          <span>
            {profile.createdAt ? `Joined ${fmtDate(profile.createdAt)}. ` : ''}Refreshed {timeAgo(account.lastUpdated).toLowerCase()}.
          </span>
        </span>
      }
      actions={
        <>
          <Button variant="outline" size="sm" render={<Link to={`/reddit-posts/${account.id}`} />}>
            <FileText data-icon="inline-start" />
            View posts
          </Button>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw data-icon="inline-start" className={cn(refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing' : 'Refresh'}
          </Button>
        </>
      }
    />
  );
}
