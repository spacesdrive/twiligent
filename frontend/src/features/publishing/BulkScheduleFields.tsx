import { Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldRow } from '@/components/DetailPanel';
import { fieldErrorId } from '@/lib/fieldIds';
import ScheduleHint from './ScheduleHint';
import ScheduleToggle from './ScheduleToggle';
import { BULK_INTERVAL_OPTIONS } from './publishConstants';
import { bulkScheduledTime } from './publishHelpers.ts';
import { intervalLabel } from './queueHelpers.ts';
import { todayInput } from './scheduleHelpers.ts';
import type { BulkSettings } from './publishHelpers.ts';
import type { BulkSettingsState } from './useBulkSettings';

interface BulkScheduleFieldsProps {
  settings: BulkSettings;
  setSetting: BulkSettingsState['setSetting'];
  pending: number;
  processing: boolean;
  error?: string;
}

const INTERVAL_ITEMS = BULK_INTERVAL_OPTIONS.map(option => ({ value: String(option.value), label: option.label }));

function SpreadOutFields({ settings, setSetting, pending, processing, error }: BulkScheduleFieldsProps) {
  const { startDate, startTime, interval } = settings;
  const firstPost = new Date(`${startDate}T${startTime}`);
  const describedBy = error ? fieldErrorId('bulk-when') : undefined;
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <FieldRow label="First post date" htmlFor="bulk-date">
          <Input
            id="bulk-date"
            type="date"
            value={startDate}
            onChange={e => setSetting('startDate', e.target.value)}
            min={todayInput()}
            disabled={processing}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
          />
        </FieldRow>
        <FieldRow label="First post time" htmlFor="bulk-time">
          <Input
            id="bulk-time"
            type="time"
            value={startTime}
            onChange={e => setSetting('startTime', e.target.value)}
            disabled={processing}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
          />
        </FieldRow>
      </div>
      {error && <p id={fieldErrorId('bulk-when')} className="-mt-2 text-sm text-danger"><span className="sr-only">Error: </span>{error}</p>}
      <ScheduleHint />
      <FieldRow label="Gap between posts" htmlFor="bulk-interval">
        <Select value={String(interval)} onValueChange={value => setSetting('interval', Number(value))} disabled={processing} items={INTERVAL_ITEMS}>
          <SelectTrigger id="bulk-interval" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {BULK_INTERVAL_OPTIONS.map(option => <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
      </FieldRow>
      {startDate && startTime && pending > 0 && (
        <Alert variant="info">
          <Info />
          <AlertDescription>
            {pending} posts from {firstPost.toLocaleString()}, {intervalLabel(interval)} apart. The last one goes out {bulkScheduledTime(firstPost, pending - 1, interval).toLocaleString()}.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}

export default function BulkScheduleFields(props: BulkScheduleFieldsProps) {
  const { settings, setSetting, pending, processing } = props;
  return (
    <div className="flex flex-col gap-4 border-t border-divider pt-5">
      <FieldRow label="When" group>
        <ScheduleToggle
          name="bulk-when"
          scheduled={settings.scheduleMode}
          onChange={scheduled => setSetting('scheduleMode', scheduled)}
          disabled={processing}
          nowLabel="Publish all now"
          laterLabel="Spread out"
        />
      </FieldRow>
      {settings.scheduleMode && <SpreadOutFields {...props} />}
      {!settings.scheduleMode && pending > 0 && (
        <Alert>
          <Info />
          <AlertDescription>{pending} files upload and publish one at a time. Instagram allows 100 posts per account every 24 hours.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
