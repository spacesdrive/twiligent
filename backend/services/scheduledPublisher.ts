import { buildMediaParams, createMediaContainer, fetchContainerStatus, publishMediaContainer } from './instagram/instagramPublishing.ts';
import { publishableAccount } from './publishingService.ts';
import { DatabaseError, NotFoundError, UpstreamError, UpstreamTimeoutError, isAbortError } from '../lib/errors.ts';
import { errorFields } from '../lib/logger.ts';
import {
    MAX_PUBLISH_ATTEMPTS, containerStep, failureMessage, failureOutcome, isTransientGraphCode, staleClaimCutoff,
} from '../lib/scheduledPublishing.ts';
import type { AccountRepository } from '../repositories/accountRepository.ts';
import type { ScheduledPostRepository } from '../repositories/scheduledPostRepository.ts';
import type { PublishableAccount } from './publishingService.ts';
import type { RequestContext } from '../types/context.ts';
import type { ScheduledPost, ScheduledPublishFailure, ScheduledPublishRun } from '../../shared/types/domain.ts';
import type { InstagramContainerStatusCode, InstagramPublishMediaType } from '../../shared/types/instagram.ts';

export interface ScheduledPublisherDeps {
    accounts: AccountRepository;
    posts: ScheduledPostRepository;
    context: RequestContext;
}

export interface ScheduledPublisher {
    publishDue(): Promise<ScheduledPublishRun>;
}

// what one claimed post ended as; 'left' means the outcome on Instagram is unknown and the lease decides later
type Settled = 'published' | 'retry' | 'failed' | 'left';

// the parts of an attempt the error path needs to find out what happened on Instagram
interface Attempt {
    account: PublishableAccount | null;
    containerId: string | null;
}

const STATUS_POLLS = 60;
const STATUS_POLL_MS = 3000;
const IMAGE_SETTLE_MS = 2000;

function wait(ms: number): Promise<void> {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}

// timeouts, unreachable hosts, database hiccups and Instagram's temporary codes clear on their own; the rest need a person
function isTransientFailure(err: unknown): boolean {
    if (err instanceof UpstreamTimeoutError || err instanceof DatabaseError) return true;
    if (err instanceof UpstreamError) return err.reason === 'unreachable' || isTransientGraphCode(err.upstreamStatus);
    return isAbortError(err);
}

// publishes every user's due posts, so it runs from the cron job or the manual trigger, never per user
export function createScheduledPublisher({ accounts, posts, context }: ScheduledPublisherDeps): ScheduledPublisher {
    const { signal, log } = context;

    // reels and stories need processing; other media only need a short pause
    async function waitForContainer(mediaType: InstagramPublishMediaType | undefined, containerId: string, token: string): Promise<void> {
        if (mediaType !== 'REELS' && mediaType !== 'STORIES') {
            await wait(IMAGE_SETTLE_MS);
            return;
        }
        for (let i = 0; i < STATUS_POLLS; i++) {
            await wait(STATUS_POLL_MS);
            const { statusCode, status } = await fetchContainerStatus(containerId, token, signal);
            if (statusCode === 'FINISHED' || statusCode === 'PUBLISHED') return;
            if (statusCode === 'ERROR') throw new UpstreamError('Processing failed: ' + status);
            if (statusCode === 'EXPIRED') throw new UpstreamError('Container expired');
        }
        throw new UpstreamError('Instagram did not finish processing the media within 3 minutes');
    }

    // a container from an earlier attempt is checked first, so a post that already went out is never published again
    async function publishPost(post: ScheduledPost, attempt: Attempt): Promise<string | null> {
        const found = await accounts.findById(post.accountId);
        if (!found) throw new NotFoundError('Account not found: ' + post.accountId);
        if (found.platform !== 'instagram') throw new UpstreamError('Scheduled posts can only publish to Instagram accounts');
        const account = publishableAccount(found);
        attempt.account = account;

        if (attempt.containerId) {
            const { statusCode, status } = await fetchContainerStatus(attempt.containerId, account.accessToken, signal);
            const step = containerStep(statusCode);
            if (step === 'published') return null;
            if (step === 'fail') throw new UpstreamError('Processing failed: ' + status);
            if (step === 'recreate') attempt.containerId = null;
        }
        if (!attempt.containerId) {
            const containerId = await createMediaContainer(account.igUserId, buildMediaParams(post, account.accessToken), signal);
            await posts.updateById(post.id, { containerId });
            attempt.containerId = containerId;
        }
        await waitForContainer(post.mediaType, attempt.containerId, account.accessToken);
        return publishMediaContainer(account.igUserId, attempt.containerId, account.accessToken, signal);
    }

    async function containerStatus({ account, containerId }: Attempt): Promise<InstagramContainerStatusCode | null> {
        if (!account || !containerId) return null;
        return (await fetchContainerStatus(containerId, account.accessToken, signal)).statusCode;
    }

    // an error before Instagram could have published needs no check; after that, the container's status decides
    async function settleFailure(post: ScheduledPost, attempt: Attempt, err: unknown, transientError = isTransientFailure(err)): Promise<Settled> {
        let statusCode: InstagramContainerStatusCode | null;
        try {
            statusCode = await containerStatus(attempt);
        } catch (checkErr) {
            log.warn('scheduled post left for the next run', { postId: post.id, reason: 'container status unknown', ...errorFields(checkErr) });
            return 'left';
        }
        if (statusCode === 'PUBLISHED') {
            await posts.updateById(post.id, { status: 'published', publishedAt: new Date().toISOString(), error: null });
            return 'published';
        }

        const attempts = post.attempts ?? 1;
        const transient = transientError || statusCode === 'IN_PROGRESS' || statusCode === 'EXPIRED';
        const reason = (err as Error).message;
        if (failureOutcome(transient, attempts) === 'retry') {
            await posts.updateById(post.id, { status: 'pending', error: reason, ...(statusCode === 'EXPIRED' && { containerId: null }) });
            log.warn('scheduled post will be retried', { postId: post.id, attempts, ...errorFields(err) });
            return 'retry';
        }
        await posts.updateById(post.id, { status: 'failed', error: failureMessage(reason, transient, attempts) });
        log.error('scheduled post failed', { postId: post.id, attempts, ...errorFields(err) });
        return 'failed';
    }

    async function settle(post: ScheduledPost, attempt: Attempt, err: unknown, errors: ScheduledPublishFailure[], transient?: boolean): Promise<Settled> {
        try {
            const settled = await settleFailure(post, attempt, err, transient);
            if (settled === 'failed') errors.push({ id: post.id, error: (err as Error).message });
            return settled;
        } catch (writeErr) {
            // the claim stays, so the next run after the lease finds out what happened from the saved container
            log.error('scheduled post left for the next run', { postId: post.id, reason: 'could not save the outcome', ...errorFields(writeErr) });
            return 'left';
        }
    }

    async function publishClaimed(post: ScheduledPost, errors: ScheduledPublishFailure[]): Promise<Settled> {
        const attempt: Attempt = { account: null, containerId: post.containerId ?? null };

        // a post taken over after its last attempt is only checked on Instagram, never started again
        if ((post.attempts ?? 1) > MAX_PUBLISH_ATTEMPTS) {
            attempt.account = await accounts.findById(post.accountId).then(publishableAccount).catch(() => null);
            return settle(post, attempt, new Error('The publishing run stopped before it finished.'), errors, true);
        }

        try {
            const mediaId = await publishPost(post, attempt);
            await posts.updateById(post.id, { status: 'published', publishedMediaId: mediaId, publishedAt: new Date().toISOString(), error: null });
            log.info('scheduled post published', { postId: post.id, mediaId });
            return 'published';
        } catch (err) {
            return settle(post, attempt, err, errors);
        }
    }

    return {
        async publishDue() {
            let processed = 0;
            const errors: ScheduledPublishFailure[] = [];
            let candidates: ScheduledPost[];
            try {
                const [due, stale] = await Promise.all([posts.listDue(), posts.listStale(staleClaimCutoff(Date.now()))]);
                candidates = [...stale, ...due];
            } catch (err) {
                log.error('scheduler could not load due posts', errorFields(err));
                return { processed, errors };
            }

            for (const candidate of candidates) {
                // past the run's deadline every Instagram call fails, so a new claim would only sit out the lease
                if (signal.aborted) break;
                let post: ScheduledPost | null;
                try {
                    // null when the other scheduler claimed it first
                    post = await posts.claim(candidate);
                } catch (err) {
                    log.error('scheduler could not claim a post', { postId: candidate.id, ...errorFields(err) });
                    continue;
                }
                if (!post) continue;
                if (candidate.status === 'publishing') log.warn('scheduled post taken over after its claim expired', { postId: post.id, attempts: post.attempts });
                if (await publishClaimed(post, errors) === 'published') processed++;
            }
            return { processed, errors };
        },
    };
}
