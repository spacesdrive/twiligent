import React from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { FieldRow } from '@/components/DetailPanel';

export interface GithubRepoFormProps {
  owner: string;
  repo: string;
  savedOwner: string;
  savedRepo: string;
  unsaved: boolean;
  ownerError: string | null;
  onOwnerChange: (value: string) => void;
  onOwnerBlur: () => void;
  onRepoChange: (value: string) => void;
  onSave: (e: React.FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}

// an explicit Save, because the guide's links follow the saved name; an Unsaved badge shows typing not yet saved
export default function GithubRepoForm({
  owner, repo, unsaved, ownerError, onOwnerChange, onOwnerBlur, onRepoChange, onSave, saving,
}: Omit<GithubRepoFormProps, 'savedOwner' | 'savedRepo'>) {
  return (
    <form onSubmit={onSave} noValidate className="flex flex-col gap-3 rounded-field bg-surface-sunken/60 p-4">
      <FieldRow
        label="Your GitHub username"
        htmlFor="gh-user"
        hint="Type it once and every button below opens the right page in your GitHub. A pasted profile address works too."
        error={ownerError ?? undefined}
      >
        <Input
          id="gh-user"
          value={owner}
          onChange={e => onOwnerChange(e.target.value)}
          onBlur={onOwnerBlur}
          placeholder="your-github-username"
          autoComplete="off"
          spellCheck={false}
          className="max-w-xs bg-surface-raised"
        />
      </FieldRow>
      <details className="text-small text-ink-muted">
        <summary className="cursor-pointer select-none">Renamed your copy?</summary>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label htmlFor="gh-repo" className="shrink-0">Repository name</label>
          <Input id="gh-repo" value={repo} onChange={e => onRepoChange(e.target.value)} placeholder="twiligent" autoComplete="off" className="max-w-48 bg-surface-raised" />
        </div>
      </details>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="outline" disabled={saving}>
          {saving ? <Spinner className="size-4" /> : <Save data-icon="inline-start" />}
          {saving ? 'Saving' : 'Save username'}
        </Button>
        {unsaved && <Badge variant="warning">Not saved yet</Badge>}
      </div>
    </form>
  );
}
