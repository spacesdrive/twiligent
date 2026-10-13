import { Input } from '@/components/ui/input';
import { FieldRow } from '@/components/DetailPanel';
import ScheduleHint from './ScheduleHint';
import ScheduleToggle from './ScheduleToggle';
import { utcDateInput } from './scheduleHelpers.ts';
import type { SinglePostFields } from './publishHelpers.ts';
import type { SinglePostForm } from './useSinglePostForm';

interface ScheduleFieldsProps {
  fields: SinglePostFields;
  setField: SinglePostForm['setField'];
}

export default function ScheduleFields({ fields, setField }: ScheduleFieldsProps) {
  return (
    <div className="flex flex-col gap-4 border-t border-divider pt-5">
      <FieldRow label="When">
        <ScheduleToggle scheduled={fields.scheduleMode} onChange={scheduled => setField('scheduleMode', scheduled)} />
      </FieldRow>
      {fields.scheduleMode && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={fields.scheduleDate} onChange={e => setField('scheduleDate', e.target.value)} min={utcDateInput()} aria-label="Schedule date" />
            <Input type="time" value={fields.scheduleTime} onChange={e => setField('scheduleTime', e.target.value)} aria-label="Schedule time" />
          </div>
          <ScheduleHint />
        </>
      )}
    </div>
  );
}
