const DAY_MINUTES = 1440;

export function intervalLabel(minutes) {
  if (minutes >= DAY_MINUTES) return `${minutes / DAY_MINUTES} day${minutes > DAY_MINUTES ? 's' : ''}`;
  return `${minutes / 60} hours`;
}

export function bulkStatsOf(files) {
  const countOf = status => files.filter(file => file.status === status).length;
  return {
    total: files.length,
    pending: countOf('pending'),
    done: countOf('done'),
    scheduled: countOf('scheduled'),
    errors: countOf('error'),
  };
}

export function bulkFilesTitle(count) {
  if (!count) return 'Files';
  return `Files (${count})`;
}

export function bulkActionLabel(scheduleMode, pending) {
  const suffix = pending === 1 ? '' : 's';
  if (scheduleMode) return `Schedule ${pending} post${suffix}`;
  return `Publish ${pending} post${suffix} now`;
}

export function progressHeading(publishStatus) {
  if (publishStatus === 'creating-container') return 'Preparing the post';
  if (publishStatus === 'scheduling') return 'Saving the schedule';
  if (publishStatus === 'processing') return 'Instagram is processing the media';
  return 'Publishing';
}

export function fileSizeMb(file, digits) {
  return (file.size / (1024 * 1024)).toFixed(digits);
}

export function isVideoFile(file) {
  return file.type.startsWith('video/');
}

export function newQueueItem(file, id) {
  return { id, file, preview: URL.createObjectURL(file), caption: '', status: 'pending', progress: 0, error: null, mediaId: null };
}

export function revokePreview(item) {
  if (item?.preview) URL.revokeObjectURL(item.preview);
}

export function removeQueueItem(items, id) {
  revokePreview(items.find(item => item.id === id));
  return items.filter(item => item.id !== id);
}

export function patchQueueItem(items, id, patch) {
  return items.map(item => (item.id === id ? { ...item, ...patch } : item));
}

export function applyCaptionToPending(items, caption) {
  return items.map(item => (item.status === 'pending' ? { ...item, caption } : item));
}
