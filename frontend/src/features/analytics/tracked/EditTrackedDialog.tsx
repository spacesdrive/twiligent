import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { FieldRow } from '@/components/DetailPanel';
import { isRedditItem } from '../../../utils/trackedContent';
import CategoryPicker from './CategoryPicker';
import TrackedImageField from './TrackedImageField';

export default function EditTrackedDialog({ editor, categories }) {
  const { editItem, fields, setField, saving } = editor;
  const showRedditFields = editItem && isRedditItem(editItem);
  return (
    <Dialog open={Boolean(editItem)} onOpenChange={open => !open && editor.setEditItem(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit tracked item</DialogTitle>
          <DialogDescription className="line-clamp-2">{editItem?.title || editItem?.url}</DialogDescription>
        </DialogHeader>
        <form id="edit-tracked-form" onSubmit={editor.handleSaveEdit} className="flex flex-col gap-5">
          <FieldRow label="Label" htmlFor="edit-label">
            <Input id="edit-label" value={fields.label} onChange={e => setField('label', e.target.value)} placeholder="Launch teaser" />
          </FieldRow>
          <FieldRow label="Category" htmlFor="edit-category">
            <Input id="edit-category" value={fields.category} onChange={e => setField('category', e.target.value)} placeholder="Campaign A" />
            <CategoryPicker categories={categories} onPick={category => setField('category', category)} />
          </FieldRow>

          {showRedditFields && (
            <FieldRow
              label="Views"
              hint="Reddit does not report views through its API. Copy the number from the post's insights page. Leave empty to remove it."
              htmlFor="edit-views"
            >
              <Input id="edit-views" type="number" min="0" step="1" inputMode="numeric" value={fields.views} onChange={e => setField('views', e.target.value)} placeholder="12500" />
            </FieldRow>
          )}

          {showRedditFields && <TrackedImageField editor={editor} />}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => editor.setEditItem(null)} disabled={saving}>Cancel</Button>
          <Button type="submit" form="edit-tracked-form" disabled={saving || editor.uploading}>
            {saving && <Spinner className="size-4" />}
            {saving ? 'Saving' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
