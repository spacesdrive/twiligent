import {
  BarChart2, Calendar, Clapperboard, Eye, Film, Flame, Heart, Image, MessageCircle, TrendingUp, Trophy, UserPlus, Users, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import MetricBox from '@/components/MetricBox';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import { IG_CONTENT_TYPES, IG_CONTENT_TYPE_META } from '../../../utils/instagramContent';
import { followerRatio, typeViewsSubtitle } from './instagramAnalyticsData.ts';
import type { InstagramProfileFields } from './instagramAnalyticsData.ts';
import type {
  InstagramAnalytics, InstagramContentType, InstagramContentTypeStats, InstagramContentTypeStatsMap,
} from '@shared/types/instagram.ts';

const CONTENT_TYPE_ICONS: Record<InstagramContentType, LucideIcon> = { reel: Clapperboard, post: Image, video: Film };

interface ContentTypeMetricProps {
  type: InstagramContentType;
  stats: Partial<InstagramContentTypeStats>;
}

function ContentTypeMetric({ type, stats }: ContentTypeMetricProps) {
  const Icon = CONTENT_TYPE_ICONS[type];
  return (
    <MetricBox
      small
      icon={<Icon />}
      label={IG_CONTENT_TYPE_META[type].plural}
      value={fmtNum(stats.count)}
      subtitle={typeViewsSubtitle(stats)}
    />
  );
}

export interface InstagramMetricsProps {
  profile: InstagramProfileFields;
  analytics: Partial<InstagramAnalytics>;
}

export default function InstagramMetrics({ profile, analytics }: InstagramMetricsProps) {
  const typeStats: Partial<InstagramContentTypeStatsMap> = analytics.contentTypeStats || {};
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MetricBox small icon={<Users />}         label="Followers"       value={fmtNum(profile.followersCount)}                   subtitle={fmtNumFull(profile.followersCount)} highlight />
        <MetricBox small icon={<UserPlus />}      label="Following"       value={fmtNum(profile.followsCount)}                     subtitle={fmtNumFull(profile.followsCount)} />
        <MetricBox small icon={<Image />}         label="Total posts"     value={fmtNum(analytics.totalPosts || profile.mediaCount)} subtitle={`${analytics.fetchedPosts || 0} analyzed`} />
        <MetricBox small icon={<Heart />}         label="Total likes"     value={fmtNum(analytics.totalLikes)}                     subtitle={fmtNumFull(analytics.totalLikes)} />
        <MetricBox small icon={<MessageCircle />} label="Total comments"  value={fmtNum(analytics.totalComments)}                  subtitle={fmtNumFull(analytics.totalComments)} />
        <MetricBox small icon={<TrendingUp />}    label="Engagement rate" value={`${analytics.engagementRate || 0}%`}              subtitle={`${fmtNum(analytics.avgLikes)} likes per post on average`} />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricBox small icon={<Eye />} label="Total views" value={fmtNum(analytics.totalViews)} subtitle={`${analytics.mediaWithViews || 0} of ${analytics.fetchedPosts || 0} items report views`} />
        {IG_CONTENT_TYPES.map(type => <ContentTypeMetric key={type} type={type} stats={typeStats[type] || {}} />)}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MetricBox small icon={<Zap />}           label="Likes per post"      value={fmtNum(analytics.avgLikes)} />
        <MetricBox small icon={<MessageCircle />} label="Comments per post"   value={fmtNum(analytics.avgComments)} />
        <MetricBox small icon={<BarChart2 />}     label="Median likes"        value={fmtNum(analytics.medianLikes)} />
        <MetricBox small icon={<Users />}         label="Follower ratio"      value={followerRatio(profile)} subtitle="Followers per account followed" />
        <MetricBox small icon={<Heart />}         label="Likes per follower"  value={`${analytics.likesPerFollower || 0}%`} subtitle="Per post, on average" />
        <MetricBox small icon={<TrendingUp />}    label="Likes per comment"   value={`${analytics.likesToCommentsRatio || 0}:1`} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MetricBox small icon={<Calendar />} label="Posts per week" value={analytics.postFrequency?.perWeek || 0}    subtitle={`${analytics.postFrequency?.perMonth || 0} per month`} />
        <MetricBox small icon={<Calendar />} label="Last 7 days"    value={analytics.postsLast7Days || 0}            subtitle="Posts" />
        <MetricBox small icon={<Calendar />} label="Last 30 days"   value={analytics.postsLast30Days || 0}           subtitle="Posts" />
        <MetricBox small icon={<Calendar />} label="Last 90 days"   value={analytics.postsLast90Days || 0}           subtitle="Posts" />
        <MetricBox small icon={<Flame />}    label="Virality"       value={`${analytics.viralityScore || 0}x`}       subtitle="Best post against the average" />
        <MetricBox small icon={<Trophy />}   label="Consistency"    value={`${analytics.consistencyScore || 0}/100`} subtitle="Engagement stability" />
      </div>
    </div>
  );
}
