import React from 'react';
import { Mail, ExternalLink, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ADMIN_EMAIL, adminMailto, INSTAGRAM_TESTER_INVITES_URL } from '@/lib/contact';
import { cn } from '@/lib/utils';

const REQUEST_BODY = [
  'Hi,',
  '',
  'Please add my Instagram account as an Instagram tester for Twiligent.',
  '',
  'Instagram username: @',
  'Account type (Business or Creator): ',
  '',
  'Thanks',
].join('\n');

// While the Meta app is in development mode, Instagram only lets accepted testers sign in.
export interface InstagramTesterNoticeProps {
  compact?: boolean;
  className?: string;
}

interface TesterStep {
  title: string;
  body: React.ReactNode;
}

export default function InstagramTesterNotice({ compact = false, className }: InstagramTesterNoticeProps) {
  const steps: TesterStep[] = [
    {
      title: 'Ask to be added as a tester',
      body: (
        <>
          Email the administrator at{' '}
          <a href={adminMailto('Instagram tester request for Twiligent', REQUEST_BODY)} className="font-medium text-brand-text underline-offset-4 hover:underline">
            {ADMIN_EMAIL}
          </a>{' '}
          with your Instagram username. Only Business and Creator accounts can be added.
        </>
      ),
    },
    {
      title: 'Accept the invite on Instagram',
      body: (
        <>
          Once you are added, sign in to Instagram on the web and open{' '}
          <a href={INSTAGRAM_TESTER_INVITES_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-text underline-offset-4 hover:underline">
            Apps and websites, Tester invites
          </a>
          , then accept the Twiligent invite. In the Instagram app it is under Settings and privacy, Website permissions, Apps and websites, Tester invites.
        </>
      ),
    },
    {
      title: 'Connect your account here',
      body: 'Come back, choose Continue to Instagram, and approve the requested permissions.',
    },
  ];

  return (
    <div className={cn('flex flex-col gap-3 rounded-field border border-info/30 bg-info-soft p-4', className)}>
      <div className="flex items-start gap-2.5">
        <UserCheck className="mt-0.5 size-4 shrink-0 stroke-[1.75] text-info" />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-ink">Your Instagram account needs tester access first</p>
          <p className="text-small text-ink-muted">
            The Twiligent Meta app is in development mode, so Instagram only lets accounts that are added as testers connect. Without it, Instagram shows an error or a blank page when you sign in.
          </p>
        </div>
      </div>
      {!compact && (
        <ol className="flex flex-col gap-2.5 pl-6.5">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-raised font-mono text-caption font-medium text-ink-muted">{i + 1}</span>
              <div className="flex flex-col gap-0.5">
                <p className="text-small font-medium text-ink">{step.title}</p>
                <p className="text-small text-ink-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap gap-2 pl-6.5">
        <Button size="sm" variant="outline" render={<a href={adminMailto('Instagram tester request for Twiligent', REQUEST_BODY)} />}>
          <Mail data-icon="inline-start" />Email the administrator
        </Button>
        <Button size="sm" variant="ghost" render={<a href={INSTAGRAM_TESTER_INVITES_URL} target="_blank" rel="noopener noreferrer" />}>
          <ExternalLink data-icon="inline-start" />Open tester invites
        </Button>
      </div>
    </div>
  );
}
