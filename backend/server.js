const express = require('express');
const cors = require('cors');

const { initializeData, readJSON, SCHEDULED_POSTS_FILE } = require('./utils/dataHelpers');
const { removeAccountsFileFromGitHub, pullScheduledPostsFromGitHub } = require('./services/github');
const { autoRefreshInstagramTokens } = require('./services/instagram');
const { processScheduledPosts } = require('./utils/scheduler');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/api/keys', require('./routes/keys'));
app.use('/api', require('./routes/accounts'));
app.use('/api', require('./routes/analytics'));
app.use('/api', require('./routes/publishing'));
app.use('/api', require('./routes/scheduledPosts'));
app.use('/api', require('./routes/github'));

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Startup ─────────────────────────────────────────────────────────────────

initializeData().then(async () => {
    await pullScheduledPostsFromGitHub();

    const posts = await readJSON(SCHEDULED_POSTS_FILE) || [];
    const overdue = posts.filter(p => p.status === 'pending' && new Date(p.scheduledAt) <= new Date());
    if (overdue.length > 0) {
        console.log(`  ⏰ ${overdue.length} overdue scheduled post(s) found, publishing now...`);
        await processScheduledPosts();
    }

    setInterval(async () => {
        const posts = await readJSON(SCHEDULED_POSTS_FILE) || [];
        const due = posts.filter(p => p.status === 'pending' && new Date(p.scheduledAt) <= new Date());
        if (due.length > 0) {
            console.log(`\n  ⏰ ${due.length} scheduled post(s) due, processing...`);
            await processScheduledPosts();
        }
    }, 60000);

    removeAccountsFileFromGitHub().catch(() => { });

    autoRefreshInstagramTokens();
    setInterval(autoRefreshInstagramTokens, 24 * 60 * 60 * 1000);

    app.listen(PORT, () => {
        console.log(`\n  Social Media Analytics API Server`);
        console.log(`  Running on http://localhost:${PORT}`);
        console.log(`  YouTube + Instagram analytics ready`);
        console.log(`  📅 Scheduler active (checks every 60s)`);
        console.log(`  🔑 Instagram token auto-refresh active (checks every 24h)\n`);
    });
});
