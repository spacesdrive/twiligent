import React, { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ChoiceCard from '@/components/ChoiceCard';
import InstagramTesterNotice from '@/components/InstagramTesterNotice';
import { PLATFORM_META } from '@/lib/accounts';
import { PLATFORM_CHOICES, platformChoiceTitle } from './platformChoices';
import YouTubeAccountFields from './YouTubeAccountFields';
import RedditAccountFields from './RedditAccountFields';
import AddAccountFooter from './AddAccountFooter';
import type { AddAccountFlow } from './useAddAccount';
import type { Platform } from '@shared/types/domain.ts';

interface PlatformPickerProps {
  onSelect: (platform: Platform) => void;
}

export interface AddAccountDialogProps {
  flow: AddAccountFlow;
}

const STEP_DESCRIPTION: Record<Platform, string> = {
  youtube: 'Find the channel to check it is the right one, then add it.',
  instagram: 'Instagram opens so you can sign in and approve access.',
  reddit: 'Add the username and the session cookie from your browser.',
};

// each card moves on to its platform's step, so these are plain buttons, not radios
function PlatformPicker({ onSelect }: PlatformPickerProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-platform-picker>
      {PLATFORM_CHOICES.map(choice => (
        <ChoiceCard
          key={choice.value}
          icon={<choice.Icon />}
          title={PLATFORM_META[choice.value].label}
          description={choice.description}
          onSelect={() => onSelect(choice.value)}
        />
      ))}
    </div>
  );
}

export default function AddAccountDialog({ flow }: AddAccountDialogProps) {
  const { platform, channel, reddit } = flow;
  const contentRef = useRef<HTMLDivElement>(null);
  const firstStep = useRef(true);

  // the button that was pressed disappears with its step, so focus moves to the start of the new step
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    const content = contentRef.current;
    if (!content) return;
    const frame = requestAnimationFrame(() => {
      if (platform === 'instagram') document.getElementById('add-account-primary')?.focus();
      else if (!platform) content.querySelector<HTMLButtonElement>('[data-platform-picker] button')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [platform]);

  return (
    <Dialog open={flow.dialogOpen} onOpenChange={open => { if (!open) flow.closeDialog(); }}>
      <DialogContent ref={contentRef} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{platform ? platformChoiceTitle(platform) : 'Add account'}</DialogTitle>
          <DialogDescription>
            {platform ? STEP_DESCRIPTION[platform] : 'Choose the platform of the account.'}
          </DialogDescription>
        </DialogHeader>

        {!platform && <PlatformPicker onSelect={flow.setPlatform} />}

        {platform === 'youtube' && (
          <YouTubeAccountFields
            input={channel.input}
            onInputChange={channel.changeInput}
            onResolve={channel.handleResolve}
            resolving={channel.resolving}
            resolved={channel.resolved}
            error={flow.errorFor('channel')}
          />
        )}

        {platform === 'instagram' && (
          <div className="flex flex-col gap-4">
            <p className="max-w-prose text-body text-ink-muted">
              When you finish, Instagram sends you back here and the account appears in the list. The account must be an Instagram Business or Creator account; personal accounts cannot be connected.
            </p>
            <InstagramTesterNotice />
          </div>
        )}

        {platform === 'reddit' && (
          <RedditAccountFields
            username={reddit.username}
            cookie={reddit.cookie}
            onUsernameChange={reddit.setUsername}
            onUsernameBlur={reddit.tidyUsername}
            onCookieChange={reddit.setCookie}
            onSubmit={flow.redditAdd.handleAddReddit}
            usernameError={flow.errorFor('username')}
            cookieError={flow.errorFor('cookie')}
          />
        )}

        {flow.submitError && (
          <Alert variant="destructive" role="alert">
            <AlertCircle />
            <AlertDescription><span className="sr-only">Error: </span>{flow.submitError}</AlertDescription>
          </Alert>
        )}

        <AddAccountFooter flow={flow} />
      </DialogContent>
    </Dialog>
  );
}
