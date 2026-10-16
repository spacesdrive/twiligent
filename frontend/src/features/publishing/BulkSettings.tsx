import { AtSign, Calendar, Copy, MapPin, Send, Square, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import DetailPanel, { FieldRow } from '@/components/DetailPanel';
import AccountSelect from '@/components/AccountSelect';
import BulkScheduleFields from './BulkScheduleFields';
import IconInput from './IconInput';
import TypePicker from './TypePicker';
import { bulkActionLabel } from './queueHelpers.ts';
import type { AppAccount } from '../../utils/formatters';
import type { BulkSettings as BulkSettingsValues } from './publishHelpers.ts';
import type { BulkSettingsState } from './useBulkSettings';

interface BulkFooterProps {
  settings: BulkSettingsValues;
  pending: number;
  processing: boolean;
  onStart: () => void;
  onStop: () => void;
}

interface BulkSettingsProps {
  bulk: BulkSettingsState;
  igAccounts: AppAccount[];
  pending: number;
  processing: boolean;
  onStart: () => void;
  onStop: () => void;
  onApplyCaption: () => void;
}

function BulkFooter({ settings, pending, processing, onStart, onStop }: BulkFooterProps) {
  if (processing) {
    return (
      <Button variant="destructive" size="lg" className="w-full" onClick={onStop}>
        <Square data-icon="inline-start" />Stop after this file
      </Button>
    );
  }
  return (
    <Button size="lg" className="w-full" onClick={onStart} disabled={pending === 0 || !settings.account || !settings.contentType}>
      {settings.scheduleMode ? <Calendar data-icon="inline-start" /> : <Send data-icon="inline-start" />}
      {bulkActionLabel(settings.scheduleMode, pending)}
    </Button>
  );
}

export default function BulkSettings({ bulk, igAccounts, pending, processing, onStart, onStop, onApplyCaption }: BulkSettingsProps) {
  const { settings, setSetting } = bulk;
  const footer = <BulkFooter settings={settings} pending={pending} processing={processing} onStart={onStart} onStop={onStop} />;
  return (
    <DetailPanel title="Bulk settings" footer={footer}>
      <FieldRow label="Account">
        <AccountSelect accounts={igAccounts} value={settings.account} onChange={value => setSetting('account', value)} disabled={processing} />
      </FieldRow>
      <FieldRow label="Content type">
        <TypePicker value={settings.contentType} onChange={value => setSetting('contentType', value)} disabled={processing} />
      </FieldRow>
      <FieldRow label="Shared caption" hint="Copies this caption onto every pending file." htmlFor="bulk-caption">
        <div className="flex gap-2">
          <Textarea id="bulk-caption" value={settings.sharedCaption} onChange={e => setSetting('sharedCaption', e.target.value)} placeholder="Caption for all files" rows={2} disabled={processing} className="flex-1" />
          <Tooltip>
            <TooltipTrigger render={<Button variant="outline" size="icon" onClick={onApplyCaption} disabled={!settings.sharedCaption || processing} aria-label="Apply caption to all pending files" />}>
              <Copy />
            </TooltipTrigger>
            <TooltipContent>Apply to all pending files</TooltipContent>
          </Tooltip>
        </div>
      </FieldRow>
      <FieldRow label="Collaborators" hint="Applied to every post." htmlFor="bulk-collaborators">
        <IconInput id="bulk-collaborators" icon={UserPlus} value={settings.collaborators} onChange={e => setSetting('collaborators', e.target.value)} placeholder="username1, username2" disabled={processing} />
      </FieldRow>
      <FieldRow label="Tagged people" hint="Applied to every post." htmlFor="bulk-tags">
        <IconInput id="bulk-tags" icon={AtSign} value={settings.userTags} onChange={e => setSetting('userTags', e.target.value)} placeholder="@username1, @username2" disabled={processing} />
      </FieldRow>
      <FieldRow label="Location" hint="Facebook Page ID, applied to every post." htmlFor="bulk-location">
        <IconInput id="bulk-location" icon={MapPin} value={settings.locationId} onChange={e => setSetting('locationId', e.target.value)} placeholder="Location ID" disabled={processing} />
      </FieldRow>
      {settings.contentType === 'REELS' && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-ink">Share Reels to feed</p>
          <Switch checked={settings.shareToFeed} onCheckedChange={checked => setSetting('shareToFeed', checked)} disabled={processing} aria-label="Share Reels to feed" />
        </div>
      )}

      <BulkScheduleFields settings={settings} setSetting={setSetting} pending={pending} processing={processing} />
    </DetailPanel>
  );
}
