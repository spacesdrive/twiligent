import BulkFileList from './BulkFileList';
import BulkResults from './BulkResults';
import BulkSettings from './BulkSettings';
import { contentTypeOf } from './publishConstants';
import { bulkStatsOf } from './queueHelpers.ts';

export default function BulkUploadTab({ bulk, queue, bulkPublish, igAccounts }) {
  const stats = bulkStatsOf(queue.files);
  const bulkType = contentTypeOf(bulk.settings.contentType);
  const showResults = queue.processing || stats.done > 0 || stats.scheduled > 0 || stats.errors > 0;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_28rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <BulkFileList queue={queue} bulkType={bulkType} />
        {showResults && <BulkResults stats={stats} processing={queue.processing} />}
      </div>
      <BulkSettings
        bulk={bulk}
        igAccounts={igAccounts}
        pending={stats.pending}
        processing={queue.processing}
        onStart={bulkPublish.handleBulkProcess}
        onStop={bulkPublish.stopBulk}
        onApplyCaption={queue.applySharedCaption}
      />
    </div>
  );
}
