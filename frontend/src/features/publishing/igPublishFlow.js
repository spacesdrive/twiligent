import { api } from '../../services/api';
import { buildContainerPayload, buildScheduledPostPayload, singleUploadMessage } from './publishHelpers.js';

const POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 3000;
const IMAGE_SETTLE_MS = 2000;

export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function containerFinished(status, failedMessage) {
  if (status.statusCode === 'FINISHED' || status.statusCode === 'PUBLISHED') return true;
  if (status.statusCode === 'ERROR') throw new Error(failedMessage);
  if (status.statusCode === 'EXPIRED') throw new Error('Container expired');
  return false;
}

async function pollTolerant(containerId, accountId, onStatus) {
  try {
    const status = await api.getIGContainerStatus(containerId, accountId);
    onStatus(`Instagram status: ${status.statusCode || 'IN_PROGRESS'}`);
    return containerFinished(status, 'Container processing failed: ' + (status.status || 'Unknown'));
  } catch (err) {
    if (err.message.includes('processing failed') || err.message.includes('expired')) throw err;
    return false;
  }
}

async function pollStrict(containerId, accountId) {
  const status = await api.getIGContainerStatus(containerId, accountId);
  return containerFinished(status, 'Processing failed');
}

// single posts ride out failed checks and fail on timeout; bulk stops quietly after the last try
export async function waitForContainer(containerId, accountId, { tolerant = false, onStatus } = {}) {
  for (let i = 0; i < POLL_ATTEMPTS; i++) {
    await wait(POLL_INTERVAL_MS);
    const finished = tolerant
      ? await pollTolerant(containerId, accountId, onStatus)
      : await pollStrict(containerId, accountId);
    if (finished) return true;
  }
  if (tolerant) throw new Error('Instagram took too long to process the media. Try again in a few minutes.');
  return false;
}

// photos need no processing, Instagram only needs a moment before they can be published
export async function waitUntilReady(contentType, containerId, accountId, { onProcessing, ...pollOptions }) {
  if (contentType !== 'REELS' && contentType !== 'STORIES') {
    await wait(IMAGE_SETTLE_MS);
    return;
  }
  onProcessing();
  await waitForContainer(containerId, accountId, pollOptions);
}

export async function uploadSingleMedia(file, cloudConfig, onProgress) {
  if (!cloudConfig) throw new Error('Cloudinary is not set up on the server. Check Settings.');
  try {
    return await api.uploadToCloudinary(file, cloudConfig, { onProgress });
  } catch (err) {
    throw new Error(singleUploadMessage(err));
  }
}

async function uploadPostMedia(form, cloudConfig, progress) {
  const mediaUrl = await uploadSingleMedia(form.file, cloudConfig, progress.setUploadProgress);
  if (!form.coverFile || form.contentType !== 'REELS') return { mediaUrl, coverUrl: null };
  progress.setStatusMessage('Uploading cover');
  const coverUrl = await uploadSingleMedia(form.coverFile, cloudConfig, progress.setUploadProgress);
  return { mediaUrl, coverUrl };
}

function postDetails(form, uploaded) {
  return { ...form.fields, accountId: form.selectedAccount, mediaType: form.contentType, ...uploaded };
}

export async function scheduleSinglePost(form, cloudConfig, scheduledAt, progress) {
  const uploaded = await uploadPostMedia(form, cloudConfig, progress);
  progress.setPublishStatus('scheduling');
  progress.setStatusMessage('Saving the scheduled post');
  const res = await api.createScheduledPost(buildScheduledPostPayload({ ...postDetails(form, uploaded), scheduledAt }));
  if (!res.success) throw new Error(res.message || 'Failed to schedule');
}

export async function publishSinglePost(form, cloudConfig, progress) {
  const uploaded = await uploadPostMedia(form, cloudConfig, progress);
  progress.setPublishStatus('creating-container');
  progress.setStatusMessage('Creating the Instagram media container');
  const containerRes = await api.createIGContainer(form.selectedAccount, buildContainerPayload(postDetails(form, uploaded)));
  if (!containerRes.success || !containerRes.containerId) throw new Error(containerRes.message || 'Failed to create container');
  await waitUntilReady(form.contentType, containerRes.containerId, form.selectedAccount, {
    tolerant: true,
    onStatus: progress.setStatusMessage,
    onProcessing: () => {
      progress.setPublishStatus('processing');
      progress.setStatusMessage('Instagram is processing the media');
    },
  });
  progress.setPublishStatus('publishing');
  progress.setStatusMessage('Publishing to Instagram');
  const publishRes = await api.publishIGContainer(form.selectedAccount, containerRes.containerId);
  if (!publishRes.success || !publishRes.mediaId) throw new Error(publishRes.message || 'Publish failed');
  return publishRes.mediaId;
}
