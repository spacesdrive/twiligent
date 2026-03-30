const router = require('express').Router();
const { readJSON, writeJSON, API_KEYS_FILE } = require('../utils/dataHelpers');

router.get('/', async (req, res) => {
    const keys = await readJSON(API_KEYS_FILE);
    res.json({
        youtube: keys?.youtube || '',
        configured: !!keys?.youtube,
        instagram: {
            appId: keys?.instagram?.appId || '',
            appSecret: keys?.instagram?.appSecret || '',
            configured: !!(keys?.instagram?.appId && keys?.instagram?.appSecret),
        },
        cloudinary: {
            cloudName: keys?.cloudinary?.cloudName || '',
            uploadPreset: keys?.cloudinary?.uploadPreset || '',
            configured: !!(keys?.cloudinary?.cloudName && keys?.cloudinary?.uploadPreset),
        },
        github: {
            token: keys?.github?.token || '',
            repo: keys?.github?.repo || '',
            branch: keys?.github?.branch || 'main',
            configured: !!(keys?.github?.token && keys?.github?.repo),
        },
    });
});

router.post('/', async (req, res) => {
    const { youtube, instagram, cloudinary, github } = req.body;
    const keys = await readJSON(API_KEYS_FILE) || {};

    if (youtube !== undefined) keys.youtube = youtube;
    if (instagram !== undefined) {
        if (!keys.instagram) keys.instagram = {};
        if (instagram.appId !== undefined) keys.instagram.appId = instagram.appId;
        if (instagram.appSecret !== undefined) keys.instagram.appSecret = instagram.appSecret;
    }
    if (cloudinary !== undefined) {
        if (!keys.cloudinary) keys.cloudinary = {};
        if (cloudinary.cloudName !== undefined) keys.cloudinary.cloudName = cloudinary.cloudName;
        if (cloudinary.uploadPreset !== undefined) keys.cloudinary.uploadPreset = cloudinary.uploadPreset;
    }
    if (github !== undefined) {
        if (!keys.github) keys.github = { branch: 'main' };
        if (github.token !== undefined) keys.github.token = github.token;
        if (github.repo !== undefined) keys.github.repo = github.repo;
        if (github.branch !== undefined) keys.github.branch = github.branch || 'main';
    }

    const ok = await writeJSON(API_KEYS_FILE, keys);
    res.json({ success: ok, message: ok ? 'API keys saved' : 'Failed to save' });
});

module.exports = router;
