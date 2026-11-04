import { useState } from 'react';
import { AtSign, Calendar, ChevronRight, Image as ImageIcon, MapPin, Send, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import DetailPanel, { FieldRow } from '@/components/DetailPanel';
import AccountSelect from '@/components/AccountSelect';
import { docsUrl } from '@/lib/docs';
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

// what Publish needs and the platform's limit, next to the button rather than at the bottom of the page
export function PublishHelp() {
  return (
    <p className="text-small text-ink-muted">
      Instagram allows 100 posts per account in 24 hours.{' '}
      <a href={docsUrl('/use/publishing')} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-text underline underline-offset-4">
        How publishing works<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </p>
  );
}

export default function SinglePostSettings({ form, publish, igAccounts, selectedAcct, selectedType }: SinglePostSettingsProps) {
  const { fields, setField, contentType } = form;
  // the rarely used fields start open when one of them already holds a value, such as a restored draft
  const [moreOpen, setMoreOpen] = useState(() => Boolean(fields.collaborators || fields.userTags || fields.locationId));
  const serverError = publish.errorFor('server');
  const footer = (
    <div className="flex flex-col gap-2">
      {serverError && <p className="text-sm text-danger" role="alert"><span className="sr-only">Error: </span>{serverError}</p>}
      <Button id="post-publish" size="lg" className="w-full" onClick={publish.handlePublish} disabled={publish.uploading}>
        <PublishButtonIcon uploading={publish.uploading} scheduleMode={fields.scheduleMode} />
        {publish.uploading ? (fields.scheduleMode ? 'Scheduling' : 'Publishing') : fields.scheduleMode ? 'Schedule post' : 'Publish now'}
      </Button>
      <PublishHelp />
    </div>
  );
  return (
    <DetailPanel title="Post settings" footer={footer}>
      <FieldRow label="Account" htmlFor="post-account" error={publish.errorFor('account')}>
        <AccountSelect id="post-account" accounts={igAccounts} value={form.selectedAccount} onChange={form.setSelectedAccount} />
      </FieldRow>

      {contentType === 'IMAGE' && (
        <FieldRow label="Alt text" optional hint="Describes the photo for people who use a screen reader." htmlFor="alt-text">
          <IconInput id="alt-text" icon={ImageIcon} value={fields.altText} onChange={e => setField('altText', e.target.value)} placeholder="A short description of the photo" />
        </FieldRow>
      )}

      <details className="group flex flex-col" open={moreOpen} onToggle={e => setMoreOpen(e.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-control text-sm font-medium text-ink select-none [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 text-ink-muted transition-transform duration-(--duration-base) group-open:rotate-90" aria-hidden="true" />
          More options: collaborators, tagged people, location
        </summary>
        <div className="mt-4 flex flex-col gap-5">
          <FieldRow label="Collaborators" optional hint="Instagram user names, separated by commas. An @ or a profile link works too." htmlFor="collaborators">
            <IconInput id="collaborators" icon={UserPlus} value={fields.collaborators} onChange={e => setField('collaborators', e.target.value)} placeholder="username1, username2" />
          </FieldRow>
          <FieldRow
            label="Tagged people"
            optional
            hint="User names, separated by commas. Tags sit in the middle of the photo; to place one, add two numbers from 0 to 1 after the name, across then down, such as @ann 0.2 0.8."
            htmlFor="user-tags"
          >
            <IconInput id="user-tags" icon={AtSign} value={fields.userTags} onChange={e => setField('userTags', e.target.value)} placeholder="@username1, @username2" />
          </FieldRow>
          <FieldRow
            label="Location"
            optional
            hint="Instagram identifies a place by the ID of its Facebook Page. Open the place's Facebook Page, choose About, and copy the Page ID."
            htmlFor="location-id"
          >
            <IconInput id="location-id" icon={MapPin} inputMode="numeric" value={fields.locationId} onChange={e => setField('locationId', e.target.value.trim())} placeholder="Facebook Page ID" />
          </FieldRow>
        </div>
      </details>

      {contentType === 'REELS' && <ReelOptions form={form} />}

      <ScheduleFields fields={fields} setField={setField} error={publish.errorFor('schedule')} />

      <PostSummary selectedAcct={selectedAcct} selectedType={selectedType} file={form.file} fields={fields} />
    </DetailPanel>
  );
}
