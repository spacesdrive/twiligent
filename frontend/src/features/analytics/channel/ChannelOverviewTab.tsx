import MetricBox from '@/components/MetricBox';
import MetricDetails from '@/components/MetricDetails';
import Num from '@/components/Num';
import SectionHeader from '@/components/SectionHeader';
import MediaCard, { MediaChip } from '@/components/MediaCard';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtNum, fmtPercent } from '../../../utils/formatters';
import { bestVideosOf, likesLabel, watchUrl } from './channelChartData.ts';
import type { VideoAnalytics } from '@shared/types/youtube.ts';
import type { ChannelDetails } from './channelChartData.ts';

const { views: Views, audience: Audience, videos: Videos, likes: Likes, rate: Rate } = METRIC_ICONS;

function BestVideos({ analytics }: { analytics: VideoAnalytics }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {bestVideosOf(analytics).map(({ label, video }) => (
        <li key={label} className="flex">
          <MediaCard
            className="w-full"
            href={watchUrl(video.videoId)}
            linkLabel={`${label}: ${video.title}, ${fmtNum(video.viewCount)} views, ${likesLabel(video.likeCount)}. Opens on YouTube in a new tab.`}
            image={video.thumbnail}
            title={video.title}
            topLeft={<MediaChip>{label}</MediaChip>}
            meta={<span>{fmtNum(video.viewCount)} views, {likesLabel(video.likeCount)}</span>}
          />
        </li>
      ))}
    </ul>
  );
}

export interface ChannelOverviewTabProps {
  channel: ChannelDetails;
  analytics: VideoAnalytics;
}

// five headline numbers; the rest sit in one quiet list, and each tab owns its own figures so nothing repeats
export default function ChannelOverviewTab({ channel, analytics }: ChannelOverviewTabProps) {
  const videosPeriod = `Last ${analytics.totalVideos} videos`;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <MetricBox small icon={<Views />}    label="Views"           value={<Num value={channel.viewCount} />}       period="All time" highlight />
        <MetricBox small icon={<Audience />} label="Subscribers"     value={<Num value={channel.subscriberCount} />} period="Now" />
        <MetricBox small icon={<Videos />}   label="Videos"          value={<Num value={channel.videoCount} />}      period="All time" subtitle={`${analytics.totalVideos} analyzed`} />
        <MetricBox small icon={<Likes />}    label="Likes"           value={<Num value={analytics.totalLikes} />}    period={videosPeriod} />
        <MetricBox small icon={<Rate />}     label="Engagement rate" value={fmtPercent(analytics.overallEngagementRate)} period={videosPeriod} subtitle="Likes and comments per view" />
      </div>

      <MetricDetails
        subheader={`Worked out from the ${analytics.totalVideos} videos loaded from this channel.`}
        groups={[
          {
            title: 'Per video',
            items: [
              { label: 'Average views', value: <Num value={analytics.avgViews} /> },
              { label: 'Median views', value: <Num value={analytics.medianViews} />, hint: 'Half the videos have more, half have fewer' },
              { label: 'Average likes', value: <Num value={analytics.avgLikes} /> },
              { label: 'Average comments', value: <Num value={analytics.avgComments} /> },
              { label: 'Average length', value: analytics.avgDurationFormatted },
            ],
          },
          {
            title: 'Recent uploads',
            items: [
              { label: 'Last 7 days', value: analytics.videosLast7Days },
              { label: 'Last 30 days', value: analytics.videosLast30Days },
              { label: 'Last 90 days', value: analytics.videosLast90Days },
              { label: 'Last 365 days', value: analytics.videosLast365Days },
            ],
          },
          {
            title: 'Audience',
            items: [
              { label: 'Comments', value: <Num value={analytics.totalComments} />, hint: videosPeriod },
              { label: 'Views per subscriber', value: channel.viewsPerSubscriber, hint: 'All-time views divided by subscribers' },
            ],
          },
        ]}
      />

      <SectionHeader title="Best performing videos" className="mt-2" />
      <BestVideos analytics={analytics} />
    </>
  );
}
