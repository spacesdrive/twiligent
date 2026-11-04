import { Hash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import SurfaceBox from '@/components/SurfaceBox';
import { fmtNum } from '../../../utils/formatters';
import type { InstagramHashtagStats } from '@shared/types/instagram.ts';

const HIGHLIGHTED = 5;

export interface InstagramHashtagsProps {
  hashtags: InstagramHashtagStats[];
}

// the use count is printed on each tag and the average spelt out for screen readers; nothing hides behind hover
export default function InstagramHashtags({ hashtags }: InstagramHashtagsProps) {
  return (
    <SurfaceBox title="Top hashtags" subheader={`The ${HIGHLIGHTED} most used are filled. The number is how many posts used the tag.`}>
      <ul className="flex flex-wrap gap-1.5">
        {hashtags.slice(0, 20).map((hashtag, i) => (
          <li key={hashtag.tag}>
            <Badge
              variant={i < HIGHLIGHTED ? 'default' : 'outline'}
              className="h-6 px-2.5"
              title={`Used in ${hashtag.count} posts, ${fmtNum(hashtag.avgEngagement)} interactions per post on average`}
            >
              <Hash aria-hidden="true" />{hashtag.tag}
              <span className="opacity-80" aria-hidden="true">{hashtag.count}</span>
              <span className="sr-only">
                , used in {hashtag.count} posts, {fmtNum(hashtag.avgEngagement)} interactions per post on average{i < HIGHLIGHTED ? ', top 5' : ''}
              </span>
            </Badge>
          </li>
        ))}
      </ul>
    </SurfaceBox>
  );
}
