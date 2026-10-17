import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coreSecretsMessage, corsOrigins, missingCoreSecrets, readConfig } from '../../lib/config.ts';
import type { Env } from '../../types/env.ts';

const BOM = String.fromCharCode(0xfeff);

function config(env: Partial<Env>) {
    return readConfig(env as Env);
}

test('secrets lose a byte order mark and whitespace, and blank ones count as unset', () => {
    assert.equal(config({ YOUTUBE_API_KEY: `${BOM} KEY \n` }).youtubeApiKey, 'KEY');
    assert.equal(config({ YOUTUBE_API_KEY: `${BOM}  ` }).youtubeApiKey, undefined);
    assert.deepEqual(config({ CLOUDINARY_CLOUD_NAME: 'cloud', CLOUDINARY_UPLOAD_PRESET: ' preset ' }).cloudinary, { cloudName: 'cloud', uploadPreset: 'preset' });
    assert.equal(config({ CLOUDINARY_CLOUD_NAME: 'cloud' }).cloudinary, null);
});

test('CORS allows FRONTEND_URL and ALLOWED_ORIGINS by origin', () => {
    assert.deepEqual(config({}).allowedOrigins, []);
    assert.deepEqual(config({ FRONTEND_URL: 'https://app.example.com/' }).allowedOrigins, ['https://app.example.com']);
    assert.deepEqual(
        config({ FRONTEND_URL: 'https://app.example.com', ALLOWED_ORIGINS: ' https://preview.example.pages.dev , not a url,https://app.example.com/x' }).allowedOrigins,
        ['https://app.example.com', 'https://preview.example.pages.dev'],
    );
});

test('the Instagram OAuth urls drop trailing slashes', () => {
    const { instagram } = config({ FRONTEND_URL: 'https://app.example.com/', BACKEND_URL: 'https://api.example.com/', INSTAGRAM_APP_ID: 'ID' });
    assert.deepEqual(instagram, {
        frontendUrl: 'https://app.example.com',
        redirectUri: 'https://api.example.com/api/auth/instagram/callback',
        appId: 'ID',
        appSecret: undefined,
    });
});

test('the local Vite server is allowed only when the Worker itself runs on localhost', () => {
    const settings = config({ FRONTEND_URL: 'https://app.example.com' });
    assert.deepEqual(corsOrigins(settings, 'https://api.example.workers.dev/api/health'), ['https://app.example.com']);
    assert.deepEqual(corsOrigins(settings, 'http://localhost:8787/api/health'), ['https://app.example.com', 'http://localhost:5173', 'http://127.0.0.1:5173']);
});

test('automation limits fall back to their defaults when missing, malformed or out of range', () => {
    assert.deepEqual(config({}).automation, {
        verifyToken: undefined,
        appSecrets: [],
        paused: false,
        limits: { accountHourly: 200, userHourly: 500, globalHourly: 1000, recipientDaily: 3, publicAccountHourly: 60 },
        batchSize: 10,
    });
    const set = config({
        AUTOMATION_ACCOUNT_HOURLY_LIMIT: ' 50 ', AUTOMATION_USER_HOURLY_LIMIT: 'lots', AUTOMATION_GLOBAL_HOURLY_LIMIT: '-1',
        AUTOMATION_RECIPIENT_DAILY_LIMIT: '1.5', AUTOMATION_BATCH_SIZE: '4', AUTOMATION_PUBLIC_ACCOUNT_HOURLY_LIMIT: '500',
    }).automation;
    // public replies stay at a human pace: 500 is over their cap of 200, so the default applies
    assert.deepEqual(set.limits, { accountHourly: 50, userHourly: 500, globalHourly: 1000, recipientDaily: 3, publicAccountHourly: 60 });
    assert.equal(config({ AUTOMATION_PUBLIC_ACCOUNT_HOURLY_LIMIT: '30' }).automation.limits.publicAccountHourly, 30);
    assert.equal(set.batchSize, 4);
});

test('the account limit and the batch never exceed what Instagram and the free Workers plan allow', () => {
    const capped = config({ AUTOMATION_ACCOUNT_HOURLY_LIMIT: '751', AUTOMATION_BATCH_SIZE: '16' }).automation;
    assert.equal(capped.limits.accountHourly, 200);
    assert.equal(capped.batchSize, 10);
    assert.equal(config({ AUTOMATION_ACCOUNT_HOURLY_LIMIT: '750', AUTOMATION_BATCH_SIZE: '15' }).automation.batchSize, 15);
});

test('webhooks are signed with the Instagram app secret first and the Meta app secret second; only "true" pauses', () => {
    const automation = config({ INSTAGRAM_APP_SECRET: ' IG ', META_APP_SECRET: `${BOM}META`, INSTAGRAM_WEBHOOK_VERIFY_TOKEN: ' tok ', AUTOMATION_PAUSED: 'TRUE' }).automation;
    assert.deepEqual(automation.appSecrets, ['IG', 'META']);
    assert.equal(automation.verifyToken, 'tok');
    assert.equal(automation.paused, true);
    assert.equal(config({ AUTOMATION_PAUSED: 'yes' }).automation.paused, false);
});

const CORE = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_KEY: 'service', SUPABASE_ANON_KEY: 'anon' };

test('the core Supabase secrets count as missing when unset, blank or, for the url, not a web address', () => {
    assert.deepEqual(missingCoreSecrets(CORE), []);
    assert.deepEqual(missingCoreSecrets({}), ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SUPABASE_ANON_KEY']);
    assert.deepEqual(missingCoreSecrets({ ...CORE, SUPABASE_SERVICE_KEY: `${BOM} ` }), ['SUPABASE_SERVICE_KEY']);
    assert.deepEqual(missingCoreSecrets({ ...CORE, SUPABASE_URL: 'project.supabase.co' }), ['SUPABASE_URL']);
    assert.deepEqual(missingCoreSecrets({ ...CORE, SUPABASE_URL: 'http://' }), ['SUPABASE_URL']);
});

test('the missing secrets message names each secret and says how to set it', () => {
    assert.equal(coreSecretsMessage(['SUPABASE_URL']), 'The server is not set up: the SUPABASE_URL Worker secret is missing or invalid. Set it with wrangler secret put, then deploy again.');
    assert.match(coreSecretsMessage(['SUPABASE_URL', 'SUPABASE_ANON_KEY']), /the SUPABASE_URL, SUPABASE_ANON_KEY Worker secrets are missing or invalid\. Set them with/);
});
