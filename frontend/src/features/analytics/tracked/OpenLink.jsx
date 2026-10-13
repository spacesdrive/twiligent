import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OpenLink({ href, label }) {
  return (
    <Button variant="ghost" size="icon-xs" render={<a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} />}>
      <ExternalLink />
    </Button>
  );
}
