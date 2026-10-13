import { api } from '../../services/api';
import { waitUntilReady, wait } from './containerPolling.ts';
import {
  buildContainerPayload, buildScheduledPostPayload, bulkBaseTime, bulkPostDetails, bulkScheduledTime, bulkStartError,
} from './publishHelpers.ts';

const CANCELLED = 'cancelled';
const DONE = 'done';
const BETWEEN_FILES_MS = 2000;

async function scheduleItem(run, item, mediaUrl, offset) {
  const { settings } = run;
  run.patchFile(item.id, { status: 'scheduling', progress: 100 });
  const scheduledAt = bulkScheduledTime(run.baseTime, offset, settings.interval);
  const res = await api.createScheduledPost(buildScheduledPostPayload({ ...bulkPostDetails(settings, item, mediaUrl), scheduledAt }));
  if (!res.success) throw new Error(res.message || 'Failed to schedule');
  run.patchFile(item.id, { status: 'scheduled', progress: 100 });
}

async function publishItem(run, item, mediaUrl) {
  const { settings } = run;
  run.patchFile(item.id, { status: 'creating', progress: 100 });
  const containerRes = await api.createIGContainer(settings.account, buildContainerPayload(bulkPostDetails(settings, item, mediaUrl)));
  if (!containerRes.success || !containerRes.containerId) throw new Error(containerRes.message || 'Container creation failed');
  if (run.isCancelled()) return CANCELLED;
  await waitUntilReady(settings.contentType, containerRes.containerId, settings.account, {
    onProcessing: () => run.patchFile(item.id, { status: 'processing' }),
  });
  if (run.isCancelled()) return CANCELLED;
  run.patchFile(item.id, { status: 'publishing' });
  const publishRes = await api.publishIGContainer(settings.account, containerRes.containerId);
  if (!publishRes.success || !publishRes.mediaId) throw new Error(publishRes.message || 'Publish failed');
  run.patchFile(item.id, { status: 'done', mediaId: publishRes.mediaId });
  return DONE;
}

async function processItem(run, item, offset) {
  run.patchFile(item.id, { status: 'uploading', progress: 0 });
  const onProgress = progress => run.patchFile(item.id, { progress });
  const mediaUrl = await api.uploadToCloudinary(item.file, run.cloudConfig, { onProgress });
  if (run.isCancelled()) return CANCELLED;
  if (!run.settings.scheduleMode) return publishItem(run, item, mediaUrl);
  await scheduleItem(run, item, mediaUrl, offset);
  return DONE;
}

// a stop request ends the loop without touching the file in progress
async function runQueue(run, pendingFiles) {
  const tally = { offset: 0, succeeded: 0, failed: 0 };
  for (let i = 0; i < pendingFiles.length; i++) {
    if (run.isCancelled()) break;
    const item = pendingFiles[i];
    try {
      const outcome = await processItem(run, item, tally.offset);
      if (outcome === CANCELLED) break;
      if (run.settings.scheduleMode) tally.offset++;
      tally.succeeded++;
    } catch (err) {
      run.patchFile(item.id, { status: 'error', error: err.message });
      tally.failed++;
    }
    if (i < pendingFiles.length - 1 && !run.isCancelled()) await wait(BETWEEN_FILES_MS);
  }
  return tally;
}

export function useBulkPublish({ queue, settings, cloudConfig, showToast, onScheduled }) {
  const { cancelRef } = queue;

  // the queue and settings are read once, as they are at the moment of the click
  const handleBulkProcess = async () => {
    const error = bulkStartError({ settings, fileCount: queue.files.length, hasCloudConfig: Boolean(cloudConfig), now: new Date() });
    if (error) {
      showToast(error, 'error');
      return;
    }
    const baseTime = bulkBaseTime(settings);
    queue.setProcessing(true);
    cancelRef.current = false;
    const pendingFiles = queue.files.filter(item => item.status === 'pending');
    const run = { settings, cloudConfig, baseTime, patchFile: queue.patchFile, isCancelled: () => cancelRef.current };
    const tally = await runQueue(run, pendingFiles);
    queue.setProcessing(false);
    if (cancelRef.current) {
      showToast('Bulk upload stopped. Files already processed keep their status.', 'warning');
      return;
    }
    showToast(`Bulk upload finished: ${tally.succeeded} succeeded, ${tally.failed} failed`, tally.succeeded > 0 ? 'success' : 'error');
    if (settings.scheduleMode) onScheduled();
  };

  const stopBulk = () => {
    cancelRef.current = true;
  };

  return { handleBulkProcess, stopBulk };
}
