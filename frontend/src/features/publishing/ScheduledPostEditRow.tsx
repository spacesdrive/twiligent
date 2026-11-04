import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { TableCell, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { FieldRow } from '@/components/DetailPanel';
import { CAPTION_LIMIT } from './publishConstants';
import { todayInput } from './scheduleHelpers.ts';
import type { ScheduledPostEditor } from './useScheduledPostEdit';

interface ScheduledPostEditRowProps {
  editor: ScheduledPostEditor;
}

export default function ScheduledPostEditRow({ editor }: ScheduledPostEditRowProps) {
  const { draft, setDraftField, savingEdit } = editor;
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={9} className="whitespace-normal bg-surface-sunken/40 p-0">
        <form
          noValidate
          onSubmit={e => { e.preventDefault(); editor.handleSaveEdit(); }}
          onKeyDown={e => { if (e.key === 'Escape') editor.cancelEdit(); }}
          className="flex flex-col gap-3 p-4"
        >
          <FieldRow label="Caption" htmlFor="edit-post-caption" hint={`${draft.caption.length.toLocaleString()} of ${CAPTION_LIMIT.toLocaleString()} characters`}>
            <Textarea id="edit-post-caption" value={draft.caption} onChange={e => setDraftField('caption', e.target.value)} rows={3} maxLength={CAPTION_LIMIT} autoFocus />
          </FieldRow>
          <div className="flex flex-wrap gap-3">
            <FieldRow label="Date" htmlFor="edit-post-date" error={editor.errorFor('date')} className="w-44">
              <Input id="edit-post-date" type="date" value={draft.date} onChange={e => setDraftField('date', e.target.value)} min={todayInput()} />
            </FieldRow>
            <FieldRow label="Time" htmlFor="edit-post-time" error={editor.errorFor('time')} className="w-44">
              <Input id="edit-post-time" type="time" value={draft.time} onChange={e => setDraftField('time', e.target.value)} />
            </FieldRow>
          </div>
          {editor.saveError && <p className="text-sm text-danger" role="alert"><span className="sr-only">Error: </span>{editor.saveError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={editor.cancelEdit}>Cancel</Button>
            <Button type="submit" size="sm" disabled={savingEdit}>
              {savingEdit ? <Spinner className="size-3.5" /> : <CheckCircle2 data-icon="inline-start" />}
              {savingEdit ? 'Saving' : 'Save changes'}
            </Button>
          </div>
        </form>
      </TableCell>
    </TableRow>
  );
}
