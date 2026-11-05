import type { YouTubePrivacy, YouTubeUploadState, YouTubeUploadSummary } from '@shared/types/youtubePublishing.ts';

export type StateTone = 'secondary' | 'info' | 'success' | 'warning' | 'danger';

export interface StateDisplay {
  label: string;
  tone: StateTone;
  // the page checks again while a job is moving
  active: boolean;
  help: string;
}

export const STATE_DISPLAY: Record<YouTubeUploadState, StateDisplay> = {
  queued: { label: 'Queued', tone: 'secondary', active: true, help: 'Waits for the next upload run, every 15 minutes.' },
  uploading: { label: 'Uploading', tone: 'info', active: true, help: 'Sent to YouTube in parts over the next runs.' },
  processing: { label: 'Processing', tone: 'info', active: true, help: 'YouTube has the video and is processing it.' },
  finalizing: { label: 'Setting thumbnail', tone: 'info', active: true, help: 'The video is up; the thumbnail is being set.' },
  done: { label: 'On YouTube', tone: 'success', active: false, help: 'The video is on the channel.' },
  waiting_quota: { label: 'Waiting for quota', tone: 'warning', active: true, help: 'YouTube\'s daily allowance is used up; the upload continues after midnight Pacific time.' },
  needs_reconnect: { label: 'Needs sign-in', tone: 'warning', active: false, help: 'Connect YouTube again on the Accounts page; the upload then continues.' },
  needs_review: { label: 'Check your channel', tone: 'warning', active: false, help: 'YouTube may already have this video. Look on your channel before trying again.' },
  failed: { label: 'Failed', tone: 'danger', active: false, help: 'The upload stopped. Read the reason, then try again.' },
  cancelled: { label: 'Cancelled', tone: 'secondary', active: false, help: 'Stopped before YouTube had the video.' },
};

export const PRIVACY_OPTIONS: { value: YouTubePrivacy; label: string }[] = [
  { value: 'private', label: 'Private' },
  { value: 'unlisted', label: 'Unlisted' },
  { value: 'public', label: 'Public' },
];

// YouTube's own category numbers for the categories most channels use
export const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: '22', label: 'People and blogs' },
  { value: '1', label: 'Film and animation' },
  { value: '2', label: 'Autos and vehicles' },
  { value: '10', label: 'Music' },
  { value: '15', label: 'Pets and animals' },
  { value: '17', label: 'Sports' },
  { value: '19', label: 'Travel and events' },
  { value: '20', label: 'Gaming' },
  { value: '23', label: 'Comedy' },
  { value: '24', label: 'Entertainment' },
  { value: '25', label: 'News and politics' },
  { value: '26', label: 'How-to and style' },
  { value: '27', label: 'Education' },
  { value: '28', label: 'Science and technology' },
  { value: '29', label: 'Nonprofits and activism' },
];

export const TITLE_MAX = 100;

export function uploadPercent(upload: Pick<YouTubeUploadSummary, 'bytesConfirmed' | 'sourceBytes'>): number {
  if (upload.sourceBytes <= 0) return 0;
  return Math.min(100, Math.round((upload.bytesConfirmed / upload.sourceBytes) * 100));
}

export function anyActive(uploads: Pick<YouTubeUploadSummary, 'state'>[]): boolean {
  return uploads.some(upload => STATE_DISPLAY[upload.state].active);
}

// accepts commas or new lines, trims, and keeps each tag once
export function parseTags(text: string): string[] {
  return [...new Set(text.split(/[,\n]/).map(tag => tag.trim()).filter(Boolean))];
}

export type ComposerField = 'connection' | 'video' | 'title' | 'madeForKids' | 'schedule';

export interface ComposerValues {
  connectionId: string;
  hasVideo: boolean;
  title: string;
  madeForKids: boolean | null;
  scheduled: boolean;
  publishAt: string;
}

export interface ComposerProblem {
  field: ComposerField;
  message: string;
}

// the first thing missing, next to its field; the server checks the same and the rest of YouTube's rules
export function composerProblem(values: ComposerValues, now: Date): ComposerProblem | null {
  if (!values.connectionId) return { field: 'connection', message: 'Choose the YouTube channel to upload to.' };
  if (!values.hasVideo) return { field: 'video', message: 'Choose the video file to upload.' };
  if (!values.title.trim()) return { field: 'title', message: 'Give the video a title.' };
  if ([...values.title].length > TITLE_MAX) return { field: 'title', message: `Keep the title to ${TITLE_MAX} characters.` };
  if (/[<>]/.test(values.title)) return { field: 'title', message: 'YouTube does not accept < or > in a title.' };
  if (values.madeForKids === null) return { field: 'madeForKids', message: 'Say whether the video is made for kids. YouTube requires an answer.' };
  if (values.scheduled) {
    const when = new Date(values.publishAt);
    if (!values.publishAt || Number.isNaN(when.getTime())) return { field: 'schedule', message: 'Set the date and time to publish.' };
    if (when <= now) return { field: 'schedule', message: 'Pick a time in the future.' };
  }
  return null;
}

export interface YouTubeOAuthReturn {
  code: string;
  state: string;
}

// the callback hands the code back in the fragment, which never reaches a server
export function readYouTubeReturn(hash: string): YouTubeOAuthReturn | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const code = params.get('yt_code');
  const state = params.get('yt_state');
  return code && state ? { code, state } : null;
}
