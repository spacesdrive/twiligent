import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface OpenLinkProps {
  href: string;
  label: string;
}

export default function OpenLink({ href, label }: OpenLinkProps) {
  return (
    <Button variant="ghost" size="icon-xs" render={<a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} />}>
      <ExternalLink />
    </Button>
  );
}
