import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { FieldRow } from '@/components/DetailPanel';
import CategoryPicker from './CategoryPicker';
import type { TrackedEditor } from './useTrackedEditor';

export interface EditTrackedDialogProps {
  editor: TrackedEditor;
  categories: string[];
}

export default function EditTrackedDialog({ editor, categories }: EditTrackedDialogProps) {
  const { editItem, fields, setField, saving } = editor;
  return (
    <Dialog open={Boolean(editItem)} onOpenChange={open => { if (!open && !saving) editor.setEditItem(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit tracked video</DialogTitle>
          <DialogDescription className="line-clamp-2">{editItem?.title || editItem?.url}</DialogDescription>
        </DialogHeader>
        <form id="edit-tracked-form" onSubmit={editor.handleSaveEdit} noValidate className="flex flex-col gap-5">
          <FieldRow label="Label" optional htmlFor="edit-label">
            <Input id="edit-label" value={fields.label} onChange={e => setField('label', e.target.value)} placeholder="Launch teaser" />
          </FieldRow>
          <FieldRow label="Category" optional htmlFor="edit-category">
            <Input id="edit-category" value={fields.category} onChange={e => setField('category', e.target.value)} placeholder="Campaign A" />
            <CategoryPicker categories={categories} onPick={category => setField('category', category)} />
          </FieldRow>

          {editor.saveError && (
            <Alert variant="destructive" role="alert">
              <AlertCircle />
              <AlertDescription><span className="sr-only">Error: </span>{editor.saveError}</AlertDescription>
            </Alert>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => editor.setEditItem(null)} disabled={saving}>Cancel</Button>
          <Button type="submit" form="edit-tracked-form" disabled={saving}>
            {saving && <Spinner className="size-4" />}
            {saving ? 'Saving' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
