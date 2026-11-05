import { requiredString } from './fields.ts';
import type { Fields } from './fields.ts';

export interface ChannelInput {
    input: string;
}

export function parseChannelInput(body: Fields): ChannelInput {
    return { input: requiredString(body, 'input', 'Enter a channel URL, @handle or channel ID') };
}
