import { Badge } from '@/components/ui/badge';

// an unknown status shows as the first entry of the map
export default function StatusBadge({ status, map }) {
  const entry = map[status] || Object.values(map)[0];
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
