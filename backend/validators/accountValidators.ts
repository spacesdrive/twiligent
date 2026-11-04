import { ValidationError } from '../lib/errors.ts';
import { requiredString } from './fields.ts';
import type { Fields } from './fields.ts';
import type { RedditAccountInput } from '../services/accountService.ts';

export interface ChannelInput {
    input: string;
}

export interface InstagramTokenInput {
    accessToken: string;
}

export function parseChannelInput(body: Fields): ChannelInput {
    return { input: requiredString(body, 'input', 'Enter a channel URL, @handle or channel ID') };
}

// people paste "u/name", "/u/name", "@name" or the address of their profile; only the name is kept
export function normalizeRedditUsername(input: string): string {
    const text = input.trim();
    const fromUrl = text.match(/reddit\.com\/(?:user|u)\/([^/?#\s]+)/i);
    return (fromUrl ? fromUrl[1] : text).replace(/^\/?u\//i, '').replace(/^@/, '').trim();
}

export function parseRedditAccount(body: Fields): RedditAccountInput {
    const username = normalizeRedditUsername(requiredString(body, 'username', 'Enter the Reddit username, such as u/name'));
    if (!username) throw new ValidationError('Enter the Reddit username, such as u/name');
    return {
        username,
        cookie: requiredString(body, 'cookie', 'Session cookie is required - open reddit.com in your browser, copy the reddit_session value from DevTools (Application > Cookies > reddit.com), and paste it here'),
    };
}

export function parseInstagramToken(body: Fields): InstagramTokenInput {
    return { accessToken: requiredString(body, 'accessToken', 'Access token is required') };
}
