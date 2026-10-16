// the reply queue's health, as the five minute run reads it, and the warnings worth a log line

// replies are dispatched every minute, so one due for this long means runs are not keeping up
export const BEHIND_AFTER_MS = 10 * 60 * 1000;

export interface QueueHealth {
    due: number;
    oldestDueAt: string | null;
    waiting: number;
    stale: number;
    needsReview: number;
    followupsDue: number;
    // public replies under comments: due now, the oldest due, held by runs that stopped, and of unknown outcome
    publicDue: number;
    publicOldestDueAt: string | null;
    publicStale: number;
    publicNeedsReview: number;
    pausedAccounts: number;
    limitedAccounts: number;
}

// at most one line per run, however many things are wrong, so a large incident does not flood the logs
export function healthWarning(health: QueueHealth, now: number): string | null {
    const problems: string[] = [];
    const behindMs = health.oldestDueAt ? now - Date.parse(health.oldestDueAt) : 0;
    if (behindMs > BEHIND_AFTER_MS) problems.push(`the oldest due reply has waited ${Math.round(behindMs / 60_000)} minutes`);
    if (health.stale > 0) problems.push(`${health.stale} replies are held by runs that stopped`);
    const publicBehindMs = health.publicOldestDueAt ? now - Date.parse(health.publicOldestDueAt) : 0;
    if (publicBehindMs > BEHIND_AFTER_MS) problems.push(`the oldest due public reply has waited ${Math.round(publicBehindMs / 60_000)} minutes`);
    if (health.publicStale > 0) problems.push(`${health.publicStale} public replies are held by runs that stopped`);
    return problems.length > 0 ? `automation queue behind: ${problems.join('; ')}` : null;
}
