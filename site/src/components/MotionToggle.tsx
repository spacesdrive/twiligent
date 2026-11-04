import { Pause, Play } from './icons';
import { useMotionPaused } from '@/lib/motion';
import { cn } from '@/lib/cn';

// the looping product pictures can be stopped from any page, not only through the system setting
export function MotionToggle({ className }: { className?: string }) {
  const [paused, toggle] = useMotionPaused();
  const label = paused ? 'Play animations' : 'Pause animations';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        'flex size-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink',
        className,
      )}
    >
      {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
    </button>
  );
}
