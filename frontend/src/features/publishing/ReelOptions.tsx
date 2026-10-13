import { Camera, Clock, Music, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FieldRow } from '@/components/DetailPanel';
import IconInput from './IconInput';
import type { SinglePostForm } from './useSinglePostForm';

interface ReelOptionsProps {
  form: SinglePostForm;
}

function CoverPicker({ form }: ReelOptionsProps) {
  const { coverFile, coverInputRef } = form;
  return (
    <FieldRow label="Cover image" hint="Optional JPEG.">
      {coverFile ? (
        <div className="flex items-center gap-3 rounded-control border border-line p-2">
          <img src={form.coverPreview as string} alt="Cover preview" className="size-10 rounded-sm object-cover" />
          <span className="min-w-0 flex-1 truncate text-small text-ink">{coverFile.name}</span>
          <Button variant="ghost" size="icon-xs" onClick={form.clearCover} aria-label="Remove cover"><X /></Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => coverInputRef.current?.click()} className="justify-start">
          <Camera data-icon="inline-start" />Choose a cover
        </Button>
      )}
      <input ref={coverInputRef} type="file" hidden accept="image/jpeg" onChange={form.handleCoverSelect} aria-label="Cover image" />
    </FieldRow>
  );
}

export default function ReelOptions({ form }: ReelOptionsProps) {
  const { fields, setField } = form;
  return (
    <div className="flex flex-col gap-5 border-t border-divider pt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">Share to feed</p>
          <p className="text-caption text-ink-faint">Show the Reel on the profile grid as well.</p>
        </div>
        <Switch checked={fields.shareToFeed} onCheckedChange={checked => setField('shareToFeed', checked)} aria-label="Share to feed" />
      </div>
      <FieldRow label="Audio name" hint="Optional" htmlFor="audio-name">
        <IconInput id="audio-name" icon={Music} value={fields.audioName} onChange={e => setField('audioName', e.target.value)} placeholder="Original audio" />
      </FieldRow>
      <FieldRow label="Thumbnail offset" hint="Milliseconds into the video to use as the thumbnail." htmlFor="thumb-offset">
        <IconInput id="thumb-offset" icon={Clock} type="number" min="0" value={fields.thumbOffset} onChange={e => setField('thumbOffset', e.target.value)} placeholder="0" />
      </FieldRow>
      <CoverPicker form={form} />
    </div>
  );
}
