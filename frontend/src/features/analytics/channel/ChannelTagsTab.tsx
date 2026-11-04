import MetricBox from '@/components/MetricBox';
import SurfaceBox from '@/components/SurfaceBox';
import RankingBarChart from '@/components/RankingBarChart';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtPercent } from '../../../utils/formatters';
import MetricGrid from './MetricGrid';
import TagCloud from './TagCloud';
import type { VideoAnalytics } from '@shared/types/youtube.ts';

const { tags: Tags, comments: Captions, quality: Quality, regularVideos: Embeddable } = METRIC_ICONS;

export interface ChannelTagsTabProps {
  analytics: VideoAnalytics;
}

export default function ChannelTagsTab({ analytics }: ChannelTagsTabProps) {
  const tags = analytics.tagFrequency || [];
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
        <SurfaceBox title="Tag usage, top 20">
          <RankingBarChart
            rows={tags.slice(0, 20).map(({ tag, count }) => ({ name: tag, value: count }))}
            label="Videos using this tag"
            title="Tag usage, top 20"
          />
        </SurfaceBox>
      )}
    </>
  );
}
