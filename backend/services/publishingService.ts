import {
    buildMediaParams, createMediaContainer, fetchContainerStatus, publishMediaContainer, fetchPublishingLimit,
} from './instagram/instagramPublishing.ts';
import { NotConfiguredError, NotFoundError, ValidationError } from '../lib/errors.ts';
import type { ContainerStatus } from './instagram/instagramPublishing.ts';
import type { AccountRepository } from '../repositories/accountRepository.ts';
import type { AppConfig, CloudinaryConfig } from '../lib/config.ts';
import type { RequestContext } from '../types/context.ts';
import type { Account } from '../../shared/types/domain.ts';
import type { InstagramPublishingLimit, InstagramPublishRequest } from '../../shared/types/instagram.ts';

export interface PublishingDeps {
    accounts: AccountRepository;
    config: AppConfig;
    context: RequestContext;
}

export interface PublishingService {
    cloudinaryConfig(): CloudinaryConfig;
    publishingLimit(userId: string, accountId: string): Promise<InstagramPublishingLimit[]>;
    createContainer(userId: string, accountId: string, post: InstagramPublishRequest): Promise<string>;
    containerStatus(userId: string, accountId: string, containerId: string): Promise<ContainerStatus>;
    publishContainer(userId: string, accountId: string, containerId: string): Promise<string>;
}

export type PublishableAccount = Account & { igUserId: string; accessToken: string };

export const NO_INSTAGRAM_TOKEN_MESSAGE = 'No Instagram access token stored - reconnect this account';

// the only accounts that can publish: Instagram, with the id and token the Graph API calls need
export function publishableAccount(account: Account | null): PublishableAccount {
    if (!account || account.platform !== 'instagram') throw new NotFoundError('Instagram account not found');
    if (!account.accessToken || !account.igUserId) throw new ValidationError(NO_INSTAGRAM_TOKEN_MESSAGE);
    return { ...account, igUserId: account.igUserId, accessToken: account.accessToken };
}

export function createPublishingService({ accounts, config, context }: PublishingDeps): PublishingService {
    const { signal } = context;

    async function findPublishable(userId: string, accountId: string): Promise<PublishableAccount> {
        return publishableAccount(await accounts.findForUser(accountId, userId));
    }

    return {
        cloudinaryConfig() {
            if (!config.cloudinary) throw new NotConfiguredError('Cloudinary not configured on server');
            return config.cloudinary;
        },

        async publishingLimit(userId, accountId) {
            const account = await findPublishable(userId, accountId);
            return fetchPublishingLimit(account.igUserId, account.accessToken, signal);
        },

        async createContainer(userId, accountId, post) {
            const account = await findPublishable(userId, accountId);
            return createMediaContainer(account.igUserId, buildMediaParams(post, account.accessToken), signal);
        },

        async containerStatus(userId, accountId, containerId) {
            const account = await findPublishable(userId, accountId);
            return fetchContainerStatus(containerId, account.accessToken, signal);
        },

        async publishContainer(userId, accountId, containerId) {
            const account = await findPublishable(userId, accountId);
            return publishMediaContainer(account.igUserId, containerId, account.accessToken, signal);
        },
    };
}
