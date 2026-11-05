import { execute } from './query.ts';
import type { SupabaseClient } from '../types/app.ts';

export type QuotaBucket = 'uploads' | 'default';

// the Google project's daily YouTube allowance across all users; a reservation is taken before each call, so the ledger
// stops calls before Google refuses them
export interface YouTubeQuotaLedgerRepository {
    reserve(day: string, bucket: QuotaBucket, units: number, limit: number): Promise<boolean>;
}

export function createYouTubeQuotaLedgerRepository(db: SupabaseClient): YouTubeQuotaLedgerRepository {
    return {
        async reserve(day, bucket, units, limit) {
            const { data } = await execute('youtubeQuota.reserve', () => db.rpc('reserve_youtube_quota', { p_day: day, p_bucket: bucket, p_units: units, p_limit: limit }));
            return data === true;
        },
    };
}
