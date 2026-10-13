import { Calendar, Send } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ScheduleToggleProps {
  scheduled: boolean;
  onChange: (scheduled: boolean) => void;
  disabled?: boolean;
  nowLabel?: string;
  laterLabel?: string;
}

export default function ScheduleToggle({ scheduled, onChange, disabled, nowLabel = 'Publish now', laterLabel = 'Schedule' }: ScheduleToggleProps) {
  return (
    <Tabs value={scheduled ? 'later' : 'now'} onValueChange={value => onChange(value === 'later')}>
      <TabsList variant="segmented" className="w-full">
        <TabsTrigger value="now" disabled={disabled}><Send />{nowLabel}</TabsTrigger>
        <TabsTrigger value="later" disabled={disabled}><Calendar />{laterLabel}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
