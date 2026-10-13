import type { Env } from '../types/env.ts';

const DEFAULT_BACKEND_URL = 'http://localhost:8787';
const DEFAULT_FRONTEND_URL = 'http://localhost:5173';
const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const CALLBACK_PATH = '/api/auth/instagram/callback';

export interface CloudinaryConfig {
    cloudName: string;
    uploadPreset: string;
}

// appId and appSecret are undefined when the Worker secrets are not set
export interface InstagramOAuthConfig {
    frontendUrl: string;
    redirectUri: string;
    appId: string | undefined;
    appSecret: string | undefined;
}

export interface AppConfig {
    youtubeApiKey: string | undefined;
    instagram: InstagramOAuthConfig;
    cloudinary: CloudinaryConfig | null;
    allowedOrigins: string[];
}

// pasted secrets can carry a byte order mark or stray whitespace
export function cleanSecret(value: string | undefined): string | undefined {
    return value?.replace(/^\uFEFF/, '').trim() || undefined;
}

function cleanUrl(value: string | undefined, fallback: string): string {
    return (value || fallback).replace(/^\uFEFF/, '').trim();
}

function originOf(url: string): string | null {
    try {
        return new URL(url).origin;
    } catch {
        // a malformed entry is skipped rather than allowing everything
        return null;
    }
}

// FRONTEND_URL and any ALLOWED_ORIGINS; the local Vite server only when neither is set
function allowedOrigins(env: Env): string[] {
    const listed = [env.FRONTEND_URL, ...(env.ALLOWED_ORIGINS ?? '').split(',')]
        .map(value => cleanSecret(value))
        .filter((value): value is string => !!value)
        .map(originOf)
        .filter((origin): origin is string => origin !== null);
    return listed.length > 0 ? [...new Set(listed)] : DEV_ORIGINS;
}

export function readInstagramOAuthConfig(env: Env): InstagramOAuthConfig {
    const frontendUrl = cleanUrl(env.FRONTEND_URL, DEFAULT_FRONTEND_URL).replace(/\/$/, '');
    const backendUrl = cleanUrl(env.BACKEND_URL, DEFAULT_BACKEND_URL).replace(/\/$/, '');
    return {
        frontendUrl,
        redirectUri: `${backendUrl}${CALLBACK_PATH}`,
        appId: cleanSecret(env.INSTAGRAM_APP_ID),
        appSecret: cleanSecret(env.INSTAGRAM_APP_SECRET),
    };
}

export function readConfig(env: Env): AppConfig {
    const cloudName = cleanSecret(env.CLOUDINARY_CLOUD_NAME);
    const uploadPreset = cleanSecret(env.CLOUDINARY_UPLOAD_PRESET);
    return {
        youtubeApiKey: cleanSecret(env.YOUTUBE_API_KEY),
        instagram: readInstagramOAuthConfig(env),
        cloudinary: cloudName && uploadPreset ? { cloudName, uploadPreset } : null,
        allowedOrigins: allowedOrigins(env),
    };
}
