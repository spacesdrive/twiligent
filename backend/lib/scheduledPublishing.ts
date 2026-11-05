import type { InstagramContainerStatusCode } from '../../shared/types/instagram.ts';

// both schedulers follow these rules; scripts/publish-scheduled.ts imports this file, so it must import nothing at runtime

// the Worker's cron deadline and the GitHub job's time limit are both 14 minutes, so an older claim belongs to a run that died
export const PUBLISH_LEASE_MS = 20 * 60 * 1000;

// three runs of a 15 minute scheduler give a passing Instagram or network problem about half an hour to clear
export const MAX_PUBLISH_ATTEMPTS = 3;

// Graph API codes Meta documents as temporary: unknown and service errors, rate limits, and media that is not ready yet
const TRANSIENT_GRAPH_CODES = new Set([-1, 1, 2, 4, 17, 341, 9007]);

export type ContainerStep = 'published' | 'publish' | 'wait' | 'recreate' | 'fail';

export type FailureOutcome = 'retry' | 'fail';

// what a run does with the container an earlier attempt left, from the container's status on Instagram
export function containerStep(statusCode: InstagramContainerStatusCode): ContainerStep {
    if (statusCode === 'PUBLISHED') return 'published';
    if (statusCode === 'FINISHED') return 'publish';
    if (statusCode === 'EXPIRED') return 'recreate';
    if (statusCode === 'ERROR') return 'fail';
    return 'wait';
}

export function isTransientGraphCode(code: number | undefined): boolean {
    return code !== undefined && TRANSIENT_GRAPH_CODES.has(code);
}

export function staleClaimCutoff(now: number): string {
    return new Date(now - PUBLISH_LEASE_MS).toISOString();
}

// attempts counts the claim being settled, so the third failure of a passing problem is final
export function failureOutcome(transient: boolean, attempts: number): FailureOutcome {
    return transient && attempts < MAX_PUBLISH_ATTEMPTS ? 'retry' : 'fail';
}

export function failureMessage(reason: string, transient: boolean, attempts: number): string {
    if (!transient || attempts < MAX_PUBLISH_ATTEMPTS) return reason;
    return `${reason.replace(/\.?$/, '.')} Publishing stopped after ${MAX_PUBLISH_ATTEMPTS} attempts; schedule the post again.`;
}

// one account's backlog must not hold every other account's posts back for the whole run, so due posts take turns by
// account, oldest first; five a run still clears a 50 post backlog in under three hours of quarter-hour runs
export const MAX_POSTS_PER_ACCOUNT_PER_RUN = 5;

export function fairPublishOrder<T extends { accountId: string; scheduledAt: string }>(due: T[], perAccount = MAX_POSTS_PER_ACCOUNT_PER_RUN): T[] {
    const queues = new Map<string, T[]>();
    for (const post of [...due].sort((first, second) => first.scheduledAt.localeCompare(second.scheduledAt))) {
        const queue = queues.get(post.accountId) ?? [];
        if (queue.length < perAccount) queue.push(post);
        queues.set(post.accountId, queue);
    }
    const ordered: T[] = [];
    for (let turn = 0; turn < perAccount; turn++) {
        for (const queue of queues.values()) if (queue[turn]) ordered.push(queue[turn]);
    }
    return ordered;
}
