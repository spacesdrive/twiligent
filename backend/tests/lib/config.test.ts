import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../../lib/config.ts';
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

test('CORS allows FRONTEND_URL and ALLOWED_ORIGINS by origin, and the Vite server only when neither is set', () => {
    assert.deepEqual(config({}).allowedOrigins, ['http://localhost:5173', 'http://127.0.0.1:5173']);
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
