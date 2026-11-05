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

// the signed API, only for deleting files; kept apart from CloudinaryConfig, which the browser receives
export interface CloudinaryAdminConfig {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
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

// the MCP endpoint: where Claude clients reach it, who signs them in, and the secret behind its confirmation tokens
export interface McpConfig {
    serverUrl: string;
    resourceMetadataUrl: string;
    // Supabase Auth's issuer, named in the protected resource metadata as the authorization server
    authorizationServer: string;
    // undefined when TOKEN_ENCRYPTION_KEY is missing or too short; tools that need a confirmation then refuse
    signingSecret: string | undefined;
    oauthEnabled: boolean;
}

// Google sign-in for YouTube publishing; null until the owner adds the OAuth client and TOKEN_ENCRYPTION_KEY, which
// seals the stored Google tokens
export interface YouTubeOAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    // where the callback hands the code to the app, which finishes the connection as the signed-in person
    accountsPageUrl: string;
    encryptionSecret: string;
}

export interface AppConfig {
    youtubeApiKey: string | undefined;
    instagram: InstagramOAuthConfig;
    cloudinary: CloudinaryConfig | null;
    cloudinaryAdmin: CloudinaryAdminConfig | null;
    allowedOrigins: string[];
    authEmail: AuthEmailConfig;
    automation: AutomationConfig;
    mcp: McpConfig;
    youtubeOAuth: YouTubeOAuthConfig | null;
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

// no request or cron run can work without the database and token checks, so these are checked before anything else
const CORE_SECRETS = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SUPABASE_ANON_KEY'] as const;

// the core secrets that are not set, or for the url not a web address
export function missingCoreSecrets(env: Partial<Env>): string[] {
    return CORE_SECRETS.filter(name => {
        const value = cleanSecret(env[name]);
        if (!value) return true;
        return name === 'SUPABASE_URL' && !(/^https?:\/\//.test(value) && originOf(value));
    });
}

export function coreSecretsMessage(missing: string[]): string {
    const names = missing.join(', ');
    const subject = missing.length === 1 ? `the ${names} Worker secret is` : `the ${names} Worker secrets are`;
    const object = missing.length === 1 ? 'it' : 'them';
    return `The server is not set up: ${subject} missing or invalid. Set ${object} with wrangler secret put, then deploy again.`;
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

// a shorter key could be guessed, so it counts as not set
const MIN_SIGNING_SECRET_LENGTH = 32;
const MCP_PATH = '/mcp';

export function readMcpConfig(env: Env): McpConfig {
    const backendUrl = cleanUrl(env.BACKEND_URL, DEFAULT_BACKEND_URL).replace(/\/$/, '');
    const secret = cleanSecret(env.TOKEN_ENCRYPTION_KEY);
    return {
        serverUrl: `${backendUrl}${MCP_PATH}`,
        resourceMetadataUrl: `${backendUrl}/.well-known/oauth-protected-resource${MCP_PATH}`,
        authorizationServer: `${cleanUrl(env.SUPABASE_URL, '').replace(/\/$/, '')}/auth/v1`,
        signingSecret: secret && secret.length >= MIN_SIGNING_SECRET_LENGTH ? secret : undefined,
        oauthEnabled: cleanSecret(env.MCP_OAUTH_ENABLED)?.toLowerCase() === 'true',
    };
}

export function readYouTubeOAuthConfig(env: Env): YouTubeOAuthConfig | null {
    const clientId = cleanSecret(env.GOOGLE_CLIENT_ID);
    const clientSecret = cleanSecret(env.GOOGLE_CLIENT_SECRET);
    const encryptionSecret = readMcpConfig(env).signingSecret;
    if (!clientId || !clientSecret || !encryptionSecret) return null;
    const backendUrl = cleanUrl(env.BACKEND_URL, DEFAULT_BACKEND_URL).replace(/\/$/, '');
    const frontendUrl = cleanUrl(env.FRONTEND_URL, DEFAULT_FRONTEND_URL).replace(/\/$/, '');
    return {
        clientId,
        clientSecret,
        redirectUri: `${backendUrl}/api/auth/youtube/callback`,
        accountsPageUrl: `${frontendUrl}/accounts`,
        encryptionSecret,
    };
}

export function readConfig(env: Env): AppConfig {
    const cloudName = cleanSecret(env.CLOUDINARY_CLOUD_NAME);
    const uploadPreset = cleanSecret(env.CLOUDINARY_UPLOAD_PRESET);
    const apiKey = cleanSecret(env.CLOUDINARY_API_KEY);
    const apiSecret = cleanSecret(env.CLOUDINARY_API_SECRET);
    return {
        youtubeApiKey: cleanSecret(env.YOUTUBE_API_KEY),
        instagram: readInstagramOAuthConfig(env),
        cloudinary: cloudName && uploadPreset ? { cloudName, uploadPreset } : null,
        cloudinaryAdmin: cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null,
        allowedOrigins: allowedOrigins(env),
        authEmail: readAuthEmailConfig(env),
        automation: readAutomationConfig(env),
        mcp: readMcpConfig(env),
        youtubeOAuth: readYouTubeOAuthConfig(env),
    };
}
