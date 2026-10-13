import React, { useEffect, useState } from 'react';
import { GitFork, KeyRound, Lock, Power, PlayCircle, Check, Copy, ExternalLink, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import SurfaceBox from '@/components/SurfaceBox';
import { cn } from '@/lib/utils';

const UPSTREAM_REPO = 'spacesdrive/twiligent';
const SUPABASE_KEYS_URL = 'https://supabase.com/dashboard/project/_/settings/api-keys';
const SUPABASE_URL_PAGE = 'https://supabase.com/dashboard/project/_/integrations/data_api/overview';
const PROGRESS_KEY = 'twiligent.schedulingSetup.done';

function readProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch { return {}; }
}

function CopyChip({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); }
      }}
      className="inline-flex h-7 items-center gap-1.5 rounded-control border border-line-control bg-surface px-2.5 font-mono text-small text-ink transition-colors hover:bg-surface-hover"
      aria-label={copied ? `${text} copied` : `Copy ${text}`}
    >
      {text}
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5 text-ink-faint" />}
    </button>
  );
}

function LinkButton({ href, children, disabled, variant = 'outline' }) {
  if (disabled) {
    return <Button variant={variant} size="sm" disabled>{children}</Button>;
  }
  return (
    <Button variant={variant} size="sm" render={<a href={href} target="_blank" rel="noopener noreferrer" />}>
      {children}
      <ExternalLink data-icon="inline-end" />
    </Button>
  );
}

function Step({ number, icon, title, done, onToggle, children, check }) {
  const Icon = icon;
  return (
    <li className={cn('flex gap-4 rounded-card border p-4 transition-colors', done ? 'border-success/30 bg-success-soft/40' : 'border-line')}>
      <div className="flex flex-col items-center gap-2">
        <span className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          done ? 'bg-success text-ink-inverse' : 'bg-surface-sunken text-ink-muted',
        )}>
          {done ? <Check className="size-4" strokeWidth={2.5} /> : <Icon className="size-4 stroke-[1.75]" />}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-semibold text-ink"><span className="text-ink-faint">Step {number}. </span>{title}</p>
          <label className="flex cursor-pointer items-center gap-2 text-small text-ink-muted select-none">
            <input type="checkbox" checked={done} onChange={onToggle} className="size-4 accent-[var(--brand)]" />
            Done
          </label>
        </div>
        <div className="flex flex-col gap-3 text-sm text-ink-muted [&_strong]:font-semibold [&_strong]:text-ink">{children}</div>
        {check && (
          <p className="flex items-start gap-1.5 text-small text-success">
            <Check className="mt-0.5 size-3.5 shrink-0" />
            <span><span className="font-semibold">It worked if</span> {check}</span>
          </p>
        )}
      </div>
    </li>
  );
}

export default function SchedulingSetupGuide({ owner, repo, onOwnerChange, onRepoChange, onSave, saving }) {
  const [done, setDone] = useState(readProgress);

  useEffect(() => {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(done)); } catch { /* progress is a convenience only */ }
  }, [done]);

  const toggle = key => () => setDone(prev => ({ ...prev, [key]: !prev[key] }));
  const user = owner.trim();
  const name = (repo || 'twiligent').trim();
  const base = user ? `https://github.com/${user}/${name}` : null;
  const completed = ['fork', 'supabase', 'secrets', 'enable', 'test'].filter(k => done[k]).length;

  return (
    <SurfaceBox
      title="Set up your own scheduling with GitHub"
      subheader="About 5 minutes. You need a free GitHub account and access to the Supabase project this Twiligent uses."
      secondary={<span className="text-small text-ink-faint tabular-nums">{completed} of 5 done</span>}
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-ink-muted">
          GitHub will check your scheduled posts every 15 minutes and publish the ones that are due, for free. This is a backup for the server, so posts still go out if the server is ever paused. You do this once.
        </p>

        <form onSubmit={onSave} className="flex flex-col gap-2 rounded-field bg-surface-sunken/60 p-4">
          <label htmlFor="gh-user" className="text-sm font-medium text-ink">Your GitHub username</label>
          <p className="text-caption text-ink-faint">Type it once and every button below opens the right page in your GitHub.</p>
          <div className="flex flex-wrap gap-2">
            <Input id="gh-user" value={owner} onChange={e => onOwnerChange(e.target.value)} placeholder="your-github-username" autoComplete="off" className="max-w-xs flex-1 bg-surface-raised" />
            <Button type="submit" variant="outline" disabled={saving || !user}>
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

        <ol className="flex flex-col gap-3">
          <Step
            number={1}
            icon={GitFork}
            title="Make your own copy of Twiligent on GitHub"
            done={!!done.fork}
            onToggle={toggle('fork')}
            check="you see the twiligent repository under your own GitHub username."
          >
            <p>Open the Twiligent repository and choose <strong>Fork</strong>, then <strong>Create fork</strong>. Keep it public: GitHub runs public repositories for free.</p>
            <div><LinkButton href={`https://github.com/${UPSTREAM_REPO}/fork`}>Fork on GitHub</LinkButton></div>
          </Step>

          <Step
            number={2}
            icon={KeyRound}
            title="Copy two values from Supabase"
            done={!!done.supabase}
            onToggle={toggle('supabase')}
            check="you have the project URL and the secret key ready to paste."
          >
            <p><strong>Project URL.</strong> In Supabase, open your project, then <strong>Integrations, Data API</strong>. It looks like <code className="font-mono text-small text-ink">https://abcdefgh.supabase.co</code>.</p>
            <p><strong>Secret key.</strong> Open <strong>Settings, API Keys</strong> and copy a secret key (it starts with <code className="font-mono text-small text-ink">sb_secret_</code>). If your project only shows legacy keys, copy <strong>service_role</strong> instead.</p>
            <p className="flex items-start gap-1.5 text-small text-warning"><Lock className="mt-0.5 size-3.5 shrink-0" />The secret key can read and change all your data. Paste it only into GitHub secrets in the next step, never into code, chat or email.</p>
            <div className="flex flex-wrap gap-2">
              <LinkButton href={SUPABASE_URL_PAGE}>Open Data API</LinkButton>
              <LinkButton href={SUPABASE_KEYS_URL}>Open API Keys</LinkButton>
            </div>
          </Step>

          <Step
            number={3}
            icon={Lock}
            title="Save the two values as secrets in your copy"
            done={!!done.secrets}
            onToggle={toggle('secrets')}
            check="both names appear in the Repository secrets list."
          >
            <p>On the secrets page choose <strong>New repository secret</strong>. Type the name exactly as shown, paste the value, and choose <strong>Add secret</strong>. Do it twice:</p>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2"><CopyChip text="SUPABASE_URL" /><span className="text-small">with the project URL</span></div>
              <div className="flex flex-wrap items-center gap-2"><CopyChip text="SUPABASE_SERVICE_KEY" /><span className="text-small">with the secret key</span></div>
            </div>
            <div><LinkButton href={base ? `${base}/settings/secrets/actions` : ''} disabled={!base}>{base ? 'Open secrets page' : 'Enter your GitHub username first'}</LinkButton></div>
          </Step>

          <Step
            number={4}
            icon={Power}
            title="Switch on the publisher"
            done={!!done.enable}
            onToggle={toggle('enable')}
            check="Instagram Scheduled Publisher is listed on the left with no disabled warning."
          >
            <p>GitHub switches workflows off in new copies. Open the <strong>Actions</strong> tab and choose <strong>I understand my workflows, go ahead and enable them</strong>. Then choose <strong>Instagram Scheduled Publisher</strong> in the list on the left, and if a yellow banner says it is disabled, choose <strong>Enable workflow</strong>.</p>
            <div><LinkButton href={base ? `${base}/actions` : ''} disabled={!base}>{base ? 'Open Actions' : 'Enter your GitHub username first'}</LinkButton></div>
          </Step>

          <Step
            number={5}
            icon={PlayCircle}
            title="Run it once to test"
            done={!!done.test}
            onToggle={toggle('test')}
            check="the run shows a green tick after about a minute. The log saying “No posts due for publishing” is fine."
          >
            <p>On the publisher page choose <strong>Run workflow</strong>, then the green <strong>Run workflow</strong> button. Refresh the page after a few seconds and open the new run.</p>
            <p>A red cross with <strong>Missing SUPABASE_URL or SUPABASE_SERVICE_KEY</strong> means a secret name is misspelled; fix it in step 3. Any other red cross usually means the secret key was pasted incompletely.</p>
            <div><LinkButton href={base ? `${base}/actions/workflows/publish-scheduled.yml` : ''} disabled={!base}>{base ? 'Open the publisher' : 'Enter your GitHub username first'}</LinkButton></div>
          </Step>
        </ol>

        <div className="flex flex-col gap-2 rounded-field border border-line p-4">
          <p className="text-sm font-semibold text-ink">That is it</p>
          <p className="text-sm text-ink-muted">GitHub now checks every 15 minutes. You do not need to keep anything open. Two things to know:</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-muted marker:text-ink-faint">
            <li>If nothing changes in your copy for 60 days, GitHub pauses the schedule and emails you. Repeat step 4 to switch it back on.</li>
            <li>If you made your copy private, GitHub's free minutes run out. Keep it public, or ask your administrator to lower the frequency to every 30 minutes.</li>
          </ul>
        </div>
      </div>
    </SurfaceBox>
  );
}
