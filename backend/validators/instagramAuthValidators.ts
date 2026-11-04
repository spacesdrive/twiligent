import { optionalString, requiredString } from './fields.ts';
import type { Fields } from './fields.ts';
import type { InstagramConnectCompleteRequest } from '../../shared/types/instagram.ts';

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

// the code and state the callback forwarded; the service checks that the state belongs to the caller
export function parseInstagramComplete(body: Fields): InstagramConnectCompleteRequest {
    return {
        code: requiredString(body, 'code', 'The Instagram sign-in code is missing. Connect the account again.'),
        state: requiredString(body, 'state', 'The Instagram sign-in state is missing. Connect the account again.'),
    };
}
