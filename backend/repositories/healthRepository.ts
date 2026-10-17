import { execute } from './query.ts';
import type { SupabaseClient } from '../types/app.ts';

export interface HealthRepository {
    ping(): Promise<void>;
}

export function createHealthRepository(db: SupabaseClient): HealthRepository {
    return {
        // the smallest read the service key can make; it proves the database answers, not that every query is healthy
        async ping() {
            await execute('health.ping', () => db.from('accounts').select('id').limit(1));
        },
    };
}
