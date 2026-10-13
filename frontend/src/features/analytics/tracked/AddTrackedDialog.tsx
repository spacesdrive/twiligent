import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { FieldRow } from '@/components/DetailPanel';
import { PlatformBadge } from '@/components/platform';
import CategoryPicker from './CategoryPicker';

function LinkStatus({ url, detectedType }) {
  if (detectedType) {
    return (
      <p className="flex items-center gap-1.5 text-caption text-success">
        <PlatformBadge platform={detectedType} className="h-5" />
        {detectedType === 'youtube' ? 'YouTube video found' : 'Reddit post found'}
      </p>
    );
  }
  if (!url.trim()) return null;
  return <p className="text-caption text-danger">Error: only Reddit posts and YouTube videos can be tracked.</p>;
}

export default function AddTrackedDialog({ add, redditAccounts, categories }) {
  const { draft, detectedType, adding } = add;
  const { url } = draft;
  const accountItems = [
    { value: 'none', label: 'No account (public posts only)' },
    ...redditAccounts.map(account => ({ value: account.id, label: `u/${account.username}` })),
  ];
  return (
    <Dialog open={add.open} onOpenChange={add.handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Track content</DialogTitle>
          <DialogDescription>Paste a Reddit post or a YouTube video or Shorts link.</DialogDescription>
        </DialogHeader>
        <form id="track-form" onSubmit={add.handleAdd} className="flex flex-col gap-5">
          <FieldRow label="Link" htmlFor="track-url">
            <Input id="track-url" className="h-(--control-h-lg)" placeholder="https://" value={url} onChange={e => add.setDraftField('url', e.target.value)} autoFocus />
            <LinkStatus url={url} detectedType={detectedType} />
          </FieldRow>

          {detectedType === 'reddit' && (
            <FieldRow label="Fetch with account" hint="A session cookie helps Reddit accept requests from the server." htmlFor="track-account">
              <Select value={add.accountId} onValueChange={add.setAccountId} items={accountItems}>
                <SelectTrigger id="track-account" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">No account (public posts only)</SelectItem>
                    {redditAccounts.map(account => <SelectItem key={account.id} value={account.id}>u/{account.username}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FieldRow>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FieldRow label="Label" hint="Optional" htmlFor="track-label">
              <Input id="track-label" placeholder="Launch teaser" value={draft.label} onChange={e => add.setDraftField('label', e.target.value)} />
            </FieldRow>
            <FieldRow label="Category" hint="Optional" htmlFor="track-category">
              <Input id="track-category" placeholder="Campaign A" value={draft.category} onChange={e => add.setDraftField('category', e.target.value)} />
              <CategoryPicker categories={categories} onPick={category => add.setDraftField('category', category)} />
            </FieldRow>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => add.setOpen(false)} disabled={adding}>Cancel</Button>
          <Button type="submit" form="track-form" disabled={adding || !url.trim() || !detectedType}>
            {adding && <Spinner className="size-4" />}
            {adding ? 'Fetching details' : 'Track'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
