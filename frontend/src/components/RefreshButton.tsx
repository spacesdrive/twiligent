import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface RefreshButtonProps {
  refreshing: boolean;
  onRefresh: () => void;
  disabled?: boolean;
  // what is refreshed, for the accessible name when the page holds more than one thing
  target?: string;
}

// the one Refresh control for page headers: same size, label and busy state everywhere
export default function RefreshButton({ refreshing, onRefresh, disabled = false, target }: RefreshButtonProps) {
  return (
    <Button
      variant="outline"
      onClick={onRefresh}
      disabled={refreshing || disabled}
      aria-label={target ? `${refreshing ? 'Refreshing' : 'Refresh'} ${target}` : undefined}
    >
      <RefreshCw data-icon="inline-start" className={cn(refreshing && 'animate-spin')} aria-hidden="true" />
      {refreshing ? 'Refreshing' : 'Refresh'}
    </Button>
  );
}
