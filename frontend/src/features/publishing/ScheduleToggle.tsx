import { Calendar, Send } from 'lucide-react';
import SegmentedChoice from '@/components/SegmentedChoice';

interface ScheduleToggleProps {
  name: string;
  scheduled: boolean;
  onChange: (scheduled: boolean) => void;
  disabled?: boolean;
  nowLabel?: string;
  laterLabel?: string;
}

type When = 'now' | 'later';

// a choice between two values, so it is a pair of radio buttons rather than tabs without panels
export default function ScheduleToggle({ name, scheduled, onChange, disabled, nowLabel = 'Publish now', laterLabel = 'Schedule' }: ScheduleToggleProps) {
  return (
    <SegmentedChoice<When>
      name={name}
      className="sm:w-full"
      options={[
        { value: 'now', label: nowLabel, icon: <Send /> },
        { value: 'later', label: laterLabel, icon: <Calendar /> },
      ]}
      value={scheduled ? 'later' : 'now'}
      onChange={value => onChange(value === 'later')}
      disabled={disabled}
    />
  );
}
