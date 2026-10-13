import { ValidationError } from '../lib/errors.ts';
import { optionalString, presentField, requiredString } from './fields.ts';
import type { Fields } from './fields.ts';
import type { NewTrackedContent, TrackedContentChanges } from '../services/trackedContentService.ts';

// an account id may be sent as null to unlink the account
function optionalAccountId(body: Fields): string | null | undefined {
    if (body.accountId === null) return null;
    return optionalString(body, 'accountId');
}

export function parseNewTrackedContent(body: Fields): NewTrackedContent {
    return {
        url: requiredString(body, 'url', 'url is required'),
        accountId: optionalAccountId(body),
        label: optionalString(body, 'label'),
        category: optionalString(body, 'category'),
    };
}

// manualViews and imageUrl keep their raw value: the tracked content rules explain what is wrong with it
export function parseTrackedContentChanges(body: Fields): TrackedContentChanges {
    for (const field of ['manualViews', 'imageUrl']) {
        const value = body[field];
        if (value !== undefined && value !== null && typeof value !== 'string' && typeof value !== 'number') {
            throw new ValidationError(`${field} must be text or a number`);
        }
    }
    const changes: TrackedContentChanges = {};
    if (presentField(body, 'label')) changes.label = optionalString(body, 'label') ?? '';
    if (presentField(body, 'category')) changes.category = optionalString(body, 'category') ?? '';
    if (presentField(body, 'accountId')) changes.accountId = optionalAccountId(body) ?? null;
    if (presentField(body, 'manualViews')) changes.manualViews = body.manualViews;
    if (presentField(body, 'imageUrl')) changes.imageUrl = body.imageUrl;
    return changes;
}
