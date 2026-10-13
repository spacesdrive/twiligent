import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ChoiceCard from '@/components/ChoiceCard';
import InstagramTesterNotice from '@/components/InstagramTesterNotice';
import { PLATFORM_META } from '@/lib/accounts';
import { PLATFORM_CHOICES, platformChoiceTitle } from './platformChoices';
import YouTubeAccountFields from './YouTubeAccountFields';
import RedditAccountFields from './RedditAccountFields';
import AddAccountFooter from './AddAccountFooter';

function PlatformPicker({ onSelect }) {
  return (
    <div role="radiogroup" aria-label="Platform" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {PLATFORM_CHOICES.map(choice => (
        <ChoiceCard
          key={choice.value}
          icon={<choice.Icon />}
          title={PLATFORM_META[choice.value].label}
          description={choice.description}
          selected={false}
          onSelect={() => onSelect(choice.value)}
        />
      ))}
    </div>
  );
}

export default function AddAccountDialog({ flow }) {
  const { platform, channel, reddit } = flow;
  return (
    <Dialog open={flow.dialogOpen} onOpenChange={open => { if (!open) flow.closeDialog(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{platform ? platformChoiceTitle(platform) : 'Add an account'}</DialogTitle>
          <DialogDescription>
            {platform ? 'Fill in the details, review, then add.' : 'Choose the platform you want to track.'}
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
          />
        )}

        {platform === 'instagram' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-muted">
              We open Instagram so you can sign in and approve access. When you finish, Instagram sends you back here and the account appears in the list. The account must be an Instagram Business or Creator account; personal accounts cannot be connected.
            </p>
            <InstagramTesterNotice />
          </div>
        )}

        {platform === 'reddit' && (
          <RedditAccountFields
            username={reddit.username}
            cookie={reddit.cookie}
            onUsernameChange={reddit.setUsername}
            onCookieChange={reddit.setCookie}
            onSubmit={flow.redditAdd.handleAddReddit}
          />
        )}

        <AddAccountFooter flow={flow} />
      </DialogContent>
    </Dialog>
  );
}
