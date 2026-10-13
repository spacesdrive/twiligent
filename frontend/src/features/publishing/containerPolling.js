import { api } from '../../services/api';

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
