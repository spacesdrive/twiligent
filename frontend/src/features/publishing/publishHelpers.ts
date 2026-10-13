import type { MediaType, ScheduledPostRequest, UserTag } from '../../../../shared/types/domain.ts';
import type { InstagramPublishRequest } from '../../../../shared/types/instagram.ts';
import type { QueueItem } from './queueHelpers.ts';
import type { ScheduleFieldValues } from './scheduleHelpers.ts';

export type ContentTypeValue = Extract<MediaType, 'IMAGE' | 'REELS' | 'STORIES'>;

// the form's text fields, before they are parsed into the request shapes
export interface SinglePostFields extends ScheduleFieldValues {
  caption: string;
  shareToFeed: boolean;
  audioName: string;
  thumbOffset: string;
  locationId: string;
  collaborators: string;
  userTags: string;
  altText: string;
}

export interface BulkSettings {
  account: string;
  contentType: ContentTypeValue;
  sharedCaption: string;
  collaborators: string;
  userTags: string;
  locationId: string;
  shareToFeed: boolean;
  scheduleMode: boolean;
  startDate: string;
  startTime: string;
  interval: number;
}

export interface PostDetails {
  mediaType: MediaType;
  mediaUrl: string;
  caption?: string;
  coverUrl?: string | null;
  shareToFeed?: boolean;
  collaborators?: string;
  audioName?: string;
  thumbOffset?: string;
  locationId?: string;
  userTags?: string;
  altText?: string;
}

export interface AccountPostDetails extends PostDetails {
  accountId: string;
}

export interface ScheduledPostDetails extends AccountPostDetails {
  scheduledAt: Date;
}

export interface UploadFailure {
  message: string;
  reason?: 'network' | 'rejected';
  cloudinaryMessage?: string;
}

export interface SinglePostCheck {
  selectedAccount: string;
  file: File | null;
  contentType: string;
  hasCloudConfig: boolean;
  fields: ScheduleFieldValues;
  now: Date;
}

export interface BulkStartCheck {
  settings: BulkSettings;
  fileCount: number;
  hasCloudConfig: boolean;
  now: Date;
}

export interface EditPostCheck {
  postId: string | null;
  date: string;
  time: string;
  now: Date;
}

const MINUTE_MS = 60000;

export function parseUserTags(text: string): UserTag[] {
  return text.split(',').map(entry => {
    const parts = entry.trim().replace(/^@/, '').split(/\s+/);
    return { username: parts[0], x: parts[1] ? parseFloat(parts[1]) : 0.5, y: parts[2] ? parseFloat(parts[2]) : 0.5 };
  }).filter(tag => tag.username);
}

export function parseCollaborators(text: string): string[] {
  return text.split(',').map(name => name.trim()).filter(Boolean);
}

export function buildScheduledPostPayload(post: ScheduledPostDetails): ScheduledPostRequest {
  const { accountId, mediaType, mediaUrl, caption, coverUrl, shareToFeed, collaborators } = post;
  const { audioName, thumbOffset, locationId, userTags, altText, scheduledAt } = post;
  return {
    accountId,
    platform: 'instagram',
    mediaType,
    mediaUrl,
    caption: caption || '',
    coverUrl: coverUrl || null,
    shareToFeed: mediaType === 'REELS' ? shareToFeed : true,
    collaborators: collaborators ? parseCollaborators(collaborators) : [],
    audioName: audioName || '',
    thumbOffset: thumbOffset ? parseInt(thumbOffset, 10) : null,
    locationId: locationId || '',
    userTags: userTags ? parseUserTags(userTags) : [],
    altText: (mediaType === 'IMAGE' && altText) ? altText : '',
    scheduledAt: scheduledAt.toISOString(),
  };
}

export function buildContainerPayload(post: PostDetails): InstagramPublishRequest {
  const { mediaType, mediaUrl, caption, coverUrl, shareToFeed, collaborators } = post;
  const { audioName, thumbOffset, locationId, userTags, altText } = post;
  return {
    mediaType,
    mediaUrl,
    caption: caption || undefined,
    coverUrl: coverUrl || undefined,
    shareToFeed: mediaType === 'REELS' ? shareToFeed : undefined,
    collaborators: collaborators ? parseCollaborators(collaborators) : undefined,
    audioName: audioName || undefined,
    thumbOffset: thumbOffset ? parseInt(thumbOffset, 10) : undefined,
    locationId: locationId || undefined,
    userTags: userTags ? parseUserTags(userTags) : undefined,
    altText: (mediaType === 'IMAGE' && altText) ? altText : undefined,
  };
}

// bulk posts share the queue settings and only carry their own caption
export function bulkPostDetails(settings: BulkSettings, item: Pick<QueueItem, 'caption'>, mediaUrl: string): AccountPostDetails {
  return {
    accountId: settings.account,
    mediaType: settings.contentType,
    mediaUrl,
    caption: item.caption,
    shareToFeed: settings.shareToFeed,
    collaborators: settings.collaborators,
    locationId: settings.locationId,
    userTags: settings.userTags,
  };
}

export function singleUploadMessage(err: UploadFailure): string {
  if (err.reason === 'network') return 'The upload lost its network connection. Check your connection and try again.';
  if (err.reason === 'rejected') return err.cloudinaryMessage || 'Upload failed';
  return err.message;
}

export function singlePostError({ selectedAccount, file, contentType, hasCloudConfig, fields, now }: SinglePostCheck): string {
  if (!selectedAccount || !file || !contentType) return 'Choose an account, a content type and a file before publishing.';
  if (!hasCloudConfig) return 'Cloudinary is not set up on the server. Check Settings.';
  if (!fields.scheduleMode) return '';
  if (!fields.scheduleDate || !fields.scheduleTime) return 'Set a date and time for the scheduled post.';
  if (new Date(`${fields.scheduleDate}T${fields.scheduleTime}`) <= now) return 'Pick a time in the future.';
  return '';
}

export function bulkBaseTime(settings: Pick<BulkSettings, 'scheduleMode' | 'startDate' | 'startTime'>): Date | null {
  return settings.scheduleMode ? new Date(`${settings.startDate}T${settings.startTime}`) : null;
}

export function bulkStartError({ settings, fileCount, hasCloudConfig, now }: BulkStartCheck): string {
  if (!settings.account || fileCount === 0 || !settings.contentType) return 'Choose an account, a content type and at least one file.';
  if (!hasCloudConfig) return 'Cloudinary is not set up on the server. Check Settings.';
  if (settings.scheduleMode && (!settings.startDate || !settings.startTime)) return 'Set a start date and time for the schedule.';
  const baseTime = bulkBaseTime(settings);
  if (baseTime && baseTime <= now) return 'Pick a start time in the future.';
  return '';
}

export function editPostError({ postId, date, time, now }: EditPostCheck): string {
  if (!postId || !date || !time) return 'Set a date and time.';
  if (new Date(`${date}T${time}`) <= now) return 'Pick a time in the future.';
  return '';
}

export function bulkScheduledTime(baseTime: Date, offset: number, intervalMinutes: number): Date {
  return new Date(baseTime.getTime() + offset * intervalMinutes * MINUTE_MS);
}
