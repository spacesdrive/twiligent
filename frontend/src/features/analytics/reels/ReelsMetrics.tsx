import { Clapperboard, Eye, Film, Image } from 'lucide-react';
import MetricBox from '@/components/MetricBox';
import { fmtNum } from '../../../utils/formatters';
import { IG_CONTENT_TYPES, IG_CONTENT_TYPE_META } from '../../../utils/instagramContent';
import { typeViewsSubtitle, viewTotalsOf } from './reelsLibrary.ts';

const CONTENT_TYPE_ICONS = { reel: Clapperboard, post: Image, video: Film };

function TypeMetric({ type, typeTotal }) {
  const Icon = CONTENT_TYPE_ICONS[type];
  return (
    <MetricBox
      small
      icon={<Icon />}
      label={IG_CONTENT_TYPE_META[type].plural}
      value={fmtNum(typeTotal.count)}
      subtitle={typeViewsSubtitle(typeTotal)}
    />
  );
}

export default function ReelsMetrics({ typeTotals, itemCount }) {
  const { totalViews, viewsReported } = viewTotalsOf(typeTotals);
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricBox small icon={<Eye />} label="Views" value={fmtNum(totalViews)} subtitle={`${viewsReported} of ${itemCount} items report views`} highlight />
      {IG_CONTENT_TYPES.map(type => <TypeMetric key={type} type={type} typeTotal={typeTotals[type]} />)}
    </div>
  );
}
