import { api } from '../../services/api';
import { waitUntilReady, wait } from './containerPolling.ts';
import {
  buildContainerPayload, buildScheduledPostPayload, bulkBaseTime, bulkPostDetails, bulkScheduledTime, bulkStartError,
} from './publishHelpers.ts';
import type { CloudinaryUploadConfig } from '../../services/api';
import type { AppContextValue } from '../../context/AppContext';
import type { BulkSettings } from './publishHelpers.ts';
import type { QueueItem, QueueItemPatch } from './queueHelpers.ts';
import type { BulkQueue } from './useBulkQueue';

export interface BulkPublishOptions {
  queue: BulkQueue;
  settings: BulkSettings;
  cloudConfig: CloudinaryUploadConfig | null;
  showToast: AppContextValue['showToast'];
  onScheduled: () => void;
}

// cloudConfig is set and baseTime is set in schedule mode once bulkStartError passes
interface BulkRun {
  settings: BulkSettings;
  cloudConfig: CloudinaryUploadConfig | null;
  baseTime: Date | null;
  patchFile: (id: number, patch: QueueItemPatch) => void;
  isCancelled: () => boolean;
}

interface QueueTally {
  offset: number;
  succeeded: number;
  failed: number;
}

const CANCELLED = 'cancelled';
const DONE = 'done';

type ItemOutcome = typeof CANCELLED | typeof DONE;
const BETWEEN_FILES_MS = 2000;

async function scheduleItem(run: BulkRun, item: QueueItem, mediaUrl: string, offset: number): Promise<void> {
  const { settings } = run;
  run.patchFile(item.id, { status: 'scheduling', progress: 100 });
  const scheduledAt = bulkScheduledTime(run.baseTime as Date, offset, settings.interval);
  const res = await api.createScheduledPost(buildScheduledPostPayload({ ...bulkPostDetails(settings, item, mediaUrl), scheduledAt }));
  if (!res.success) throw new Error(res.message || 'Failed to schedule');
  run.patchFile(item.id, { status: 'scheduled', progress: 100 });
}

async function publishItem(run: BulkRun, item: QueueItem, mediaUrl: string): Promise<ItemOutcome> {
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

async function processItem(run: BulkRun, item: QueueItem, offset: number): Promise<ItemOutcome> {
  run.patchFile(item.id, { status: 'uploading', progress: 0 });
  const onProgress = (progress: number) => run.patchFile(item.id, { progress });
  const mediaUrl = await api.uploadToCloudinary(item.file, run.cloudConfig as CloudinaryUploadConfig, { onProgress });
  if (run.isCancelled()) return CANCELLED;
  if (!run.settings.scheduleMode) return publishItem(run, item, mediaUrl);
  await scheduleItem(run, item, mediaUrl, offset);
  return DONE;
}

// a stop request ends the loop without touching the file in progress
async function runQueue(run: BulkRun, pendingFiles: QueueItem[]): Promise<QueueTally> {
  const tally: QueueTally = { offset: 0, succeeded: 0, failed: 0 };
  for (let i = 0; i < pendingFiles.length; i++) {
    if (run.isCancelled()) break;
    const item = pendingFiles[i];
    try {
      const outcome = await processItem(run, item, tally.offset);
      if (outcome === CANCELLED) break;
      if (run.settings.scheduleMode) tally.offset++;
      tally.succeeded++;
    } catch (err) {
      run.patchFile(item.id, { status: 'error', error: (err as Error).message });
      tally.failed++;
    }
    if (i < pendingFiles.length - 1 && !run.isCancelled()) await wait(BETWEEN_FILES_MS);
  }
  return tally;
}

export function useBulkPublish({ queue, settings, cloudConfig, showToast, onScheduled }: BulkPublishOptions) {
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
    const run: BulkRun = { settings, cloudConfig, baseTime, patchFile: queue.patchFile, isCancelled: () => cancelRef.current };
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

export type BulkPublish = ReturnType<typeof useBulkPublish>;
