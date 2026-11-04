import { optionalString, presentField, requiredString } from './fields.ts';
import type { Fields } from './fields.ts';
import type { NewTrackedContent, TrackedContentChanges } from '../services/trackedContentService.ts';

export function parseNewTrackedContent(body: Fields): NewTrackedContent {
    return {
        url: requiredString(body, 'url', 'url is required'),
        label: optionalString(body, 'label'),
        category: optionalString(body, 'category'),
    };
}

// only the label and category can change; the video's own numbers come from YouTube
export function parseTrackedContentChanges(body: Fields): TrackedContentChanges {
    const changes: TrackedContentChanges = {};
    if (presentField(body, 'label')) changes.label = optionalString(body, 'label') ?? '';
    if (presentField(body, 'category')) changes.category = optionalString(body, 'category') ?? '';
    return changes;
}
