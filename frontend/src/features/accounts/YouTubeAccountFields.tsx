import React from 'react';
import { CheckCircle2, Link2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { FieldRow } from '@/components/DetailPanel';
import { AccountAvatar } from '@/components/platform';
import { fmtNum } from '../../utils/formatters';
import type { YouTubeChannelData } from '@shared/types/youtube.ts';

interface ResolvedChannelProps {
  channel: YouTubeChannelData;
}

export interface YouTubeAccountFieldsProps {
  input: string;
  onInputChange: (value: string) => void;
  onResolve: () => void;
  resolving: boolean;
  resolved: YouTubeChannelData | null;
  error?: string;
}

function ResolvedChannel({ channel }: ResolvedChannelProps) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-success/30 bg-success-soft p-3">
      <AccountAvatar account={{ platform: 'youtube', title: channel.title, thumbnail: channel.thumbnails?.medium || channel.thumbnails?.default }} size="lg" decorative />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <span className="truncate">{channel.title}</span>
          <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
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

// Enter or Find looks the channel up; the dialog's Add channel button adds it
export default function YouTubeAccountFields({ input, onInputChange, onResolve, resolving, resolved, error }: YouTubeAccountFieldsProps) {
  return (
    <form noValidate onSubmit={e => { e.preventDefault(); onResolve(); }} className="flex flex-col gap-4">
      <FieldRow label="Channel" hint="A channel link, an @handle or a channel ID that starts with UC." htmlFor="yt-channel" error={error}>
        <div className="relative">
          <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <Input
            id="yt-channel"
            className="h-(--control-h-lg) pl-9"
            value={input}
            onChange={e => onInputChange(e.target.value)}
            placeholder="youtube.com/@channel"
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
        </div>
      </FieldRow>
      <Button type="submit" variant="outline" className="self-start" disabled={resolving}>
        {resolving ? <Spinner className="size-4" /> : <Search data-icon="inline-start" />}
        {resolving ? 'Finding the channel' : 'Find the channel'}
      </Button>

      {/* mounted before a result, so finding the channel is announced */}
      <div role="status" aria-live="polite">
        {resolved && <ResolvedChannel channel={resolved} />}
        {resolved && <span className="sr-only">Found {resolved.title}. Add it with the Add channel button.</span>}
      </div>
    </form>
  );
}
