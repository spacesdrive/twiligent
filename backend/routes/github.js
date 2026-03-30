const router = require('express').Router();
const { readJSON, SCHEDULED_POSTS_FILE } = require('../utils/dataHelpers');
const { syncEverythingToGitHub, pullScheduledPostsFromGitHub } = require('../services/github');

router.post('/github-sync', async (req, res) => {
    try {
        await syncEverythingToGitHub();
        res.json({ success: true, message: 'Synced all data files to GitHub' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/github-pull', async (req, res) => {
    try {
        await pullScheduledPostsFromGitHub();
        const posts = await readJSON(SCHEDULED_POSTS_FILE) || [];
        res.json({ success: true, posts, message: 'Pulled from GitHub' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
