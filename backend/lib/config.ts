import type { Env } from '../types/env.ts';

const DEFAULT_BACKEND_URL = 'http://localhost:8787';
const DEFAULT_FRONTEND_URL = 'http://localhost:5173';
const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1'];
const CALLBACK_PATH = '/api/auth/instagram/callback';
// Resend's free plan sends 100 emails a day
const DEFAULT_EMAIL_DAILY_LIMIT = 100;

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

// the Send Email hook; each value is undefined when its Worker secret is not set
export interface AuthEmailConfig {
    hookSecret: string | undefined;
    resendApiKey: string | undefined;
    from: string | undefined;
    dailyLimit: number;
    // email links point at Supabase Auth's verify endpoint
    supabaseUrl: string;
}

export interface AppConfig {
    youtubeApiKey: string | undefined;
    instagram: InstagramOAuthConfig;
    cloudinary: CloudinaryConfig | null;
    allowedOrigins: string[];
    authEmail: AuthEmailConfig;
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

// FRONTEND_URL and any ALLOWED_ORIGINS, by origin
function allowedOrigins(env: Env): string[] {
    const listed = [env.FRONTEND_URL, ...(env.ALLOWED_ORIGINS ?? '').split(',')]
        .map(value => cleanSecret(value))
        .filter((value): value is string => !!value)
        .map(originOf)
        .filter((origin): origin is string => origin !== null);
    return [...new Set(listed)];
}

// a Worker served from localhost is a development instance, so the local Vite server may call it too
export function corsOrigins(config: AppConfig, requestUrl: string): string[] {
    const local = LOCAL_HOSTNAMES.includes(new URL(requestUrl).hostname);
    return local ? [...config.allowedOrigins, ...DEV_ORIGINS] : config.allowedOrigins;
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

// a missing, malformed or non-positive limit falls back to the default rather than stopping every email
function dailyLimitOf(value: string | undefined): number {
    const limit = Number(cleanSecret(value));
    return Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_EMAIL_DAILY_LIMIT;
}

export function readAuthEmailConfig(env: Env): AuthEmailConfig {
    return {
        hookSecret: cleanSecret(env.SEND_EMAIL_HOOK_SECRET),
        resendApiKey: cleanSecret(env.RESEND_API_KEY),
        from: cleanSecret(env.EMAIL_FROM),
        dailyLimit: dailyLimitOf(env.EMAIL_DAILY_LIMIT),
        supabaseUrl: cleanUrl(env.SUPABASE_URL, '').replace(/\/$/, ''),
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
        authEmail: readAuthEmailConfig(env),
    };
}
