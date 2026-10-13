export type QueueItemStatus =
  | 'pending' | 'uploading' | 'creating' | 'processing' | 'publishing' | 'scheduling' | 'done' | 'scheduled' | 'error';

export interface QueueItem {
  id: number;
  file: File;
  preview: string;
  caption: string;
  status: QueueItemStatus;
  progress: number;
  error: string | null;
  mediaId: string | null;
}

export type QueueItemPatch = Partial<Omit<QueueItem, 'id' | 'file' | 'preview'>>;

export interface BulkStats {
  total: number;
  pending: number;
  done: number;
  scheduled: number;
  errors: number;
}

// an empty status is the form before a run
export type PublishStatus =
  | '' | 'uploading-cloudinary' | 'creating-container' | 'processing' | 'publishing' | 'scheduling' | 'scheduled' | 'done' | 'error';

const DAY_MINUTES = 1440;

export function intervalLabel(minutes: number): string {
  if (minutes >= DAY_MINUTES) return `${minutes / DAY_MINUTES} day${minutes > DAY_MINUTES ? 's' : ''}`;
  return `${minutes / 60} hours`;
}

export function bulkStatsOf(files: readonly Pick<QueueItem, 'status'>[]): BulkStats {
  const countOf = (status: QueueItemStatus) => files.filter(file => file.status === status).length;
  return {
    total: files.length,
    pending: countOf('pending'),
    done: countOf('done'),
    scheduled: countOf('scheduled'),
    errors: countOf('error'),
  };
}

export function bulkFilesTitle(count: number): string {
  if (!count) return 'Files';
  return `Files (${count})`;
}

export function bulkActionLabel(scheduleMode: boolean, pending: number): string {
  const suffix = pending === 1 ? '' : 's';
  if (scheduleMode) return `Schedule ${pending} post${suffix}`;
  return `Publish ${pending} post${suffix} now`;
}

export function progressHeading(publishStatus: PublishStatus): string {
  if (publishStatus === 'creating-container') return 'Preparing the post';
  if (publishStatus === 'scheduling') return 'Saving the schedule';
  if (publishStatus === 'processing') return 'Instagram is processing the media';
  return 'Publishing';
}

export function fileSizeMb(file: Pick<File, 'size'>, digits: number): string {
  return (file.size / (1024 * 1024)).toFixed(digits);
}

export function isVideoFile(file: Pick<File, 'type'>): boolean {
  return file.type.startsWith('video/');
}

export function newQueueItem(file: File, id: number): QueueItem {
  return { id, file, preview: URL.createObjectURL(file), caption: '', status: 'pending', progress: 0, error: null, mediaId: null };
}

export function revokePreview(item: { preview?: string } | undefined): void {
  if (item?.preview) URL.revokeObjectURL(item.preview);
}

export function removeQueueItem<T extends { id: number; preview?: string }>(items: T[], id: number): T[] {
  revokePreview(items.find(item => item.id === id));
  return items.filter(item => item.id !== id);
}

export function patchQueueItem<T extends { id: number }>(items: T[], id: number, patch: Partial<NoInfer<T>>): T[] {
  return items.map(item => (item.id === id ? { ...item, ...patch } : item));
}

export function applyCaptionToPending<T extends { status: QueueItemStatus; caption: string }>(items: T[], caption: string): T[] {
  return items.map(item => (item.status === 'pending' ? { ...item, caption } : item));
}
