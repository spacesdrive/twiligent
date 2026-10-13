import { ValidationError } from '../lib/errors.ts';
import { isObject, optionalString, requiredString } from './fields.ts';
import type { Fields } from './fields.ts';
import type { AuthEmailHook } from '../types/authHook.ts';

function objectField(fields: Fields, name: string): Fields {
    const value = fields[name];
    if (!isObject(value)) throw new ValidationError(`${name} must be an object`);
    return value;
}

// the signature is already checked, so a malformed payload means a Supabase change this Worker does not know yet
export function parseAuthEmailHook(body: Fields): AuthEmailHook {
    const user = objectField(body, 'user');
    const data = objectField(body, 'email_data');
    return {
        email: requiredString(user, 'email', 'The hook payload has no user email'),
        newEmail: optionalString(user, 'new_email') || undefined,
        action: requiredString(data, 'email_action_type', 'The hook payload has no email action'),
        token: optionalString(data, 'token') ?? '',
        tokenHash: optionalString(data, 'token_hash') ?? '',
        tokenNew: optionalString(data, 'token_new') ?? '',
        tokenHashNew: optionalString(data, 'token_hash_new') ?? '',
        redirectTo: optionalString(data, 'redirect_to') ?? '',
        siteUrl: optionalString(data, 'site_url') ?? '',
    };
}
