import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GuideLinkButton({ href, children, disabled, variant = 'outline' }) {
  if (disabled) {
    return <Button variant={variant} size="sm" disabled>{children}</Button>;
  }
  return (
    <Button variant={variant} size="sm" render={<a href={href} target="_blank" rel="noopener noreferrer" />}>
      {children}
      <ExternalLink data-icon="inline-end" />
    </Button>
  );
}
