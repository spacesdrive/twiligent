import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export default function RowAction({ label, onClick, disabled, children, href, danger }) {
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
