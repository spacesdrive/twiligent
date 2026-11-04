import { fetchTrackedYouTubeData } from './youtube/youtubeTracked.ts';
import { detectContentType, UNSUPPORTED_LINK_MESSAGE } from './trackedContentRules.ts';
import { NotConfiguredError, NotFoundError, ValidationError } from '../lib/errors.ts';
import { newRowId } from '../lib/ids.ts';
import type { TrackedPostRepository, TrackedPostUpdates } from '../repositories/trackedPostRepository.ts';
import type { AppConfig } from '../lib/config.ts';
import type { RequestContext } from '../types/context.ts';
import type { TrackedPost } from '../../shared/types/domain.ts';

export interface TrackedContentDeps {
    tracked: TrackedPostRepository;
    config: AppConfig;
    context: RequestContext;
}

export interface NewTrackedContent {
    url: string;
    label?: string;
    category?: string;
}

export interface TrackedContentChanges {
    label?: string;
    category?: string;
}

export interface TrackedContentService {
    list(userId: string): Promise<TrackedPost[]>;
    add(userId: string, input: NewTrackedContent): Promise<TrackedPost | null>;
    update(userId: string, id: string, changes: TrackedContentChanges): Promise<TrackedPost | null>;
    remove(userId: string, id: string): Promise<void>;
    refresh(userId: string, id: string): Promise<TrackedPost | null>;
}

export function createTrackedContentService({ tracked, config, context }: TrackedContentDeps): TrackedContentService {
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

    async function fetchVideoData(url: string): Promise<Record<string, unknown>> {
        const data = await fetchTrackedYouTubeData(url, youtubeKey(), signal);
        return data as unknown as Record<string, unknown>;
    }

    return {
        list: userId => tracked.listForUser(userId),

        async add(userId, { url, label, category }) {
            if (!detectContentType(url)) throw new ValidationError(UNSUPPORTED_LINK_MESSAGE);
            const data = await fetchVideoData(url);

            const id = newRowId();
            await tracked.create({ id, url, label, category, data }, userId);
            return tracked.findForUser(id, userId);
        },

        async update(userId, id, { label, category }) {
            await findOwned(userId, id);
            const updates: TrackedPostUpdates = {};
            if (label !== undefined) updates.label = label;
            if (category !== undefined) updates.category = category;
            if (Object.keys(updates).length > 0) await tracked.updateForUser(id, updates, userId);
            return tracked.findForUser(id, userId);
        },

        async remove(userId, id) {
            await findOwned(userId, id);
            await tracked.deleteForUser(id, userId);
        },

        async refresh(userId, id) {
            const existing = await findOwned(userId, id);
            await tracked.patchDataForUser(id, await fetchVideoData(existing.url), userId);
            return tracked.findForUser(id, userId);
        },
    };
}
