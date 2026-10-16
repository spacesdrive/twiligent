import { fetchTrackedPostData } from './reddit/redditApi.ts';
import { fetchTrackedYouTubeData } from './youtube/youtubeTracked.ts';
import { detectContentType, manualViewsPatch, imageUrlPatch } from './trackedContentRules.ts';
import { NotConfiguredError, NotFoundError, ValidationError } from '../lib/errors.ts';
import { newRowId } from '../lib/ids.ts';
import type { PatchResult, TrackedContentType } from './trackedContentRules.ts';
import type { AccountRepository } from '../repositories/accountRepository.ts';
import type { TrackedPostRepository, TrackedPostUpdates } from '../repositories/trackedPostRepository.ts';
import type { AppConfig } from '../lib/config.ts';
import type { RequestContext } from '../types/context.ts';
import type { TrackedPost } from '../../shared/types/domain.ts';
import type { RedditTrackedPostData } from '../../shared/types/reddit.ts';
import type { YouTubeTrackedVideoData } from '../../shared/types/youtube.ts';

export interface TrackedContentDeps {
    accounts: AccountRepository;
    tracked: TrackedPostRepository;
    config: AppConfig;
    context: RequestContext;
}

export interface NewTrackedContent {
    url: string;
    accountId?: string | null;
    label?: string;
    category?: string;
}

// manualViews and imageUrl arrive as the client sent them; the rules decide what is valid
export interface TrackedContentChanges {
    label?: string;
    category?: string;
    accountId?: string | null;
    manualViews?: unknown;
    imageUrl?: unknown;
}

export interface TrackedContentService {
    list(userId: string): Promise<TrackedPost[]>;
    add(userId: string, input: NewTrackedContent): Promise<TrackedPost | null>;
    update(userId: string, id: string, changes: TrackedContentChanges): Promise<TrackedPost | null>;
    remove(userId: string, id: string): Promise<void>;
    refresh(userId: string, id: string): Promise<TrackedPost | null>;
}

type TrackedData = YouTubeTrackedVideoData | RedditTrackedPostData;

function patchOrThrow<P>(result: PatchResult<P>): P {
    if (result.error !== undefined) throw new ValidationError(result.error);
    return result.patch;
}

export function createTrackedContentService({ accounts, tracked, config, context }: TrackedContentDeps): TrackedContentService {
    const { signal } = context;

    function youtubeKey(): string {
        if (!config.youtubeApiKey) throw new NotConfiguredError('YouTube API key not configured on this server');
        return config.youtubeApiKey;
    }

    async function findOwned(userId: string, id: string): Promise<TrackedPost> {
        const item = await tracked.findForUser(id, userId);
        if (!item) throw new NotFoundError('Tracked content not found');
        return item;
    }

    // a named account must be one of the user's Reddit accounts; no account means no cookie
    async function redditCookie(userId: string, accountId: string | null | undefined, strict: boolean): Promise<string | null> {
        if (!accountId) return null;
        const account = await accounts.findForUser(accountId, userId);
        if (strict && (!account || account.platform !== 'reddit')) throw new NotFoundError('Reddit account not found');
        return account?.cookie || null;
    }

    // only Reddit items read through an account, and it must be one of the user's own Reddit accounts
    async function checkedAccountId(userId: string, accountId: string | null, isYouTube: boolean): Promise<string | null> {
        if (!accountId) return null;
        if (isYouTube) throw new ValidationError('YouTube videos are read without an account; remove the account from this item.');
        await redditCookie(userId, accountId, true);
        return accountId;
    }

    async function fetchData(userId: string, contentType: TrackedContentType, url: string, accountId: string | null | undefined, strict: boolean): Promise<TrackedData> {
        if (contentType === 'youtube') return fetchTrackedYouTubeData(url, youtubeKey(), signal);
        return fetchTrackedPostData(url, await redditCookie(userId, accountId, strict), signal);
    }

    return {
        list: userId => tracked.listForUser(userId),

        async add(userId, { url, accountId, label, category }) {
            const contentType = detectContentType(url);
            if (!contentType) throw new ValidationError('Only Reddit and YouTube URLs are supported');
            const data = await fetchData(userId, contentType, url, accountId, true);

            const id = newRowId();
            const fetched = data as unknown as Record<string, unknown>;
            await tracked.create({ id, accountId: contentType === 'youtube' ? null : (accountId || null), url, label, category, contentType, data: fetched }, userId);
            return tracked.findForUser(id, userId);
        },

        async update(userId, id, { label, category, accountId, manualViews, imageUrl }) {
            const existing = await findOwned(userId, id);
            const isYouTube = (existing.contentType || 'reddit') === 'youtube';

            if (manualViews !== undefined) await tracked.patchDataForUser(id, patchOrThrow(manualViewsPatch(manualViews, isYouTube)), userId);
            if (imageUrl !== undefined) await tracked.patchDataForUser(id, patchOrThrow(imageUrlPatch(imageUrl, isYouTube)), userId);

            const updates: TrackedPostUpdates = {};
            if (label !== undefined) updates.label = label;
            if (category !== undefined) updates.category = category;
            if (accountId !== undefined) updates.accountId = await checkedAccountId(userId, accountId, isYouTube);
            if (Object.keys(updates).length > 0) await tracked.updateForUser(id, updates, userId);

            return tracked.findForUser(id, userId);
        },

        async remove(userId, id) {
            await findOwned(userId, id);
            await tracked.deleteForUser(id, userId);
        },

        // patched rather than replaced, so a manually entered view count survives the refresh
        async refresh(userId, id) {
            const existing = await findOwned(userId, id);
            const data = await fetchData(userId, existing.contentType === 'youtube' ? 'youtube' : 'reddit', existing.url, existing.accountId, false);
            await tracked.patchDataForUser(id, data as unknown as Record<string, unknown>, userId);
            return tracked.findForUser(id, userId);
        },
    };
}
