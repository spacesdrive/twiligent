const MINUTE_MS = 60000;

export function parseUserTags(text) {
  return text.split(',').map(entry => {
    const parts = entry.trim().replace(/^@/, '').split(/\s+/);
    return { username: parts[0], x: parts[1] ? parseFloat(parts[1]) : 0.5, y: parts[2] ? parseFloat(parts[2]) : 0.5 };
  }).filter(tag => tag.username);
}

export function parseCollaborators(text) {
  return text.split(',').map(name => name.trim()).filter(Boolean);
}

export function buildScheduledPostPayload(post) {
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

export function buildContainerPayload(post) {
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
export function bulkPostDetails(settings, item, mediaUrl) {
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

export function singleUploadMessage(err) {
  if (err.reason === 'network') return 'The upload lost its network connection. Check your connection and try again.';
  if (err.reason === 'rejected') return err.cloudinaryMessage || 'Upload failed';
  return err.message;
}

export function singlePostError({ selectedAccount, file, contentType, hasCloudConfig, fields, now }) {
  if (!selectedAccount || !file || !contentType) return 'Choose an account, a content type and a file before publishing.';
  if (!hasCloudConfig) return 'Cloudinary is not set up on the server. Check Settings.';
  if (!fields.scheduleMode) return '';
  if (!fields.scheduleDate || !fields.scheduleTime) return 'Set a date and time for the scheduled post.';
  if (new Date(`${fields.scheduleDate}T${fields.scheduleTime}`) <= now) return 'Pick a time in the future.';
  return '';
}

export function bulkBaseTime(settings) {
  return settings.scheduleMode ? new Date(`${settings.startDate}T${settings.startTime}`) : null;
}

export function bulkStartError({ settings, fileCount, hasCloudConfig, now }) {
  if (!settings.account || fileCount === 0 || !settings.contentType) return 'Choose an account, a content type and at least one file.';
  if (!hasCloudConfig) return 'Cloudinary is not set up on the server. Check Settings.';
  if (settings.scheduleMode && (!settings.startDate || !settings.startTime)) return 'Set a start date and time for the schedule.';
  const baseTime = bulkBaseTime(settings);
  if (baseTime && baseTime <= now) return 'Pick a start time in the future.';
  return '';
}

export function editPostError({ postId, date, time, now }) {
  if (!postId || !date || !time) return 'Set a date and time.';
  if (new Date(`${date}T${time}`) <= now) return 'Pick a time in the future.';
  return '';
}

export function bulkScheduledTime(baseTime, offset, intervalMinutes) {
  return new Date(baseTime.getTime() + offset * intervalMinutes * MINUTE_MS);
}
