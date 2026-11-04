import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { FieldRow } from '@/components/DetailPanel';
import { PlatformBadge } from '@/components/platform';
import CategoryPicker from './CategoryPicker';
import type { AddTracked } from './useAddTracked';

interface LinkStatusProps {
  detectedType: 'youtube' | null;
}

// a found link is confirmed as soon as it is pasted; the region stays mounted so the confirmation is announced
function LinkStatus({ detectedType }: LinkStatusProps) {
  return (
    <div role="status" aria-live="polite">
      {detectedType && (
        <p className="flex items-center gap-1.5 text-small text-success">
          <PlatformBadge platform={detectedType} className="h-5" />
          YouTube video found
        </p>
      )}
    </div>
  );
}

export interface AddTrackedDialogProps {
  add: AddTracked;
  categories: string[];
}

export default function AddTrackedDialog({ add, categories }: AddTrackedDialogProps) {
  const { draft, detectedType, adding } = add;
  const { url } = draft;
  return (
    <Dialog open={add.open} onOpenChange={add.handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Track content</DialogTitle>
          <DialogDescription>Paste a YouTube video or Shorts link.</DialogDescription>
        </DialogHeader>
        <form id="track-form" onSubmit={add.handleAdd} noValidate className="flex flex-col gap-5">
          <FieldRow label="Link" htmlFor="track-url" error={add.urlError ?? undefined}>
            <Input
              id="track-url"
              type="url"
              inputMode="url"
              className="h-(--control-h-lg)"
              placeholder="https://"
              value={url}
              onChange={e => add.setDraftField('url', e.target.value)}
              onBlur={add.checkUrl}
              autoFocus
            />
          </FieldRow>
          <LinkStatus detectedType={detectedType} />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FieldRow label="Label" optional htmlFor="track-label">
              <Input id="track-label" placeholder="Launch teaser" value={draft.label} onChange={e => add.setDraftField('label', e.target.value)} />
            </FieldRow>
            <FieldRow label="Category" optional htmlFor="track-category">
              <Input id="track-category" placeholder="Campaign A" value={draft.category} onChange={e => add.setDraftField('category', e.target.value)} />
              <CategoryPicker categories={categories} onPick={category => add.setDraftField('category', category)} />
            </FieldRow>
          </div>

          {add.submitError && (
            <Alert variant="destructive" role="alert">
              <AlertCircle />
              <AlertDescription><span className="sr-only">Error: </span>{add.submitError}</AlertDescription>
            </Alert>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => add.handleOpenChange(false)} disabled={adding}>Cancel</Button>
          <Button type="submit" form="track-form" disabled={adding}>
            {adding && <Spinner className="size-4" />}
            {adding ? 'Fetching details' : 'Track content'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
