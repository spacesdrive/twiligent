import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { TableCell, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { CAPTION_LIMIT } from './publishConstants';
import { utcDateInput } from './scheduleHelpers.ts';

export default function ScheduledPostEditRow({ editor }) {
  const { draft, setDraftField, savingEdit } = editor;
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={9} className="whitespace-normal bg-surface-sunken/40 p-0">
        <div className="flex flex-col gap-3 p-4">
          <Textarea value={draft.caption} onChange={e => setDraftField('caption', e.target.value)} rows={3} aria-label="Caption" maxLength={CAPTION_LIMIT} />
          <p className="text-caption text-ink-faint tabular-nums">{draft.caption.length.toLocaleString()} / {CAPTION_LIMIT.toLocaleString()}</p>
          <div className="flex flex-wrap gap-2">
            <Input type="date" value={draft.date} onChange={e => setDraftField('date', e.target.value)} min={utcDateInput()} className="w-44" aria-label="Date" />
            <Input type="time" value={draft.time} onChange={e => setDraftField('time', e.target.value)} className="w-36" aria-label="Time" />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={editor.cancelEdit}>Cancel</Button>
            <Button size="sm" onClick={editor.handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? <Spinner className="size-3.5" /> : <CheckCircle2 data-icon="inline-start" />}
              {savingEdit ? 'Saving' : 'Save changes'}
            </Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}
