import { Textarea } from '@/components/ui/textarea';
import SurfaceBox from '@/components/SurfaceBox';
import { cn } from '@/lib/utils';
import { CAPTION_LIMIT } from './publishConstants';

export default function CaptionBox({ caption, onChange }) {
  const nearLimit = caption.length > CAPTION_LIMIT * 0.9;
  return (
    <SurfaceBox title="Caption">
      <Textarea
        value={caption}
        onChange={e => onChange(e.target.value)}
        placeholder="Write a caption. Add #hashtags and @mentions."
        rows={7}
        maxLength={CAPTION_LIMIT}
        aria-label="Caption"
        className="min-h-40 border-0 bg-transparent px-0 text-base leading-6 shadow-none hover:border-0 focus-visible:outline-none md:text-base"
      />
      <p className={cn('mt-2 text-right text-caption tabular-nums', nearLimit ? 'text-warning' : 'text-ink-faint')}>
        {caption.length.toLocaleString()} / {CAPTION_LIMIT.toLocaleString()}
      </p>
    </SurfaceBox>
  );
}
