import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SurfaceBox from '@/components/SurfaceBox';
import { cn } from '@/lib/utils';
import { browserStorage, completedSteps, readProgress, repoBaseUrl, saveProgress } from './schedulingProgress';
import GithubRepoForm from './GithubRepoForm';
import SchedulingSetupSteps from './SchedulingSetupSteps';

function SetupNotes() {
  return (
    <div className="flex flex-col gap-2 rounded-field border border-line p-4">
      <p className="text-sm font-semibold text-ink">That is it</p>
      <p className="text-sm text-ink-muted">GitHub now checks every 15 minutes. You do not need to keep anything open. Two things to know:</p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-muted marker:text-ink-faint">
        <li>If nothing changes in your copy for 60 days, GitHub pauses the schedule and emails you. Repeat step 4 to switch it back on.</li>
        <li>If you made your copy private, GitHub's free minutes run out. Keep it public, or change the schedule in <code className="font-mono text-small text-ink">.github/workflows/publish-scheduled.yml</code> to every 30 minutes.</li>
      </ul>
    </div>
  );
}

export default function SchedulingSetupGuide({ owner, repo, onOwnerChange, onRepoChange, onSave, saving }) {
  const [done, setDone] = useState(() => readProgress(browserStorage));

  useEffect(() => {
    saveProgress(browserStorage, done);
  }, [done]);

  const toggle = key => () => setDone(prev => ({ ...prev, [key]: !prev[key] }));
  const user = owner.trim();
  const base = repoBaseUrl(owner, repo);
  const completed = completedSteps(done);
  // members never need these steps; the guide opens only once someone has started
  const [open, setOpen] = useState(() => completed > 0 || Boolean(user));

  return (
    <SurfaceBox
      title="Backup scheduler on GitHub"
      subheader="Optional, for administrators running their own Twiligent. About 5 minutes."
      secondary={(
        <Button variant="ghost" size="sm" onClick={() => setOpen(isOpen => !isOpen)} aria-expanded={open} aria-controls="gh-guide-steps">
          {open ? 'Hide steps' : 'Show steps'}
          <ChevronDown data-icon="inline-end" className={cn('transition-transform duration-(--duration-base)', open && 'rotate-180')} />
        </Button>
      )}
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-ink-muted">
          A second copy of the publisher that runs on GitHub every 15 minutes, for free, so posts still go out if the server is ever paused. Step 2 needs the secret key of the Supabase project behind this Twiligent, which only its administrator has. If you only sign in here, skip this: the server already publishes your posts.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" render={<Link to="/docs/self-host/github" />}>
            <BookOpen data-icon="inline-start" />
            Read the full guide
          </Button>
          {completed > 0 && <span className="text-small text-ink-faint tabular-nums">{completed} of 5 done</span>}
        </div>

        {open && (
          <div id="gh-guide-steps" className="flex flex-col gap-5">
            <GithubRepoForm
              owner={owner}
              repo={repo}
              onOwnerChange={onOwnerChange}
              onRepoChange={onRepoChange}
              onSave={onSave}
              saving={saving}
              canSave={Boolean(user)}
            />
            <SchedulingSetupSteps done={done} toggle={toggle} base={base} />
            <SetupNotes />
          </div>
        )}
      </div>
    </SurfaceBox>
  );
}
