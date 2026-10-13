import React from 'react';
import { CheckCircle2, Link2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { FieldRow } from '@/components/DetailPanel';
import { AccountAvatar } from '@/components/platform';
import { fmtNum } from '../../utils/formatters';

function ResolvedChannel({ channel }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-success/30 bg-success-soft p-3">
      <AccountAvatar account={{ platform: 'youtube', title: channel.title, thumbnail: channel.thumbnails?.medium || channel.thumbnails?.default }} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <span className="truncate">{channel.title}</span>
          <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Channel found" />
        </p>
        <p className="text-caption text-ink-muted">{channel.customUrl}</p>
        {channel.subscriberCount != null && (
          <p className="mt-0.5 text-caption text-ink-muted">
            {fmtNum(channel.subscriberCount)} subscribers, {fmtNum(channel.videoCount)} videos
          </p>
        )}
      </div>
    </div>
  );
}

export default function YouTubeAccountFields({ input, onInputChange, onResolve, resolving, resolved }) {
  return (
    <div className="flex flex-col gap-4">
      <FieldRow label="Channel" hint="A channel URL, an @handle or a channel ID that starts with UC." htmlFor="yt-channel">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
            <Input
              id="yt-channel"
              className="h-(--control-h-lg) pl-9"
              value={input}
              onChange={e => onInputChange(e.target.value)}
              placeholder="youtube.com/@channel"
              onKeyDown={e => e.key === 'Enter' && onResolve()}
              autoFocus
            />
          </div>
          <Button variant="outline" size="lg" onClick={onResolve} disabled={resolving || !input.trim()}>
            {resolving ? <Spinner className="size-4" /> : <Search data-icon="inline-start" />}
            Find
          </Button>
        </div>
      </FieldRow>

      {resolved && <ResolvedChannel channel={resolved} />}
    </div>
  );
}
