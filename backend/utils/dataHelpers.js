const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const API_KEYS_FILE = path.join(DATA_DIR, 'api_keys.json');
const VIDEOS_CACHE_FILE = path.join(DATA_DIR, 'videos_cache.json');
const IG_CACHE_FILE = path.join(DATA_DIR, 'ig_cache.json');
const SCHEDULED_POSTS_FILE = path.join(DATA_DIR, 'scheduled_posts.json');

async function initializeData() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const defaults = [
            [ACCOUNTS_FILE, []],
            [API_KEYS_FILE, { youtube: '', instagram: { appId: '', appSecret: '' }, cloudinary: { cloudName: '', uploadPreset: '' }, github: { token: '', repo: '', branch: 'main' } }],
            [VIDEOS_CACHE_FILE, {}],
            [IG_CACHE_FILE, {}],
            [SCHEDULED_POSTS_FILE, []],
        ];
        for (const [file, defaultData] of defaults) {
            try {
                await fs.access(file);
            } catch {
                await fs.writeFile(file, JSON.stringify(defaultData, null, 2));
            }
        }
        console.log('Data files initialized');
    } catch (err) {
        console.error('Init error:', err);
    }
}

async function readJSON(filePath) {
    try {
        return JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch {
        return null;
    }
}

async function writeJSON(filePath, data) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch {
        return false;
    }
}

async function getAPIKey() {
    const keys = await readJSON(API_KEYS_FILE);
    return keys?.youtube || '';
}

async function getIGAppCredentials() {
    const keys = await readJSON(API_KEYS_FILE);
    return keys?.instagram || { appId: '', appSecret: '' };
}

module.exports = {
    DATA_DIR,
    ACCOUNTS_FILE,
    API_KEYS_FILE,
    VIDEOS_CACHE_FILE,
    IG_CACHE_FILE,
    SCHEDULED_POSTS_FILE,
    initializeData,
    readJSON,
    writeJSON,
    getAPIKey,
    getIGAppCredentials,
};
