import { Check, ImageOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { InstagramMedia } from '@shared/types/instagram.ts';

interface RuleMediaPickerProps {
  media: InstagramMedia[];
  loading: boolean;
  selected: string[];
  onToggle: (id: string) => void;
  error: string | null;
  onRetry: () => void;
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

// the account's recent posts and reels as a grid of toggles
// a failed load is an error with a retry, never an empty list
export default function RuleMediaPicker({ media, loading, selected, onToggle, error, onRetry, id, ...aria }: RuleMediaPickerProps) {
  if (loading) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-6 text-small text-ink-muted">
        <Spinner className="size-5" />Loading posts
      </div>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
          <span><span className="sr-only">Error: </span>{error}</span>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>Try again</Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (media.length === 0) return <p className="text-small text-ink-muted">This account has no posts or reels yet. Answer comments on every post instead.</p>;
  return (
    <div id={id} tabIndex={-1} className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto rounded-control sm:grid-cols-4" role="group" aria-label={`Posts and reels, ${selected.length} chosen`} {...aria}>
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
