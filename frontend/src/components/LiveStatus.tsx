import { cn } from '@/lib/utils';

export interface LiveStatusProps {
  message: string;
  visible?: boolean;
  className?: string;
}

// stays mounted with changing text, because screen readers only announce changes to a region they already know
export default function LiveStatus({ message, visible = false, className }: LiveStatusProps) {
  return (
    <p role="status" aria-live="polite" aria-atomic="true" className={cn(!visible && 'sr-only', className)}>
      {message}
    </p>
  );
}
