import { Check, ImageOff } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { InstagramMedia } from '@shared/types/instagram.ts';

interface RuleMediaPickerProps {
  media: InstagramMedia[];
  loading: boolean;
  selected: string[];
  onToggle: (id: string) => void;
}

// the account's recent posts and reels as a grid of toggles
export default function RuleMediaPicker({ media, loading, selected, onToggle }: RuleMediaPickerProps) {
  if (loading) return <div className="flex justify-center py-6"><Spinner className="size-5" /></div>;
  if (media.length === 0) return <p className="text-small text-ink-muted">No posts found on this account yet.</p>;
  return (
    <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4" role="group" aria-label="Posts and reels">
      {media.map(item => {
        const active = selected.includes(item.id);
        const image = item.thumbnailUrl || item.mediaUrl;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            aria-label={item.caption ? item.caption.slice(0, 80) : `Post from ${new Date(item.timestamp).toLocaleDateString()}`}
            onClick={() => onToggle(item.id)}
            className={cn(
              'relative aspect-square overflow-hidden rounded-control border bg-surface-sunken transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              active ? 'border-brand ring-2 ring-brand' : 'border-line hover:border-line-strong',
            )}
          >
            {image
              ? <img src={image} alt="" className="size-full object-cover" loading="lazy" />
              : <span className="flex size-full items-center justify-center text-ink-faint"><ImageOff className="size-5 stroke-[1.75]" /></span>}
            {active && (
              <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-pill bg-brand text-on-brand">
                <Check className="size-3.5 stroke-[2]" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
