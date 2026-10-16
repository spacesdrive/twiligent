import type { Env } from '../types/env.ts';
import type { AutomationLimits } from '../../shared/types/automation.ts';

const DEFAULT_BACKEND_URL = 'http://localhost:8787';
const DEFAULT_FRONTEND_URL = 'http://localhost:5173';
const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1'];
const CALLBACK_PATH = '/api/auth/instagram/callback';
// Resend's free plan sends 100 emails a day
const DEFAULT_EMAIL_DAILY_LIMIT = 100;
// Instagram allows 750 private replies an hour per account for posts and reels; the default keeps well under it
const DEFAULT_AUTOMATION_LIMITS: AutomationLimits = { accountHourly: 200, userHourly: 500, globalHourly: 1000, recipientDaily: 3, publicAccountHourly: 60 };
const INSTAGRAM_ACCOUNT_HOURLY_MAX = 750;
// Meta publishes no limit for comment replies but blocks accounts that comment like a bot, so the pace stays human
const PUBLIC_ACCOUNT_HOURLY_MAX = 200;
// each reply costs three subrequests and a run gets 50 on the Workers Free plan, so 15 leaves room for the claim
const DEFAULT_AUTOMATION_BATCH_SIZE = 10;
const MAX_AUTOMATION_BATCH_SIZE = 15;

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

// comment-to-DM automation: the webhook's secrets and the sending limits
export interface AutomationConfig {
    verifyToken: string | undefined;
    // the secrets a webhook signature may be made with, the Instagram app secret first
    appSecrets: string[];
    paused: boolean;
    limits: AutomationLimits;
    batchSize: number;
}

export interface AppConfig {
    youtubeApiKey: string | undefined;
    instagram: InstagramOAuthConfig;
    cloudinary: CloudinaryConfig | null;
    allowedOrigins: string[];
    authEmail: AuthEmailConfig;
    automation: AutomationConfig;
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

// a missing, malformed or out of range value falls back to the default instead of stopping replies
function positiveIntegerOf(value: string | undefined, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
    const number = Number(cleanSecret(value));
    return Number.isInteger(number) && number > 0 && number <= max ? number : fallback;
}

export function readAutomationConfig(env: Env): AutomationConfig {
    const defaults = DEFAULT_AUTOMATION_LIMITS;
    return {
        verifyToken: cleanSecret(env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN),
        appSecrets: [cleanSecret(env.INSTAGRAM_APP_SECRET), cleanSecret(env.META_APP_SECRET)].filter((secret): secret is string => !!secret),
        paused: cleanSecret(env.AUTOMATION_PAUSED)?.toLowerCase() === 'true',
        limits: {
            accountHourly: positiveIntegerOf(env.AUTOMATION_ACCOUNT_HOURLY_LIMIT, defaults.accountHourly, INSTAGRAM_ACCOUNT_HOURLY_MAX),
            userHourly: positiveIntegerOf(env.AUTOMATION_USER_HOURLY_LIMIT, defaults.userHourly),
            globalHourly: positiveIntegerOf(env.AUTOMATION_GLOBAL_HOURLY_LIMIT, defaults.globalHourly),
            recipientDaily: positiveIntegerOf(env.AUTOMATION_RECIPIENT_DAILY_LIMIT, defaults.recipientDaily),
            publicAccountHourly: positiveIntegerOf(env.AUTOMATION_PUBLIC_ACCOUNT_HOURLY_LIMIT, defaults.publicAccountHourly, PUBLIC_ACCOUNT_HOURLY_MAX),
        },
        batchSize: positiveIntegerOf(env.AUTOMATION_BATCH_SIZE, DEFAULT_AUTOMATION_BATCH_SIZE, MAX_AUTOMATION_BATCH_SIZE),
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
        automation: readAutomationConfig(env),
    };
}
