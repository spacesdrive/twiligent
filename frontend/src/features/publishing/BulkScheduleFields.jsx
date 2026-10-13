import { Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldRow } from '@/components/DetailPanel';
import ScheduleHint from './ScheduleHint';
import ScheduleToggle from './ScheduleToggle';
import { BULK_INTERVAL_OPTIONS } from './publishConstants';
import { bulkScheduledTime } from './publishHelpers.js';
import { intervalLabel } from './queueHelpers.js';
import { utcDateInput } from './scheduleHelpers.js';

const INTERVAL_ITEMS = BULK_INTERVAL_OPTIONS.map(option => ({ value: String(option.value), label: option.label }));

function SpreadOutFields({ settings, setSetting, pending, processing }) {
  const { startDate, startTime, interval } = settings;
  const firstPost = new Date(`${startDate}T${startTime}`);
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={startDate} onChange={e => setSetting('startDate', e.target.value)} min={utcDateInput()} disabled={processing} aria-label="Start date" />
        <Input type="time" value={startTime} onChange={e => setSetting('startTime', e.target.value)} disabled={processing} aria-label="Start time" />
      </div>
      <ScheduleHint />
      <Select value={String(interval)} onValueChange={value => setSetting('interval', Number(value))} disabled={processing} items={INTERVAL_ITEMS}>
        <SelectTrigger className="w-full" aria-label="Interval"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {BULK_INTERVAL_OPTIONS.map(option => <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>)}
          </SelectGroup>
        </SelectContent>
      </Select>
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

export default function BulkScheduleFields({ settings, setSetting, pending, processing }) {
  const { scheduleMode } = settings;
  return (
    <div className="flex flex-col gap-4 border-t border-divider pt-5">
      <FieldRow label="When">
        <ScheduleToggle
          scheduled={scheduleMode}
          onChange={scheduled => setSetting('scheduleMode', scheduled)}
          disabled={processing}
          nowLabel="Publish all now"
          laterLabel="Spread out"
        />
      </FieldRow>
      {scheduleMode && <SpreadOutFields settings={settings} setSetting={setSetting} pending={pending} processing={processing} />}
      {!scheduleMode && pending > 0 && (
        <Alert>
          <Info />
          <AlertDescription>{pending} files upload and publish one at a time. Instagram allows 100 posts per account every 24 hours.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
