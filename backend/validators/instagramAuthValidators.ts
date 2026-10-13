import { optionalString } from './fields.ts';
import type { Fields } from './fields.ts';

export interface InstagramCallbackQuery {
    code?: string;
    state?: string;
    error?: string;
    errorReason?: string;
}

// every field is optional: a cancelled sign-in comes back with error and error_reason instead of a code
export function parseInstagramCallback(query: Fields): InstagramCallbackQuery {
    return {
        code: optionalString(query, 'code') || undefined,
        state: optionalString(query, 'state') || undefined,
        error: optionalString(query, 'error') || undefined,
        errorReason: optionalString(query, 'error_reason') || undefined,
    };
}
