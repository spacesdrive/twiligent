// tracked content list helpers; no JSX or path aliases so node --test can import it

import { matchesText } from '../../../lib/library.js';
import { isRedditItem, trackedComments, trackedEngagement, trackedViews } from '../../../utils/trackedContent.js';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const SORT_OPTIONS = [
  { value: 'date-desc',       label: 'Newest first' },
  { value: 'engagement-desc', label: 'Most likes or karma' },
  { value: 'comments-desc',   label: 'Most comments' },
  { value: 'views-desc',      label: 'Most views' },
];

function compareTracked(sort, first, second) {
  if (sort === 'engagement-desc') return trackedEngagement(second) - trackedEngagement(first);
  if (sort === 'comments-desc') return trackedComments(second) - trackedComments(first);
  if (sort === 'views-desc') return trackedViews(second) - trackedViews(first);
  return new Date(second.createdAt || 0) - new Date(first.createdAt || 0);
}

export function filterAndSortTracked(items, { typeFilter, categoryFilter, query, sort }) {
  let result = items;
  if (typeFilter !== 'all') result = result.filter(item => (item.contentType || 'reddit') === typeFilter);
  if (categoryFilter !== 'all') result = result.filter(item => item.category === categoryFilter);
  result = result.filter(item => matchesText([item.title, item.subreddit, item.channelTitle, item.label, item.category], query));
  return [...result].sort((first, second) => compareTracked(sort, first, second));
}

export function categoriesOf(items) {
  return [...new Set(items.map(item => item.category).filter(Boolean))].sort();
}

export function trackedStatsOf(items, categories) {
  return {
    total: items.length,
    categories: categories.length,
    youtube: items.filter(item => item.contentType === 'youtube').length,
    reddit: items.filter(item => isRedditItem(item)).length,
  };
}

export function typeChipsOf(stats) {
  return [
    { value: 'all', label: 'All', count: stats.total },
    { value: 'reddit', label: 'Reddit posts', count: stats.reddit },
    { value: 'youtube', label: 'YouTube videos', count: stats.youtube },
  ];
}

export function pluralize(count, word) {
  const suffix = count !== 1 ? 's' : '';
  return `${word}${suffix}`;
}

export function countLabel(count, word) {
  return `${count} ${pluralize(count, word)}`;
}

export function bulkCategoryMessage(succeeded, failed) {
  const done = `Category set on ${countLabel(succeeded, 'item')}`;
  if (failed > 0) return { message: `${done}. ${failed} could not be updated; try those again.`, severity: 'warning' };
  return { message: done, severity: 'success' };
}

// an empty field clears the views; anything else must be a whole number of 0 or more
export function parseManualViews(raw) {
  const trimmed = raw.trim();
  if (trimmed === '') return { value: null };
  const views = Number(trimmed);
  if (!Number.isInteger(views) || views < 0) return { error: 'Views must be a whole number of 0 or more.' };
  return { value: views };
}

export function imageFileError(file, hasCloudConfig) {
  if (!hasCloudConfig) return 'Image uploads need Cloudinary set up on the server. Check Settings.';
  if (!file.type.startsWith('image/')) return 'That file is not an image. Choose a PNG, JPG or WebP file.';
  if (file.size > MAX_IMAGE_BYTES) return `That image is too large. Choose one under ${MAX_IMAGE_BYTES / 1024 / 1024}MB.`;
  return '';
}
