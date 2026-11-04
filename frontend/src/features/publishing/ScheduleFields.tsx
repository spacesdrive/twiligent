import { Input } from '@/components/ui/input';
import { FieldRow } from '@/components/DetailPanel';
import { fieldErrorId } from '@/lib/fieldIds';
import ScheduleHint from './ScheduleHint';
import ScheduleToggle from './ScheduleToggle';
import { todayInput } from './scheduleHelpers.ts';
import type { SinglePostFields } from './publishHelpers.ts';
import type { SinglePostForm } from './useSinglePostForm';

interface ScheduleFieldsProps {
  fields: SinglePostFields;
  setField: SinglePostForm['setField'];
  error?: string;
}

export default function ScheduleFields({ fields, setField, error }: ScheduleFieldsProps) {
  const describedBy = error ? fieldErrorId('post-when') : undefined;
  return (
    <div className="flex flex-col gap-4 border-t border-divider pt-5">
      <FieldRow label="When" group>
        <ScheduleToggle name="post-when" scheduled={fields.scheduleMode} onChange={scheduled => setField('scheduleMode', scheduled)} />
      </FieldRow>
      {fields.scheduleMode && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <FieldRow label="Date" htmlFor="post-date">
              <Input
                id="post-date"
                type="date"
                value={fields.scheduleDate}
                onChange={e => setField('scheduleDate', e.target.value)}
                min={todayInput()}
                aria-describedby={describedBy}
                aria-invalid={error ? true : undefined}
              />
            </FieldRow>
            <FieldRow label="Time" htmlFor="post-time">
              <Input
                id="post-time"
                type="time"
                value={fields.scheduleTime}
                onChange={e => setField('scheduleTime', e.target.value)}
                aria-describedby={describedBy}
                aria-invalid={error ? true : undefined}
              />
            </FieldRow>
          </div>
          {error && <p id={fieldErrorId('post-when')} className="-mt-2 text-sm text-danger"><span className="sr-only">Error: </span>{error}</p>}
          <ScheduleHint />
        </>
      )}
    </div>
  );
}
