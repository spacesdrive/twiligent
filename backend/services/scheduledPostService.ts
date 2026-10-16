import { NotFoundError, ValidationError } from '../lib/errors.ts';
import { newRowId } from '../lib/ids.ts';
import { publishableAccount } from './publishingService.ts';
import type { AccountRepository } from '../repositories/accountRepository.ts';
import type { ScheduledPostRepository, DeleteAllResult } from '../repositories/scheduledPostRepository.ts';
import type { ScheduledPublisher } from './scheduledPublisher.ts';
import type {
    ScheduledPost, ScheduledPostRequest, ScheduledPostUpdateRequest, ScheduledPublishRun,
} from '../../shared/types/domain.ts';

export interface ScheduledPostDeps {
    accounts: AccountRepository;
    posts: ScheduledPostRepository;
    publisher: ScheduledPublisher;
}

export interface ScheduledPostService {
    list(userId: string): Promise<ScheduledPost[]>;
    create(userId: string, request: ScheduledPostRequest): Promise<ScheduledPost>;
    update(userId: string, postId: string, changes: ScheduledPostUpdateRequest): Promise<ScheduledPost | null>;
    remove(userId: string, postId: string): Promise<void>;
    removeAll(userId: string): Promise<DeleteAllResult>;
    publishDueNow(): Promise<ScheduledPublishRun>;
}

function futureDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
        throw new ValidationError('scheduledAt must be a valid future date');
    }
    return date.toISOString();
}

export function createScheduledPostService({ accounts, posts, publisher }: ScheduledPostDeps): ScheduledPostService {
    async function findOwned(userId: string, postId: string): Promise<ScheduledPost> {
        const post = await posts.findForUser(postId, userId);
        if (!post) throw new NotFoundError('Scheduled post not found');
        return post;
    }

    return {
        list: userId => posts.listForUser(userId),

        // the post may only name one of the user's own Instagram accounts, since the scheduler publishes to it later
        async create(userId, request) {
            const scheduledAt = futureDate(request.scheduledAt);
            publishableAccount(await accounts.findForUser(request.accountId, userId));
            const post: ScheduledPost = {
                id: newRowId(),
                accountId: request.accountId,
                platform: request.platform || 'instagram',
                mediaType: request.mediaType || 'IMAGE',
                mediaUrl: request.mediaUrl,
                caption: request.caption || '',
                coverUrl: request.coverUrl || null,
                shareToFeed: request.shareToFeed !== undefined ? request.shareToFeed : true,
                collaborators: request.collaborators || [],
                audioName: request.audioName || '',
                thumbOffset: request.thumbOffset || null,
                locationId: request.locationId || '',
                userTags: request.userTags || [],
                altText: request.altText || '',
                scheduledAt,
                status: 'pending',
                createdAt: new Date().toISOString(),
                publishedMediaId: null,
                error: null,
            };
            await posts.create(post, userId);
            return post;
        },

        // only a post that has not started publishing can change; the repository checks again in the same write
        async update(userId, postId, changes) {
            const post = await findOwned(userId, postId);
            if (post.status !== 'pending') throw new ValidationError('Can only edit pending posts');
            const updates: Partial<ScheduledPost> = { ...changes };
            if (changes.scheduledAt) updates.scheduledAt = new Date(changes.scheduledAt).toISOString();
            if (!(await posts.updatePendingForUser(postId, updates, userId))) throw new ValidationError('Can only edit pending posts');
            return posts.findForUser(postId, userId);
        },

        async remove(userId, postId) {
            if (await posts.deleteForUser(postId, userId)) return;
            // nothing was deleted: the post is gone, or a scheduler is publishing it
            const post = await findOwned(userId, postId);
            if (post.status === 'publishing') throw new ValidationError('Cannot delete a post that is currently publishing');
            await posts.deleteForUser(postId, userId);
        },

        removeAll: userId => posts.deleteAllForUser(userId),

        // the manual trigger runs the same publisher the cron uses, for every user's due posts
        publishDueNow: () => publisher.publishDue(),
    };
}
