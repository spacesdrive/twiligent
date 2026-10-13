import { api } from '../../services/api';
import type { InstagramContainerStatusResponse } from '../../../../shared/types/instagram.ts';
import type { MediaType } from '../../../../shared/types/domain.ts';

// tolerant polling survives failed status checks, so it must report each status it sees
export type ContainerWaitOptions =
  | { tolerant: true; onStatus: (message: string) => void }
  | { tolerant?: false; onStatus?: undefined };

export type ReadyOptions = ContainerWaitOptions & { onProcessing: () => void };

const POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 3000;
const IMAGE_SETTLE_MS = 2000;

export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function containerFinished(status: Pick<InstagramContainerStatusResponse, 'statusCode'>, failedMessage: string): boolean {
  if (status.statusCode === 'FINISHED' || status.statusCode === 'PUBLISHED') return true;
  if (status.statusCode === 'ERROR') throw new Error(failedMessage);
  if (status.statusCode === 'EXPIRED') throw new Error('Container expired');
  return false;
}

async function pollTolerant(containerId: string, accountId: string, onStatus: (message: string) => void): Promise<boolean> {
  try {
    const status = await api.getIGContainerStatus(containerId, accountId);
    onStatus(`Instagram status: ${status.statusCode || 'IN_PROGRESS'}`);
    return containerFinished(status, 'Container processing failed: ' + (status.status || 'Unknown'));
  } catch (err) {
    if ((err as Error).message.includes('processing failed') || (err as Error).message.includes('expired')) throw err;
    return false;
  }
}

async function pollStrict(containerId: string, accountId: string): Promise<boolean> {
  const status = await api.getIGContainerStatus(containerId, accountId);
  return containerFinished(status, 'Processing failed');
}

// publishing an unfinished container fails, so running out of attempts is an error in both modes
export async function waitForContainer(
  containerId: string, accountId: string, options: ContainerWaitOptions = {},
): Promise<void> {
  for (let i = 0; i < POLL_ATTEMPTS; i++) {
    await wait(POLL_INTERVAL_MS);
    const finished = options.tolerant
      ? await pollTolerant(containerId, accountId, options.onStatus)
      : await pollStrict(containerId, accountId);
    if (finished) return;
  }
  throw new Error('Instagram took too long to process the media. Try again in a few minutes.');
}

// photos need no processing, only a moment before Instagram can publish them
export async function waitUntilReady(
  contentType: MediaType | '', containerId: string, accountId: string, { onProcessing, ...pollOptions }: ReadyOptions,
): Promise<void> {
  if (contentType !== 'REELS' && contentType !== 'STORIES') {
    await wait(IMAGE_SETTLE_MS);
    return;
  }
  onProcessing();
  await waitForContainer(containerId, accountId, pollOptions);
}
