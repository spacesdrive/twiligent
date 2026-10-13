import { Calendar, Send } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ScheduleToggle({ scheduled, onChange, disabled, nowLabel = 'Publish now', laterLabel = 'Schedule' }) {
  return (
    <Tabs value={scheduled ? 'later' : 'now'} onValueChange={value => onChange(value === 'later')}>
      <TabsList variant="segmented" className="w-full">
        <TabsTrigger value="now" disabled={disabled}><Send />{nowLabel}</TabsTrigger>
        <TabsTrigger value="later" disabled={disabled}><Calendar />{laterLabel}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
