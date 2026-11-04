import { Badge } from '@/components/ui/badge';
import SurfaceBox from '@/components/SurfaceBox';
import type { YouTubeTagCount } from '@shared/types/youtube.ts';

const HIGHLIGHTED = 5;

export interface TagCloudProps {
  tags: YouTubeTagCount[];
}

// the fill only repeats what the subheader says, and screen readers hear the count as words
export default function TagCloud({ tags }: TagCloudProps) {
  return (
    <SurfaceBox title="Most used tags" subheader={`The ${HIGHLIGHTED} most used are filled. The number is how many videos use the tag.`}>
      {tags.length === 0 ? (
        <p className="text-small text-ink-faint">These videos have no tags.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map(({ tag, count }, i) => (
            <li key={tag}>
              <Badge variant={i < HIGHLIGHTED ? 'default' : 'outline'} className="h-6 px-2.5">
                {tag}
                <span className="opacity-80" aria-hidden="true">{count}</span>
                <span className="sr-only">, used in {count} videos{i < HIGHLIGHTED ? ', top 5' : ''}</span>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </SurfaceBox>
  );
}
