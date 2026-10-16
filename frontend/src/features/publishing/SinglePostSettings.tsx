import { AtSign, Calendar, Image as ImageIcon, MapPin, Send, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import DetailPanel, { FieldRow } from '@/components/DetailPanel';
import AccountSelect from '@/components/AccountSelect';
import IconInput from './IconInput';
import PostSummary from './PostSummary';
import ReelOptions from './ReelOptions';
import ScheduleFields from './ScheduleFields';
import type { AppAccount } from '../../utils/formatters';
import type { ContentTypeOption } from './publishConstants';
import type { SinglePostForm } from './useSinglePostForm';
import type { SinglePublish } from './useSinglePublish';

interface PublishButtonIconProps {
  uploading: boolean;
  scheduleMode: boolean;
}

interface SinglePostSettingsProps {
  form: SinglePostForm;
  publish: SinglePublish;
  igAccounts: AppAccount[];
  selectedAcct: AppAccount | undefined;
  selectedType: ContentTypeOption | undefined;
}

function PublishButtonIcon({ uploading, scheduleMode }: PublishButtonIconProps) {
  if (uploading) return <Spinner className="size-4" />;
  if (scheduleMode) return <Calendar data-icon="inline-start" />;
  return <Send data-icon="inline-start" />;
}

export default function SinglePostSettings({ form, publish, igAccounts, selectedAcct, selectedType }: SinglePostSettingsProps) {
  const { fields, setField, contentType } = form;
  const footer = (
    <Button size="lg" className="w-full" onClick={publish.handlePublish} disabled={publish.uploading || !form.canPublish}>
      <PublishButtonIcon uploading={publish.uploading} scheduleMode={fields.scheduleMode} />
      {fields.scheduleMode ? 'Schedule post' : 'Publish now'}
    </Button>
  );
  return (
    <DetailPanel title="Post settings" footer={footer}>
      <FieldRow label="Account">
        <AccountSelect accounts={igAccounts} value={form.selectedAccount} onChange={form.setSelectedAccount} />
      </FieldRow>

      {contentType === 'IMAGE' && (
        <FieldRow label="Alt text" hint="Describes the photo for people using screen readers." htmlFor="alt-text">
          <IconInput id="alt-text" icon={ImageIcon} value={fields.altText} onChange={e => setField('altText', e.target.value)} placeholder="A short description of the photo" />
        </FieldRow>
      )}
      <FieldRow label="Collaborators" hint="Separate usernames with commas." htmlFor="collaborators">
        <IconInput id="collaborators" icon={UserPlus} value={fields.collaborators} onChange={e => setField('collaborators', e.target.value)} placeholder="username1, username2" />
      </FieldRow>
      <FieldRow label="Tagged people" hint="Separate with commas. Add x and y after a name to position the tag." htmlFor="user-tags">
        <IconInput id="user-tags" icon={AtSign} value={fields.userTags} onChange={e => setField('userTags', e.target.value)} placeholder="@username1, @username2" />
      </FieldRow>
      <FieldRow label="Location" hint="The Facebook Page ID of the place." htmlFor="location-id">
        <IconInput id="location-id" icon={MapPin} value={fields.locationId} onChange={e => setField('locationId', e.target.value)} placeholder="Location ID" />
      </FieldRow>

      {contentType === 'REELS' && <ReelOptions form={form} />}

      <ScheduleFields fields={fields} setField={setField} />

      <PostSummary selectedAcct={selectedAcct} selectedType={selectedType} file={form.file} fields={fields} />
    </DetailPanel>
  );
}
