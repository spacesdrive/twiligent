import { ValidationError } from '../lib/errors.ts';
import { optionalString } from './fields.ts';
import type { Fields } from './fields.ts';

export interface FreshQuery {
    fresh: boolean;
}

// ?fresh=1 on a cached read (videos, ig-media) skips the cache, for a person's explicit refresh
export function parseFreshQuery(query: Fields): FreshQuery {
    const fresh = optionalString(query, 'fresh');
    if (fresh && fresh !== '1') throw new ValidationError('fresh must be 1 when given');
    return { fresh: fresh === '1' };
}

