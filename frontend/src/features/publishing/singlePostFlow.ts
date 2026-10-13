import { api } from '../../services/api';
import { buildContainerPayload, buildScheduledPostPayload, singleUploadMessage } from './publishHelpers.ts';
import { waitUntilReady } from './containerPolling.ts';

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
