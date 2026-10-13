import { Badge } from '@/components/ui/badge';
import type { StatusEntry } from './publishConstants';

interface StatusBadgeProps<S extends string> {
  status: S;
  map: Record<S, StatusEntry>;
}

// an unknown status shows as the first entry of the map
export default function StatusBadge<S extends string>({ status, map }: StatusBadgeProps<S>) {
  const entry = map[status] || (Object.values(map) as StatusEntry[])[0];
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
