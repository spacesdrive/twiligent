import {
  BarChart2, Calendar, Clock, Eye, Flame, MessageSquare, ThumbsUp, Timer, TrendingUp, Trophy, Users, VideoIcon, Zap,
} from 'lucide-react';
import MetricBox from '@/components/MetricBox';
import SectionHeader from '@/components/SectionHeader';
import MediaCard, { MediaChip } from '@/components/MediaCard';
import { fmtNum, fmtNumFull, fmtPercent } from '../../../utils/formatters';
import { bestVideosOf, likesLabel, watchUrl } from './channelChartData.ts';
import MetricGrid from './MetricGrid';
import type { VideoAnalytics } from '@shared/types/youtube.ts';
import type { ChannelDetails } from './channelChartData.ts';

function BestVideos({ analytics }: { analytics: VideoAnalytics }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {bestVideosOf(analytics).map(({ label, video }) => (
        <MediaCard
          key={label}
          href={watchUrl(video.videoId)}
          image={video.thumbnail}
          title={video.title}
          topLeft={<MediaChip>{label}</MediaChip>}
          meta={<span>{fmtNum(video.viewCount)} views, {likesLabel(video.likeCount)}</span>}
        />
      ))}
    </div>
  );
}

export interface ChannelOverviewTabProps {
  channel: ChannelDetails;
  analytics: VideoAnalytics;
}

export default function ChannelOverviewTab({ channel, analytics }: ChannelOverviewTabProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MetricBox small icon={<Eye />}           label="Total views"   value={fmtNum(channel.viewCount)}       subtitle={fmtNumFull(channel.viewCount)} highlight />
        <MetricBox small icon={<Users />}         label="Subscribers"   value={fmtNum(channel.subscriberCount)} subtitle={fmtNumFull(channel.subscriberCount)} />
        <MetricBox small icon={<VideoIcon />}     label="Total videos"  value={fmtNum(channel.videoCount)}      subtitle={`${analytics.totalVideos} analyzed`} />
        <MetricBox small icon={<ThumbsUp />}      label="Total likes"   value={fmtNum(analytics.totalLikes)}    subtitle={fmtNumFull(analytics.totalLikes)} />
        <MetricBox small icon={<MessageSquare />} label="Comments"      value={fmtNum(analytics.totalComments)} subtitle={fmtNumFull(analytics.totalComments)} />
        <MetricBox small icon={<TrendingUp />}    label="Engagement"    value={fmtPercent(analytics.overallEngagementRate)} subtitle="Likes and comments per view" />
      </div>
      <MetricGrid>
        <MetricBox small icon={<Zap />}           label="Average views per video"  value={fmtNum(analytics.avgViews)} />
        <MetricBox small icon={<ThumbsUp />}      label="Average likes per video"  value={fmtNum(analytics.avgLikes)} />
        <MetricBox small icon={<MessageSquare />} label="Average comments"         value={fmtNum(analytics.avgComments)} />
        <MetricBox small icon={<BarChart2 />}     label="Median views"             value={fmtNum(analytics.medianViews)} />
      </MetricGrid>
      <MetricGrid>
        <MetricBox small icon={<Eye />}        label="Views per subscriber"   value={channel.viewsPerSubscriber} />
        <MetricBox small icon={<TrendingUp />} label="Subscribers per day"    value={fmtNum(channel.avgSubGainPerDay)} />
        <MetricBox small icon={<Eye />}        label="Views per day"          value={fmtNum(channel.avgViewsPerDay)} />
        <MetricBox small icon={<Timer />}      label="Average length"         value={analytics.avgDurationFormatted} />
      </MetricGrid>
      <MetricGrid>
        <MetricBox small icon={<Clock />} label="Videos, last 7 days"   value={analytics.videosLast7Days} />
        <MetricBox small icon={<Clock />} label="Videos, last 30 days"  value={analytics.videosLast30Days} />
        <MetricBox small icon={<Clock />} label="Videos, last 90 days"  value={analytics.videosLast90Days} />
        <MetricBox small icon={<Clock />} label="Videos, last 365 days" value={analytics.videosLast365Days} />
      </MetricGrid>
      <MetricGrid>
        <MetricBox small icon={<Calendar />} label="Estimated monthly views"       value={fmtNum(channel.estimatedMonthlyViews)} />
        <MetricBox small icon={<Users />}    label="Estimated monthly subscribers" value={fmtNum(channel.estimatedMonthlySubGain)} />
        <MetricBox small icon={<Flame />}    label="Virality score"                value={`${analytics.viralityScore}x`} />
        <MetricBox small icon={<Trophy />}   label="Consistency"                   value={`${analytics.consistencyScore}/100`} />
      </MetricGrid>

      <SectionHeader title="Best performing videos" className="mt-5" />
      <BestVideos analytics={analytics} />
    </>
  );
}
