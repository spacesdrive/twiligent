import MetricBox from '@/components/MetricBox';
import Num from '@/components/Num';
import { IG_TYPE_ICONS, METRIC_ICONS } from '@/lib/metricIcons';
import { IG_CONTENT_TYPES, IG_CONTENT_TYPE_META } from '../../../utils/instagramContent';
import type { InstagramContentType } from '@shared/types/instagram.ts';
import { typeViewsSubtitle, viewTotalsOf } from './reelsLibrary.ts';
import type { MediaTypeTotal, MediaTypeTotals } from './reelsLibrary.ts';

interface TypeMetricProps {
  type: InstagramContentType;
  typeTotal: MediaTypeTotal;
}

export interface ReelsMetricsProps {
  typeTotals: MediaTypeTotals;
  itemCount: number;
}

const Views = METRIC_ICONS.views;

function TypeMetric({ type, typeTotal }: TypeMetricProps) {
  const Icon = IG_TYPE_ICONS[type];
  return (
    <MetricBox
      small
      icon={<Icon />}
      label={IG_CONTENT_TYPE_META[type].plural}
      value={<Num value={typeTotal.count} />}
      period="Loaded posts"
      subtitle={typeViewsSubtitle(typeTotal)}
    />
  );
}

export default function ReelsMetrics({ typeTotals, itemCount }: ReelsMetricsProps) {
  const { totalViews, viewsReported } = viewTotalsOf(typeTotals);
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricBox small icon={<Views />} label="Views" value={<Num value={totalViews} />} period="Loaded posts" subtitle={`${viewsReported} of ${itemCount} items report views`} highlight />
      {IG_CONTENT_TYPES.map(type => <TypeMetric key={type} type={type} typeTotal={typeTotals[type]} />)}
    </div>
  );
}
