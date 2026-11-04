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

// a name may be typed as @name or pasted as a profile address; Instagram wants the bare user name
export function instagramUsername(text: string): string {
  const name = text.trim();
  const fromUrl = name.match(/instagram\.com\/([^/?#\s]+)/i);
  return (fromUrl ? fromUrl[1] : name).replace(/^@/, '').trim();
}

export function parseCollaborators(text: string): string[] {
  return text.split(',').map(instagramUsername).filter(Boolean);
}

// the field takes seconds, as people think of a video, with a dot or a comma; Instagram takes milliseconds
export function thumbOffsetMs(seconds: string | undefined): number | null {
  const value = Number.parseFloat((seconds ?? '').trim().replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 1000) : null;
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
    thumbOffset: thumbOffsetMs(thumbOffset),
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
    thumbOffset: thumbOffsetMs(thumbOffset) ?? undefined,
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

export type SinglePostField = 'account' | 'contentType' | 'file' | 'server' | 'schedule';
export type BulkField = 'account' | 'contentType' | 'files' | 'server' | 'schedule';
export type EditPostField = 'date' | 'time';

export interface FieldProblem<F extends string> {
  field: F;
  message: string;
}

// the first thing missing before a single post can go out and the field it belongs to, or null
export function singlePostProblem({ selectedAccount, file, contentType, hasCloudConfig, fields, now }: SinglePostCheck): FieldProblem<SinglePostField> | null {
  if (!selectedAccount) return { field: 'account', message: 'Choose the Instagram account to post to.' };
  if (!contentType) return { field: 'contentType', message: 'Choose what you are posting: a photo, a Reel or a Story.' };
  if (!file) return { field: 'file', message: 'Choose the file to post.' };
  if (!hasCloudConfig) return { field: 'server', message: 'Uploads are not set up on this server yet. The administrator needs to add the Cloudinary settings.' };
  if (!fields.scheduleMode) return null;
  if (!fields.scheduleDate || !fields.scheduleTime) return { field: 'schedule', message: 'Set the date and time to publish the post.' };
  if (new Date(`${fields.scheduleDate}T${fields.scheduleTime}`) <= now) return { field: 'schedule', message: 'Pick a time in the future.' };
  return null;
}

export function bulkStartProblem({ settings, fileCount, hasCloudConfig, now }: BulkStartCheck): FieldProblem<BulkField> | null {
  if (fileCount === 0) return { field: 'files', message: 'Add at least one file.' };
  if (!settings.account) return { field: 'account', message: 'Choose the Instagram account to post to.' };
  if (!settings.contentType) return { field: 'contentType', message: 'Choose what you are posting: photos, Reels or Stories.' };
  if (!hasCloudConfig) return { field: 'server', message: 'Uploads are not set up on this server yet. The administrator needs to add the Cloudinary settings.' };
  if (settings.scheduleMode && (!settings.startDate || !settings.startTime)) return { field: 'schedule', message: 'Set the date and time of the first post.' };
  const baseTime = bulkBaseTime(settings);
  if (baseTime && baseTime <= now) return { field: 'schedule', message: 'Pick a start time in the future.' };
  return null;
}

export function editPostProblem({ postId, date, time, now }: EditPostCheck): FieldProblem<EditPostField> | null {
  if (!postId || !date) return { field: 'date', message: 'Set the date.' };
  if (!time) return { field: 'time', message: 'Set the time.' };
  if (new Date(`${date}T${time}`) <= now) return { field: 'time', message: 'Pick a time in the future.' };
  return null;
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
