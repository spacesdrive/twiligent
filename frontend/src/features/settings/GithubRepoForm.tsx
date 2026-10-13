import React from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

export default function GithubRepoForm({ owner, repo, onOwnerChange, onRepoChange, onSave, saving, canSave }) {
  return (
    <form onSubmit={onSave} className="flex flex-col gap-2 rounded-field bg-surface-sunken/60 p-4">
      <label htmlFor="gh-user" className="text-sm font-medium text-ink">Your GitHub username</label>
      <p className="text-caption text-ink-faint">Type it once and every button below opens the right page in your GitHub.</p>
      <div className="flex flex-wrap gap-2">
        <Input id="gh-user" value={owner} onChange={e => onOwnerChange(e.target.value)} placeholder="your-github-username" autoComplete="off" className="max-w-xs flex-1 bg-surface-raised" />
        <Button type="submit" variant="outline" disabled={saving || !canSave}>
          {saving ? <Spinner className="size-4" /> : <Save data-icon="inline-start" />}
          Save
        </Button>
      </div>
      <details className="text-caption text-ink-faint">
        <summary className="cursor-pointer select-none">Renamed your copy?</summary>
        <div className="mt-2 flex items-center gap-2">
          <label htmlFor="gh-repo" className="shrink-0">Repository name</label>
          <Input id="gh-repo" value={repo} onChange={e => onRepoChange(e.target.value)} placeholder="twiligent" autoComplete="off" className="h-(--control-h-sm) max-w-48 bg-surface-raised" />
        </div>
      </details>
    </form>
  );
}
