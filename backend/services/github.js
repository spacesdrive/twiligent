const fetch = require('node-fetch');
const sodium = require('libsodium-wrappers');
const { readJSON, writeJSON, API_KEYS_FILE, ACCOUNTS_FILE, SCHEDULED_POSTS_FILE } = require('../utils/dataHelpers');

// Push a single file to GitHub (create or update). Returns true on success.
async function pushFileToGitHub(gh, repoPath, jsonData, commitMessage) {
    const repo = gh.repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
    const branch = gh.branch || 'main';
    const content = Buffer.from(JSON.stringify(jsonData, null, 2)).toString('base64');
    const headers = { Authorization: `token ${gh.token}`, 'Content-Type': 'application/json', 'User-Agent': 'SocialMediaDashboard' };

    let sha;
    try {
        const r = await fetch(`https://api.github.com/repos/${repo}/contents/${repoPath}?ref=${branch}`, { headers });
        if (r.ok) sha = (await r.json()).sha;
    } catch { }

    const body = { message: commitMessage, content, branch };
    if (sha) body.sha = sha;

    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${repoPath}`, {
        method: 'PUT', headers, body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(`GitHub PUT ${repoPath}: ${err.message}`);
    }
    return true;
}

// Sync scheduled_posts.json to GitHub.
// accounts.json is NEVER pushed as a plain file — tokens would be wiped on next git pull.
// Accounts sync via the encrypted ACCOUNTS_JSON secret instead.
async function syncAllDataToGitHub() {
    try {
        const keys = await readJSON(API_KEYS_FILE) || {};
        const gh = keys.github;
        if (!gh?.token || !gh?.repo) return;

        const posts = await readJSON(SCHEDULED_POSTS_FILE) || [];
        await pushFileToGitHub(gh, 'backend/data/scheduled_posts.json', posts, '📅 Sync scheduled posts');
        console.log('  ☁️ Synced scheduled posts to GitHub');
    } catch (err) {
        console.error('  ☁️ syncAllDataToGitHub error:', err.message);
    }
}

// Remove accounts.json from GitHub if it was mistakenly committed.
// Safe to call repeatedly — silently does nothing if the file doesn't exist on GitHub.
async function removeAccountsFileFromGitHub() {
    try {
        const keys = await readJSON(API_KEYS_FILE) || {};
        const gh = keys.github;
        if (!gh?.token || !gh?.repo) return;
        const repo = gh.repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
        const branch = gh.branch || 'main';
        const filePath = 'backend/data/accounts.json';
        const headers = { Authorization: `token ${gh.token}`, 'Content-Type': 'application/json', 'User-Agent': 'SocialMediaDashboard' };

        const r = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`, { headers });
        if (!r.ok) return;

        const { sha } = await r.json();
        const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ message: '🔒 Remove accounts.json (sensitive — use secret instead)', sha, branch }),
        });
        if (res.ok) console.log('  ☁️ Removed accounts.json from GitHub (was mistakenly committed)');
    } catch { }
}

async function pullScheduledPostsFromGitHub() {
    try {
        const keys = await readJSON(API_KEYS_FILE) || {};
        const gh = keys.github;
        if (!gh?.token || !gh?.repo) return;

        const repo = gh.repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
        const filePath = 'backend/data/scheduled_posts.json';
        const branch = gh.branch || 'main';

        const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`, {
            headers: { Authorization: `token ${gh.token}`, 'User-Agent': 'SocialMediaDashboard' }
        });
        if (!res.ok) return;

        const data = await res.json();
        const remotePosts = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
        const localPosts = await readJSON(SCHEDULED_POSTS_FILE) || [];

        const remoteMap = new Map(remotePosts.map(p => [p.id, p]));
        const localMap = new Map(localPosts.map(p => [p.id, p]));
        const merged = [];

        for (const rp of remotePosts) {
            const lp = localMap.get(rp.id);
            if (!lp || rp.status === 'published' || rp.status === 'failed') {
                merged.push(rp);
            } else {
                merged.push(lp);
            }
        }
        for (const lp of localPosts) {
            if (!remoteMap.has(lp.id)) merged.push(lp);
        }

        await writeJSON(SCHEDULED_POSTS_FILE, merged);
        console.log(`  ☁️ Pulled ${remotePosts.length} post(s) from GitHub, merged to ${merged.length}`);
    } catch (err) {
        console.error('  ☁️ GitHub pull error:', err.message);
    }
}

// Automatically updates ACCOUNTS_JSON secret in GitHub Actions whenever accounts change.
async function syncAccountsSecretToGitHub() {
    try {
        const keys = await readJSON(API_KEYS_FILE) || {};
        const gh = keys.github;
        if (!gh?.token || !gh?.repo) return;

        const repo = gh.repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
        const accounts = await readJSON(ACCOUNTS_FILE) || [];
        const secretValue = Buffer.from(JSON.stringify(accounts, null, 2)).toString('base64');

        const pkRes = await fetch(`https://api.github.com/repos/${repo}/actions/secrets/public-key`, {
            headers: { Authorization: `token ${gh.token}`, 'User-Agent': 'SocialMediaDashboard' }
        });
        if (!pkRes.ok) {
            console.error('  ☁️ Failed to get GitHub public key:', (await pkRes.json()).message);
            return;
        }
        const { key: publicKey, key_id } = await pkRes.json();

        await sodium.ready;
        const binKey = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL);
        const binSecret = sodium.from_string(secretValue);
        const encrypted = sodium.crypto_box_seal(binSecret, binKey);
        const encryptedB64 = sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL);

        const res = await fetch(`https://api.github.com/repos/${repo}/actions/secrets/ACCOUNTS_JSON`, {
            method: 'PUT',
            headers: { Authorization: `token ${gh.token}`, 'Content-Type': 'application/json', 'User-Agent': 'SocialMediaDashboard' },
            body: JSON.stringify({ encrypted_value: encryptedB64, key_id }),
        });

        if (res.status === 201 || res.status === 204) {
            console.log('  ☁️ Synced ACCOUNTS_JSON secret to GitHub');
        } else {
            const err = await res.json();
            console.error('  ☁️ GitHub secret sync error:', err.message);
        }
    } catch (err) {
        console.error('  ☁️ GitHub secret sync error:', err.message);
    }
}

// Push all data files + refresh encrypted secret in one shot.
async function syncEverythingToGitHub() {
    await Promise.allSettled([syncAllDataToGitHub(), syncAccountsSecretToGitHub()]);
}

module.exports = {
    pushFileToGitHub,
    syncAllDataToGitHub,
    removeAccountsFileFromGitHub,
    pullScheduledPostsFromGitHub,
    syncAccountsSecretToGitHub,
    syncEverythingToGitHub,
};
