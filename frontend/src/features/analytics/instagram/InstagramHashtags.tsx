import { Hash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import SurfaceBox from '@/components/SurfaceBox';
import { fmtNum } from '../../../utils/formatters';

export default function InstagramHashtags({ hashtags }) {
  return (
    <SurfaceBox title="Top hashtags">
      <div className="flex flex-wrap gap-1.5">
        {hashtags.slice(0, 20).map((hashtag, i) => (
          <Tooltip key={hashtag.tag}>
            <TooltipTrigger render={<Badge variant={i < 5 ? 'default' : 'outline'} className="h-6 cursor-default px-2.5" />}>
              <Hash />{hashtag.tag}<span className="opacity-70">{hashtag.count}</span>
            </TooltipTrigger>
            <TooltipContent>Used {hashtag.count} times, {fmtNum(hashtag.avgEngagement)} average engagement</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </SurfaceBox>
  );
}
