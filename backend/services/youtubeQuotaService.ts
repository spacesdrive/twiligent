import { RateLimitedError } from '../lib/errors.ts';
import { QUOTA_USED_MESSAGE, USER_DAILY_UNITS, pacificDay } from '../lib/youtubeQuota.ts';
import type { YouTubeQuotaRepository } from '../repositories/youtubeQuotaRepository.ts';
import type { MeteredYouTubeKey } from './youtube/youtubeApi.ts';

export interface YouTubeQuotaDeps {
    quota: YouTubeQuotaRepository;
    now?: () => number;
}

export interface YouTubeQuotaService {
    // runs one YouTube operation for a member: refused once they used their daily share, and its units are recorded after
    run<T>(userId: string, apiKey: string, work: (key: MeteredYouTubeKey) => Promise<T>): Promise<T>;
}

// the instance shares one YouTube Data API quota; this keeps one member from spending it for everyone (audit lead L6)
export function createYouTubeQuotaService({ quota, now = Date.now }: YouTubeQuotaDeps): YouTubeQuotaService {
    return {
        async run(userId, apiKey, work) {
            const day = pacificDay(now());
            const used = await quota.usedForUser(userId, day);
            if (used !== null && used >= USER_DAILY_UNITS) throw new RateLimitedError(QUOTA_USED_MESSAGE);
            let spent = 0;
            try {
                return await work({ key: apiKey, spend: units => { spent += units; } });
            } finally {
                // one write per operation, however many calls it made, so metering costs at most two subrequests
                await quota.addForUser(userId, day, spent);
            }
        },
    };
}

// for code paths that have no member to charge, such as tests and tools that do not touch YouTube
export const UNMETERED_YOUTUBE_QUOTA: YouTubeQuotaService = {
    run: (_userId, apiKey, work) => work({ key: apiKey, spend: () => undefined }),
};
