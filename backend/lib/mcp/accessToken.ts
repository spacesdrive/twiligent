import type { McpPermission } from '../../../shared/types/mcp.ts';

// personal access tokens for Claude Code and scripts: shown once, stored only as a SHA-256 hash

const PREFIX = 'twl_';
// 32 random bytes, so guessing is hopeless and a plain hash (no salt or stretching) is enough to store it
const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^twl_[A-Za-z0-9_-]{43}$/;

export function toBase64Url(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateAccessToken(): string {
    return PREFIX + toBase64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
}

// the prefix lets the auth middleware tell a token from a Supabase JWT without a database call
export function isAccessToken(value: string): boolean {
    return TOKEN_PATTERN.test(value);
}

export async function hashAccessToken(token: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

// the last characters let a person tell their tokens apart in the list without the token itself being kept
export function accessTokenHint(token: string): string {
    return token.slice(-4);
}

export function canWrite(permission: McpPermission): boolean {
    return permission === 'write';
}
