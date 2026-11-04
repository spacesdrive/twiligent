import { useState } from 'react';
import { AtSign, Calendar, ChevronRight, Copy, MapPin, Send, Square, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import DetailPanel, { FieldRow } from '@/components/DetailPanel';
import { fieldErrorId } from '@/lib/fieldIds';
import AccountSelect from '@/components/AccountSelect';
import BulkScheduleFields from './BulkScheduleFields';
import IconInput from './IconInput';
import TypePicker from './TypePicker';
import { PublishHelp } from './SinglePostSettings';
import { bulkActionLabel } from './queueHelpers.ts';
import type { AppAccount } from '../../utils/formatters';
import type { BulkSettings as BulkSettingsValues } from './publishHelpers.ts';
import type { BulkField } from './publishHelpers.ts';
import type { BulkSettingsState } from './useBulkSettings';

interface BulkFooterProps {
  settings: BulkSettingsValues;
  pending: number;
  processing: boolean;
  onStart: () => void;
  onStop: () => void;
  error?: string;
}

interface BulkSettingsProps {
  bulk: BulkSettingsState;
  igAccounts: AppAccount[];
  pending: number;
  processing: boolean;
  onStart: () => void;
  onStop: () => void;
  onApplyCaption: () => void;
  errorFor: (field: BulkField) => string | undefined;
}

// the start button stays enabled; pressing it with something missing says what, next to that field
function BulkFooter({ settings, pending, processing, onStart, onStop, error }: BulkFooterProps) {
  if (processing) {
    return (
      <div className="flex flex-col gap-2">
        <Button variant="destructive" size="lg" className="w-full" onClick={onStop}>
          <Square data-icon="inline-start" />Stop after this file
        </Button>
        <p className="text-small text-ink-muted">Stay on this page until the files are done. Leaving stops the uploads.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-danger" role="alert"><span className="sr-only">Error: </span>{error}</p>}
      <Button id="bulk-start" size="lg" className="w-full" onClick={onStart}>
        {settings.scheduleMode ? <Calendar data-icon="inline-start" /> : <Send data-icon="inline-start" />}
        {pending === 0 ? (settings.scheduleMode ? 'Schedule posts' : 'Publish posts') : bulkActionLabel(settings.scheduleMode, pending)}
      </Button>
      <PublishHelp />
    </div>
  );
}

export default function BulkSettings({ bulk, igAccounts, pending, processing, onStart, onStop, onApplyCaption, errorFor }: BulkSettingsProps) {
  const { settings, setSetting } = bulk;
  const [moreOpen, setMoreOpen] = useState(() => Boolean(settings.collaborators || settings.userTags || settings.locationId));
  const footerError = errorFor('files') ?? errorFor('server');
  const footer = <BulkFooter settings={settings} pending={pending} processing={processing} onStart={onStart} onStop={onStop} error={footerError} />;
  return (
    <DetailPanel title="Bulk settings" footer={footer}>
      <FieldRow label="Account" htmlFor="bulk-account" error={errorFor('account')}>
        <AccountSelect id="bulk-account" accounts={igAccounts} value={settings.account} onChange={value => setSetting('account', value)} disabled={processing} />
      </FieldRow>
      <FieldRow label="What you are posting" htmlFor="bulk-type-group" group error={errorFor('contentType')}>
        <TypePicker
          id="bulk-type"
          name="bulk-type"
          value={settings.contentType}
          onChange={value => setSetting('contentType', value)}
          disabled={processing}
          aria-describedby={errorFor('contentType') ? fieldErrorId('bulk-type-group') : undefined}
        />
      </FieldRow>
      <FieldRow label="Shared caption" optional hint="Write it once, then copy it onto every file that has not gone out yet. Undo puts back captions it replaced." htmlFor="bulk-caption">
        <Textarea id="bulk-caption" value={settings.sharedCaption} onChange={e => setSetting('sharedCaption', e.target.value)} placeholder="Caption for all files" rows={2} disabled={processing} />
      </FieldRow>
      <Button variant="outline" size="sm" className="-mt-3 self-start" onClick={onApplyCaption} disabled={!settings.sharedCaption || processing}>
        <Copy data-icon="inline-start" />Apply to pending files
      </Button>

      <details className="group flex flex-col" open={moreOpen} onToggle={e => setMoreOpen(e.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-control text-sm font-medium text-ink select-none [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 text-ink-muted transition-transform duration-(--duration-base) group-open:rotate-90" aria-hidden="true" />
          More options: collaborators, tagged people, location
        </summary>
        <div className="mt-4 flex flex-col gap-5">
          <FieldRow label="Collaborators" optional hint="Applied to every post. User names separated by commas; an @ or a profile link works too." htmlFor="bulk-collaborators">
            <IconInput id="bulk-collaborators" icon={UserPlus} value={settings.collaborators} onChange={e => setSetting('collaborators', e.target.value)} placeholder="username1, username2" disabled={processing} />
          </FieldRow>
          <FieldRow label="Tagged people" optional hint="Applied to every post. User names separated by commas." htmlFor="bulk-tags">
            <IconInput id="bulk-tags" icon={AtSign} value={settings.userTags} onChange={e => setSetting('userTags', e.target.value)} placeholder="@username1, @username2" disabled={processing} />
          </FieldRow>
          <FieldRow label="Location" optional hint="Applied to every post. The ID of the place's Facebook Page, from the About section of that Page." htmlFor="bulk-location">
            <IconInput id="bulk-location" icon={MapPin} inputMode="numeric" value={settings.locationId} onChange={e => setSetting('locationId', e.target.value.trim())} placeholder="Facebook Page ID" disabled={processing} />
          </FieldRow>
        </div>
      </details>

      {settings.contentType === 'REELS' && (
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="bulk-share-to-feed" className="text-sm font-medium text-ink">Share Reels to feed</label>
          <Switch id="bulk-share-to-feed" checked={settings.shareToFeed} onCheckedChange={checked => setSetting('shareToFeed', checked)} disabled={processing} />
        </div>
      )}

      <BulkScheduleFields settings={settings} setSetting={setSetting} pending={pending} processing={processing} error={errorFor('schedule')} />
    </DetailPanel>
  );
}
