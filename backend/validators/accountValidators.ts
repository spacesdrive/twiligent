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

export function parseRedditAccount(body: Fields): RedditAccountInput {
    return {
        username: requiredString(body, 'username', 'Username is required'),
        cookie: requiredString(body, 'cookie', 'Session cookie is required - open reddit.com in your browser, copy the reddit_session value from DevTools (Application > Cookies > reddit.com), and paste it here'),
    };
}

export function parseInstagramToken(body: Fields): InstagramTokenInput {
    return { accessToken: requiredString(body, 'accessToken', 'Access token is required') };
}
