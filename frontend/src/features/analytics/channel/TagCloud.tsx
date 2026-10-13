import { Badge } from '@/components/ui/badge';
import SurfaceBox from '@/components/SurfaceBox';
import type { YouTubeTagCount } from '@shared/types/youtube.ts';

export interface TagCloudProps {
  tags: YouTubeTagCount[];
}

export default function TagCloud({ tags }: TagCloudProps) {
  return (
    <SurfaceBox title="Most used tags">
      {tags.length === 0 ? (
        <p className="text-small text-ink-faint">These videos have no tags.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(({ tag, count }, i) => (
            <Badge key={tag} variant={i < 5 ? 'default' : 'outline'} className="h-6 px-2.5">
              {tag}<span className="opacity-70">{count}</span>
            </Badge>
          ))}
        </div>
      )}
    </SurfaceBox>
  );
}
