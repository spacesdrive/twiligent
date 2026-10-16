import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface RowActionProps {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  href?: string;
  danger?: boolean;
}

export default function RowAction({ label, onClick, disabled, children, href, danger }: RowActionProps) {
  const button = href
    ? <Button variant="ghost" size="icon-xs" render={<a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} />} />
    : <Button variant="ghost" size="icon-xs" onClick={onClick} disabled={disabled} aria-label={label} className={cn(danger && 'hover:bg-danger-soft hover:text-danger')} />;
  return (
    <Tooltip>
      <TooltipTrigger render={button}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
