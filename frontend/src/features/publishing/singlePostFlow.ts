import { api } from '../../services/api';
import { buildContainerPayload, buildScheduledPostPayload, singleUploadMessage } from './publishHelpers.ts';
import { waitUntilReady } from './containerPolling.ts';
import type { CloudinaryUploadConfig, UploadError } from '../../services/api';
import type { AccountPostDetails, ContentTypeValue, SinglePostFields } from './publishHelpers.ts';
import type { PublishStatus } from './queueHelpers.ts';

// singlePostError has already checked that file and contentType are set
export interface SinglePostInput {
  selectedAccount: string;
  contentType: ContentTypeValue | '';
  file: File | null;
  coverFile: File | null;
  fields: SinglePostFields;
}

export interface PublishProgressSetters {
  setUploadProgress: (percent: number) => void;
  setStatusMessage: (message: string) => void;
  setPublishStatus: (status: PublishStatus) => void;
}

interface UploadedMedia {
  mediaUrl: string;
  coverUrl: string | null;
}

export async function uploadSingleMedia(
  file: File, cloudConfig: CloudinaryUploadConfig | null, onProgress: (percent: number) => void,
): Promise<string> {
  if (!cloudConfig) throw new Error('Cloudinary is not set up on the server. Check Settings.');
  try {
    return await api.uploadToCloudinary(file, cloudConfig, { onProgress });
  } catch (err) {
    throw new Error(singleUploadMessage(err as UploadError));
  }
}

async function uploadPostMedia(
  form: SinglePostInput, cloudConfig: CloudinaryUploadConfig | null, progress: PublishProgressSetters,
): Promise<UploadedMedia> {
  const mediaUrl = await uploadSingleMedia(form.file as File, cloudConfig, progress.setUploadProgress);
  if (!form.coverFile || form.contentType !== 'REELS') return { mediaUrl, coverUrl: null };
  progress.setStatusMessage('Uploading cover');
  const coverUrl = await uploadSingleMedia(form.coverFile, cloudConfig, progress.setUploadProgress);
  return { mediaUrl, coverUrl };
}

function postDetails(form: SinglePostInput, uploaded: UploadedMedia): AccountPostDetails {
  return { ...form.fields, accountId: form.selectedAccount, mediaType: form.contentType as ContentTypeValue, ...uploaded };
}

export async function scheduleSinglePost(
  form: SinglePostInput, cloudConfig: CloudinaryUploadConfig | null, scheduledAt: Date, progress: PublishProgressSetters,
): Promise<void> {
  const uploaded = await uploadPostMedia(form, cloudConfig, progress);
  progress.setPublishStatus('scheduling');
  progress.setStatusMessage('Saving the scheduled post');
  await api.createScheduledPost(buildScheduledPostPayload({ ...postDetails(form, uploaded), scheduledAt }));
}

export async function publishSinglePost(
  form: SinglePostInput, cloudConfig: CloudinaryUploadConfig | null, progress: PublishProgressSetters,
): Promise<string> {
  const uploaded = await uploadPostMedia(form, cloudConfig, progress);
  progress.setPublishStatus('creating-container');
  progress.setStatusMessage('Creating the Instagram media container');
  const { containerId } = await api.createIGContainer(form.selectedAccount, buildContainerPayload(postDetails(form, uploaded)));
  await waitUntilReady(form.contentType, containerId, form.selectedAccount, {
    tolerant: true,
    onStatus: progress.setStatusMessage,
    onProcessing: () => {
      progress.setPublishStatus('processing');
      progress.setStatusMessage('Instagram is processing the media');
    },
  });
  progress.setPublishStatus('publishing');
  progress.setStatusMessage('Publishing to Instagram');
  const { mediaId } = await api.publishIGContainer(form.selectedAccount, containerId);
  return mediaId;
}
