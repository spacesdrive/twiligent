import { UpstreamError, UpstreamTimeoutError } from './errors.ts';

// five failures in a row is an outage, not one unlucky request
const FAILURE_THRESHOLD = 5;
// long enough for a platform blip to pass, short enough that a person trying again a minute later gets through
const OPEN_MS = 30_000;

export interface CircuitOptions {
    // false when the error's status is not an http status, as with Instagram's Graph error codes such as 506
    httpStatus?: boolean;
    now?: () => number;
}

export interface CircuitBreaker {
    run<T>(call: () => Promise<T>, signal?: AbortSignal): Promise<T>;
}

// the Workers runtime refuses a fetch past the invocation's subrequest allowance before anything leaves, so the error
// says this run spent its share, nothing about the platform; one person's busy run must not pause everyone's calls
const SUBREQUEST_LIMIT = /too many subrequests/i;

export function isSubrequestLimit(err: unknown): boolean {
    const cause = (err as { cause?: unknown } | null)?.cause;
    return [err, cause].some(value => value instanceof Error && SUBREQUEST_LIMIT.test(value.message));
}

// a timeout, an unreachable host or a 5xx says the platform is down; a 4xx is about the request, and a call the caller
// cancelled says nothing about the platform
export function isOutage(err: unknown, signal?: AbortSignal, httpStatus = true): boolean {
    if (signal?.aborted || isSubrequestLimit(err)) return false;
    if (err instanceof UpstreamTimeoutError) return true;
    if (!(err instanceof UpstreamError)) return false;
    return err.reason === 'unreachable' || (httpStatus && (err.upstreamStatus ?? 0) >= 500);
}

// one per platform and Worker isolate: while open, calls fail at once instead of waiting on a platform that is down,
// then one trial call decides whether it is back
export function createCircuitBreaker(platform: string, { httpStatus = true, now = Date.now }: CircuitOptions = {}): CircuitBreaker {
    let failures = 0;
    let openUntil = 0;
    let trialRunning = false;

    return {
        async run(call, signal) {
            const open = failures >= FAILURE_THRESHOLD;
            if (open && (now() < openUntil || trialRunning)) {
                // 'unreachable' marks it temporary, so a scheduled post that meets it is tried again later
                throw new UpstreamError(`${platform} is not answering, so calls to it are paused for a moment. Try again in a minute.`, { reason: 'unreachable' });
            }
            if (open) trialRunning = true;
            try {
                const result = await call();
                failures = 0;
                return result;
            } catch (err) {
                if (isOutage(err, signal, httpStatus)) {
                    failures += 1;
                    if (failures >= FAILURE_THRESHOLD) openUntil = now() + OPEN_MS;
                } else if (!signal?.aborted && !isSubrequestLimit(err)) {
                    // the platform answered, even if with an error, so it is up
                    failures = 0;
                }
                throw err;
            } finally {
                if (open) trialRunning = false;
            }
        },
    };
}
