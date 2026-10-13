import { execute, maybeRow } from './query.ts';
import type { SupabaseClient } from '../types/app.ts';

export type Settings = Record<string, unknown>;

// rows are keyed by (user_id, key); every saved value lives under 'api_keys'
const SETTINGS_KEY = 'api_keys';

export interface SettingsRepository {
    getForUser(userId: string): Promise<Settings>;
    saveForUser(settings: Settings, userId: string): Promise<void>;
}

export function createSettingsRepository(db: SupabaseClient): SettingsRepository {
    return {
        async getForUser(userId) {
            const row = await maybeRow<{ value: Settings | null }>('settings.get', () => db
                .from('settings')
                .select('value')
                .eq('key', SETTINGS_KEY)
                .eq('user_id', userId)
                .maybeSingle());
            return { ...(row?.value ?? {}) };
        },

        async saveForUser(settings, userId) {
            await execute('settings.save', () => db
                .from('settings')
                .upsert({ user_id: userId, key: SETTINGS_KEY, value: settings }, { onConflict: 'user_id,key' }));
        },
    };
}
