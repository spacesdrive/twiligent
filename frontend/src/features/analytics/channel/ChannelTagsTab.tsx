import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip } from 'recharts';
import { Film, MessageSquare, Tag, VideoIcon } from 'lucide-react';
import MetricBox from '@/components/MetricBox';
import ChartPanel from '@/components/ChartPanel';
import { SERIES, axisProps, gridProps, tooltipCursor, tooltipStyle } from '@/lib/chart';
import { fmtPercent } from '../../../utils/formatters';
import MetricGrid from './MetricGrid';
import TagCloud from './TagCloud';
import type { VideoAnalytics } from '@shared/types/youtube.ts';

export interface ChannelTagsTabProps {
  analytics: VideoAnalytics;
}

export default function ChannelTagsTab({ analytics }: ChannelTagsTabProps) {
  const tags = analytics.tagFrequency || [];
  return (
    <>
      <MetricGrid>
        <MetricBox small icon={<Tag />}           label="Unique tags"     value={analytics.tagFrequency?.length || 0} />
        <MetricBox small icon={<MessageSquare />} label="Caption rate"    value={fmtPercent(analytics.captionPercentage)} />
        <MetricBox small icon={<Film />}          label="HD rate"         value={fmtPercent(analytics.hdPercentage)} />
        <MetricBox small icon={<VideoIcon />}     label="Embeddable rate" value={fmtPercent(analytics.embeddablePercentage)} />
      </MetricGrid>
      <TagCloud tags={tags} />
      {tags.length > 0 && (
        <ChartPanel title="Tag usage, top 20" height={400}>
          <BarChart data={tags.slice(0, 20)} layout="vertical">
            <CartesianGrid {...gridProps} horizontal={false} />
            <XAxis type="number" {...axisProps} />
            <YAxis dataKey="tag" type="category" {...axisProps} width={140} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
            <Bar dataKey="count" fill={SERIES.primary} radius={[0, 4, 4, 0]} name="Videos using this tag" />
          </BarChart>
        </ChartPanel>
      )}
    </>
  );
}
