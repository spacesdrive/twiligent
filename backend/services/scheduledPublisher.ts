import { buildMediaParams, createMediaContainer, fetchContainerStatus, publishMediaContainer } from './instagram/instagramPublishing.ts';
import { publishableAccount } from './publishingService.ts';
import { NotFoundError, UpstreamError } from '../lib/errors.ts';
import { errorFields } from '../lib/logger.ts';
import type { AccountRepository } from '../repositories/accountRepository.ts';
import type { ScheduledPostRepository } from '../repositories/scheduledPostRepository.ts';
import type { RequestContext } from '../types/context.ts';
import type { ScheduledPost, ScheduledPublishFailure, ScheduledPublishRun } from '../../shared/types/domain.ts';
import type { InstagramPublishMediaType } from '../../shared/types/instagram.ts';

export interface ScheduledPublisherDeps {
    accounts: AccountRepository;
    posts: ScheduledPostRepository;
    context: RequestContext;
}

export interface ScheduledPublisher {
    publishDue(): Promise<ScheduledPublishRun>;
}

const STATUS_POLLS = 60;
const STATUS_POLL_MS = 3000;
const IMAGE_SETTLE_MS = 2000;

function wait(ms: number): Promise<void> {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
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

    async function publishPost(post: ScheduledPost): Promise<string> {
        const found = await accounts.findById(post.accountId);
        if (!found) throw new NotFoundError('Account not found: ' + post.accountId);
        if (found.platform !== 'instagram') throw new UpstreamError('Scheduled posts can only publish to Instagram accounts');
        const account = publishableAccount(found);

        const containerId = await createMediaContainer(account.igUserId, buildMediaParams(post, account.accessToken), signal);
        await waitForContainer(post.mediaType, containerId, account.accessToken);
        return publishMediaContainer(account.igUserId, containerId, account.accessToken, signal);
    }

    return {
        async publishDue() {
            let processed = 0;
            const errors: ScheduledPublishFailure[] = [];
            let due: ScheduledPost[];
            try {
                due = await posts.listDue();
            } catch (err) {
                log.error('scheduler could not load due posts', errorFields(err));
                return { processed, errors };
            }

            for (const post of due) {
                // false when the other scheduler claimed it first
                if (!(await posts.claim(post.id))) continue;
                try {
                    const mediaId = await publishPost(post);
                    await posts.updateById(post.id, { status: 'published', publishedMediaId: mediaId, publishedAt: new Date().toISOString() });
                    processed++;
                    log.info('scheduled post published', { postId: post.id, mediaId });
                } catch (err) {
                    const message = (err as Error).message;
                    await posts.updateById(post.id, { status: 'failed', error: message });
                    errors.push({ id: post.id, error: message });
                    log.error('scheduled post failed', { postId: post.id, ...errorFields(err) });
                }
            }
            return { processed, errors };
        },
    };
}
