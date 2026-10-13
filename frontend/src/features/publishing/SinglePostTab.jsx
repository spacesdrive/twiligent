import CaptionBox from './CaptionBox';
import MediaPicker from './MediaPicker';
import PublishProgress from './PublishProgress';
import SinglePostSettings from './SinglePostSettings';
import { contentTypeOf } from './publishConstants';

export default function SinglePostTab({ form, publish, igAccounts, onReset }) {
  const selectedAcct = igAccounts.find(account => account.id === form.selectedAccount);
  const selectedType = contentTypeOf(form.contentType);

  if (publish.activeStep === 2) {
    return (
      <PublishProgress
        progress={publish}
        selectedType={selectedType}
        selectedAcct={selectedAcct}
        scheduleMode={form.fields.scheduleMode}
        onReset={onReset}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_28rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <MediaPicker form={form} selectedType={selectedType} />
        <CaptionBox caption={form.fields.caption} onChange={caption => form.setField('caption', caption)} />
      </div>
      <SinglePostSettings
        form={form}
        publish={publish}
        igAccounts={igAccounts}
        selectedAcct={selectedAcct}
        selectedType={selectedType}
      />
    </div>
  );
}
