import MetricBox from '@/components/MetricBox';
import MetricDetails from '@/components/MetricDetails';
import Num from '@/components/Num';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtNum } from '../../../utils/formatters';
import { IG_CONTENT_TYPES, IG_CONTENT_TYPE_META } from '../../../utils/instagramContent';
import { followerRatio, typeViewsSubtitle } from './instagramAnalyticsData.ts';
import type { InstagramProfileFields } from './instagramAnalyticsData.ts';
import type { InstagramAnalytics, InstagramContentTypeStatsMap } from '@shared/types/instagram.ts';

export interface InstagramMetricsProps {
  profile: InstagramProfileFields;
  analytics: Partial<InstagramAnalytics>;
}

const { audience: Audience, views: Views, instagramLikes: Likes, comments: Comments, rate: Rate } = METRIC_ICONS;

export default function InstagramMetrics({ profile, analytics }: InstagramMetricsProps) {
  const typeStats: Partial<InstagramContentTypeStatsMap> = analytics.contentTypeStats || {};
  const analyzed = analytics.fetchedPosts || 0;
  const postsPeriod = `Last ${analyzed} posts`;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <MetricBox small icon={<Audience />} label="Followers" value={<Num value={profile.followersCount} />} period="Now" subtitle={`Following ${fmtNum(profile.followsCount)}`} highlight />
        <MetricBox small icon={<Views />} label="Views" value={<Num value={analytics.totalViews} />} period={postsPeriod} subtitle={`${analytics.mediaWithViews || 0} report views`} />
        <MetricBox small icon={<Likes />} label="Likes" value={<Num value={analytics.totalLikes} />} period={postsPeriod} />
        <MetricBox small icon={<Comments />} label="Comments" value={<Num value={analytics.totalComments} />} period={postsPeriod} />
        <MetricBox small icon={<Rate />} label="Engagement rate" value={`${analytics.engagementRate || 0}%`} period={postsPeriod} subtitle="Likes and comments per post, per follower" />
      </div>

      <MetricDetails
        subheader={`Worked out from the ${analyzed} most recent posts out of ${fmtNum(analytics.totalPosts || profile.mediaCount)}.`}
        groups={[
          {
            title: 'Content',
            items: IG_CONTENT_TYPES.map(type => ({
              label: IG_CONTENT_TYPE_META[type].plural,
              value: <Num value={typeStats[type]?.count} />,
              hint: typeViewsSubtitle(typeStats[type] || {}),
            })),
          },
          {
            title: 'Per post',
            items: [
              { label: 'Likes per post', value: <Num value={analytics.avgLikes} /> },
              { label: 'Comments per post', value: <Num value={analytics.avgComments} /> },
              { label: 'Median likes', value: <Num value={analytics.medianLikes} />, hint: 'Half the posts have more, half have fewer' },
              { label: 'Likes per follower', value: `${analytics.likesPerFollower || 0}%`, hint: 'Per post, on average' },
              { label: 'Likes per comment', value: `${analytics.likesToCommentsRatio || 0} to 1` },
            ],
          },
          {
            title: 'Publishing and audience',
            items: [
              { label: 'Posts per week', value: analytics.postFrequency?.perWeek || 0, hint: `${analytics.postFrequency?.perMonth || 0} per month` },
              { label: 'Posts in the last 7 days', value: analytics.postsLast7Days || 0 },
              { label: 'Posts in the last 30 days', value: analytics.postsLast30Days || 0 },
              { label: 'Posts in the last 90 days', value: analytics.postsLast90Days || 0 },
              { label: 'Virality', value: `${analytics.viralityScore || 0}x`, hint: 'Interactions on the best post, as a multiple of the average post' },
              { label: 'Consistency', value: `${analytics.consistencyScore || 0} of 100`, hint: 'How steady interactions are from post to post; 100 means every post does about as well' },
              { label: 'Follower ratio', value: followerRatio(profile), hint: 'Followers per account followed' },
            ],
          },
        ]}
      />
    </div>
  );
}
