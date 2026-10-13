import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ReactNode } from 'react';
import { accountPath } from '@/lib/accounts';
import type { AccountFields } from '@/lib/accounts';

export interface OpenAnalyticsProps {
  account: AccountFields;
  name: ReactNode;
}

export default function OpenAnalytics({ account, name }: OpenAnalyticsProps) {
  const navigate = useNavigate();
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={() => navigate(accountPath(account))} aria-label={`Open analytics for ${name}`} />}>
        <ArrowUpRight />
      </TooltipTrigger>
      <TooltipContent>Open analytics</TooltipContent>
    </Tooltip>
  );
}
