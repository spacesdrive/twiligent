import { api } from '../../services/api';
import type { InstagramContainerStatusResponse } from '../../../../shared/types/instagram.ts';
import type { MediaType } from '../../../../shared/types/domain.ts';

// tolerant polling survives failed status checks, so it must report each status it sees
export type ContainerWaitOptions =
  | { tolerant: true; onStatus: (message: string) => void; signal?: AbortSignal }
  | { tolerant?: false; onStatus?: undefined; signal?: AbortSignal };

export type ReadyOptions = ContainerWaitOptions & { onProcessing: () => void };

const POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 3000;
const IMAGE_SETTLE_MS = 2000;

// how long a video usually takes, shown next to the time already waited
export const EXPECTED_PROCESSING_SECONDS = 60;
export const MAX_PROCESSING_SECONDS = (POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000;

export const STOPPED_MESSAGE = 'You stopped waiting, so the post was not published. Publish again to try once more.';

// Instagram said the media cannot be used, so asking again will not help
export class ContainerFailedError extends Error {}

export class WaitStoppedError extends Error {
  constructor() {
    super(STOPPED_MESSAGE);
  }
}

// what Instagram's status code means for the person waiting
export function containerStatusMessage(statusCode: string | undefined): string {
  if (statusCode === 'FINISHED' || statusCode === 'PUBLISHED') return 'Instagram finished processing the media.';
  return 'Instagram is still processing the media. Videos usually take under a minute.';
}

export function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new WaitStoppedError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', stop);
      resolve();
    }, ms);
    function stop() {
      clearTimeout(timer);
      reject(new WaitStoppedError());
    }
    signal?.addEventListener('abort', stop, { once: true });
  });
}

function containerFinished(status: Pick<InstagramContainerStatusResponse, 'statusCode' | 'status'>): boolean {
  if (status.statusCode === 'FINISHED' || status.statusCode === 'PUBLISHED') return true;
  if (status.statusCode === 'ERROR') {
    const reason = status.status ? ` Instagram said: ${status.status}.` : '';
    throw new ContainerFailedError(`Instagram couldn't process the media.${reason} Try a shorter MP4 video (H.264 with AAC audio), or try again.`);
  }
  if (status.statusCode === 'EXPIRED') {
    throw new ContainerFailedError('Instagram discarded the upload because it waited too long before publishing. Publish again.');
  }
  return false;
}

async function pollTolerant(containerId: string, accountId: string, onStatus: (message: string) => void): Promise<boolean> {
  try {
    const status = await api.getIGContainerStatus(containerId, accountId);
    onStatus(containerStatusMessage(status.statusCode));
    return containerFinished(status);
  } catch (err) {
    if (err instanceof ContainerFailedError) throw err;
    return false;
  }
}

async function pollStrict(containerId: string, accountId: string): Promise<boolean> {
  const status = await api.getIGContainerStatus(containerId, accountId);
  return containerFinished(status);
}

// publishing an unfinished container fails, so running out of attempts is an error in both modes
export async function waitForContainer(
  containerId: string, accountId: string, options: ContainerWaitOptions = {},
): Promise<void> {
  for (let i = 0; i < POLL_ATTEMPTS; i++) {
    await wait(POLL_INTERVAL_MS, options.signal);
    const finished = options.tolerant
      ? await pollTolerant(containerId, accountId, options.onStatus)
      : await pollStrict(containerId, accountId);
    if (finished) return;
  }
  throw new Error('Instagram took longer than 90 seconds to process the media. Wait a few minutes, then publish again.');
}

// photos need no processing, only a moment before Instagram can publish them
export async function waitUntilReady(
  contentType: MediaType | '', containerId: string, accountId: string, { onProcessing, ...pollOptions }: ReadyOptions,
): Promise<void> {
  if (contentType !== 'REELS' && contentType !== 'STORIES') {
    await wait(IMAGE_SETTLE_MS, pollOptions.signal);
    return;
  }
  onProcessing();
  await waitForContainer(containerId, accountId, pollOptions);
}
