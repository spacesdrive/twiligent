import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Server, Users } from 'lucide-react';
import SurfaceBox from '@/components/SurfaceBox';
import { ADMIN_EMAIL, adminMailto } from '@/lib/contact';
import SettingsSection from './SettingsSection';
import SchedulingSetupGuide from './SchedulingSetupGuide';
import type { GithubRepoSettings } from './useServerSettings';

interface HowItWorksStep {
  title: string;
  body: React.ReactNode;
  extra?: React.ReactNode;
}

interface StepsProps {
  steps: HowItWorksStep[];
}

export interface SchedulingSectionProps {
  github: GithubRepoSettings;
}

const HOW_IT_WORKS: HowItWorksStep[] = [
  { title: 'Schedule a post', body: 'In Publish, choose an account, the content type and the file, write the caption, pick Schedule, then a date and time, and choose Schedule post. The file uploads straight away.' },
  { title: 'The server publishes it', body: 'Within 15 minutes after the time you picked, the server publishes the post. Your browser can be closed and your computer can be off.' },
  { title: 'Keep the account connected', body: 'The post uses the Instagram account you picked. If that account is removed or its access expires before the time, the post fails and shows the reason under Publish, Scheduled posts. Refresh the account in Accounts if Instagram asks you to reconnect.' },
];

function Steps({ steps }: StepsProps) {
  return (
    <ol className="flex flex-col gap-4">
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-sunken font-mono text-caption font-medium text-ink-muted">{i + 1}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
            <p className="text-sm font-medium text-ink">{step.title}</p>
            <div className="text-sm text-ink-muted [&_a]:font-medium [&_a]:text-brand-text [&_a]:underline-offset-4 [&_a:hover]:underline [&_strong]:font-semibold [&_strong]:text-ink">{step.body}</div>
            {step.extra}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function SchedulingSection({ github }: SchedulingSectionProps) {
  const pendingStep: HowItWorksStep = {
    title: 'If a post stays Pending',
    body: <>A post still Pending 30 minutes after its time means the scheduler on this server is not running. Email the administrator at <a href={adminMailto('Scheduled posts are not publishing on Twiligent')}>{ADMIN_EMAIL}</a> with the time of the post. You can edit or delete a Pending post at any time.</>,
  };

  return (
    <SettingsSection
      id="scheduling"
      title="Scheduled publishing"
      description="How scheduled Instagram posts go out, and who needs to set anything up."
    >
      <SurfaceBox title="Who needs to set this up">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-field border border-line p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Users className="size-4 stroke-[1.75] text-ink-faint" />You sign in to this Twiligent</p>
            <p className="text-sm text-ink-muted">Nothing to set up. The server publishes your scheduled posts. You do not need GitHub, Supabase or any keys.</p>
          </div>
          <div className="flex flex-col gap-2 rounded-field border border-line p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Server className="size-4 stroke-[1.75] text-ink-faint" />You run your own Twiligent</p>
            <p className="text-sm text-ink-muted">Deploying the backend is enough; scheduling starts with it. The GitHub backup below is optional.</p>
            <Link to="/docs/self-host" className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-brand-text underline-offset-4 hover:underline">
              Self-hosting guide<ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </SurfaceBox>

      <SurfaceBox title="How it works for you">
        <Steps steps={[...HOW_IT_WORKS, pendingStep]} />
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-control bg-surface-sunken/60 px-3 py-2.5 text-small text-ink-muted">
          <Clock className="size-4 shrink-0 stroke-[1.75] text-ink-faint" />
          Instagram allows up to 100 posts per account in any 24 hours, including scheduled ones.
        </div>
      </SurfaceBox>

      <SchedulingSetupGuide
        owner={github.owner}
        repo={github.repo}
        onOwnerChange={github.setOwner}
        onRepoChange={github.setRepo}
        onSave={github.handleSave}
        saving={github.saving}
      />
    </SettingsSection>
  );
}
