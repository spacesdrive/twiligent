import { BarChart } from '@/components/ui/bar-chart';
import MetricBox from '@/components/MetricBox';
import ChartPanel from '@/components/ChartPanel';
import ExactTooltip from '@/components/ExactTooltip';
import { SERIES, pointsOf, rankingSummary } from '@/lib/chart';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtNum, fmtNumFull, fmtPercent } from '../../../utils/formatters';
import MetricGrid from './MetricGrid';
import TagCloud from './TagCloud';
import type { VideoAnalytics } from '@shared/types/youtube.ts';

const { tags: Tags, comments: Captions, quality: Quality, regularVideos: Embeddable } = METRIC_ICONS;

const TAG_USAGE = { count: { label: 'Videos using this tag', color: SERIES.neutral } };

export interface ChannelTagsTabProps {
  analytics: VideoAnalytics;
}

export default function ChannelTagsTab({ analytics }: ChannelTagsTabProps) {
  const tags = analytics.tagFrequency || [];
  const topTags = tags.slice(0, 20).map(({ tag, count }) => ({ tag, count }));
  return (
    <>
      <MetricGrid>
        <MetricBox small icon={<Tags />}       label="Unique tags"     value={tags.length} />
        <MetricBox small icon={<Captions />}   label="Caption rate"    value={fmtPercent(analytics.captionPercentage)} subtitle="Videos with captions" />
        <MetricBox small icon={<Quality />}    label="HD rate"         value={fmtPercent(analytics.hdPercentage)} subtitle="Videos in HD" />
        <MetricBox small icon={<Embeddable />} label="Embeddable rate" value={fmtPercent(analytics.embeddablePercentage)} subtitle="Videos other sites can embed" />
      </MetricGrid>
      <TagCloud tags={tags} />
      {tags.length > 0 && (
        <ChartPanel title="Tag usage, top 20" height={400} description={rankingSummary(pointsOf(topTags, 'tag', 'count'), fmtNumFull, 'videos')}>
          <BarChart
            data={topTags}
            dataKey="tag"
            layout="vertical"
            config={TAG_USAGE}
            containerHeight={400}
            legend={false}
            tooltip={<ExactTooltip />}
            xAxisProps={{ type: 'number', allowDecimals: false, tickFormatter: fmtNum }}
            yAxisProps={{ width: 140 }}
          />
        </ChartPanel>
      )}
    </>
  );
}
