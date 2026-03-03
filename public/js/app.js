const API_BASE = 'http://localhost:3000/api';

let accounts = [];
let currentChannelId = null;
let charts = {};

document.addEventListener('DOMContentLoaded', async () => {
    await checkServerConnection();
    await loadInitialData();
    setupEventListeners();
    checkFirstRun();
});

async function checkServerConnection() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${API_BASE}/accounts`, {
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        console.log('✓ Server connection successful');
    } catch (error) {
        console.error('✗ Server connection failed:', error);

        const errorBox = document.createElement('div');
        errorBox.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#f44336;color:#fff;padding:20px;text-align:center;z-index:10001;font-size:16px;';
        errorBox.innerHTML = `
            <strong>⚠️ Cannot Connect to Server</strong><br>
            <span style="font-size:14px;">
                ${error.name === 'AbortError' ? 'Connection timeout - Server not responding' : error.message}
                <br>Make sure the backend server is running: <code style="background:rgba(0,0,0,0.2);padding:2px 8px;border-radius:3px;">node server.js</code>
            </span>
        `;
        document.body.insertBefore(errorBox, document.body.firstChild);

        throw error;
    }
}

async function loadInitialData() {
    console.log('🔵 START loadInitialData');
    try {
        console.log('📡 Step 1: Fetching accounts from', `${API_BASE}/accounts`);
        const accountsRes = await fetch(`${API_BASE}/accounts`);
        console.log('📡 Accounts response status:', accountsRes.status);
        if (!accountsRes.ok) throw new Error(`HTTP error! status: ${accountsRes.status}`);
        accounts = await accountsRes.json();
        console.log('✅ Accounts loaded:', accounts);

        console.log('📡 Step 2: Fetching API keys from', `${API_BASE}/keys`);
        const keysRes = await fetch(`${API_BASE}/keys`);
        console.log('📡 Keys response status:', keysRes.status);
        if (!keysRes.ok) throw new Error(`HTTP error! status: ${keysRes.status}`);
        const keys = await keysRes.json();
        console.log('✅ Keys loaded:', keys);

        console.log('📝 Step 3: Updating API key input');
        const apiKeyInput = document.getElementById('youtubeApiKey');
        console.log('  - API key input element:', apiKeyInput);
        if (apiKeyInput) {
            apiKeyInput.value = keys.youtube || '';
            console.log('  ✅ API key input updated');
        } else {
            console.log('  ⚠️ API key input not found');
        }

        console.log('📝 Step 4: Updating API status');
        updateAPIStatus(keys.youtube);
        console.log('  ✅ API status updated');

        console.log(' Step 6: Checking dashboard visibility');
        const mainDashboard = document.getElementById('mainDashboard');
        console.log('  - Main dashboard element:', mainDashboard);
        console.log('  - Has "hidden" class:', mainDashboard?.classList.contains('hidden'));

        if (mainDashboard && !mainDashboard.classList.contains('hidden')) {
            console.log('  📊 Dashboard visible - updating UI...');
            updateOverviewTab();
            updateYouTubeTab();
            updateAccountsTab();
            console.log('  ✅ Dashboard UI updated');
        } else {
            console.log('  ⚠️ Dashboard hidden - skipping UI updates');
        }

        console.log('📝 Step 7: Updating last update time');
        if (accounts.length > 0) {
            const lastUpdate = accounts.reduce((latest, acc) => {
                const accTime = new Date(acc.lastUpdated);
                return accTime > latest ? accTime : latest;
            }, new Date(0));

            updateLastUpdateTime(lastUpdate);
            console.log('  ✅ Last update time set');
        } else {
            console.log('  ⚠️ No accounts, skipping last update time');
        }

        console.log('✅ loadInitialData COMPLETED');
    } catch (error) {
        console.error('❌ loadInitialData FAILED');
        console.error('Error:', error);
        console.error('Stack:', error.stack);
        const errorMsg = error.message || error.toString();
        showToast(`Failed to load data: ${errorMsg}`, 'error');

        if (document.body) {
            const detailedError = document.createElement('div');
            detailedError.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border:3px solid #f44336;padding:30px;border-radius:8px;max-width:600px;z-index:10000;box-shadow:0 4px 20px rgba(0,0,0,0.3);font-family:monospace;';
            detailedError.innerHTML = `
                <h2 style="color:#f44336;margin-top:0;">⚠️ Error Loading Data</h2>
                <p><strong>Error Message:</strong></p>
                <pre style="background:#f5f5f5;padding:15px;border-radius:4px;overflow:auto;max-height:200px;">${errorMsg}</pre>
                <p><strong>Possible Causes:</strong></p>
                <ul style="text-align:left;line-height:1.8;">
                    <li>Backend server is not running (run: node server.js)</li>
                    <li>Server is running on wrong port (check: http://localhost:3000)</li>
                    <li>CORS error (must use http://localhost:3000, not file:// or 127.0.0.1)</li>
                    <li>Folder structure is incorrect (files must be in public/ and data/ folders)</li>
                </ul>
                <p><strong>Check Console:</strong> Press F12 → Console tab for detailed errors</p>
                <button onclick="this.parentElement.remove()" style="background:#f44336;color:#fff;border:none;padding:10px 20px;border-radius:4px;cursor:pointer;font-size:16px;">Close</button>
            `;
            document.body.appendChild(detailedError);
        }
    }
}

function checkFirstRun() {
    const welcomeScreen = document.getElementById('welcomeScreen');
    const mainDashboard = document.getElementById('mainDashboard');

    if (!welcomeScreen || !mainDashboard) {
        console.warn('Welcome screen or main dashboard elements not found');
        return;
    }

    if (accounts.length === 0) {
        welcomeScreen.classList.remove('hidden');
        mainDashboard.classList.add('hidden');
    } else {
        welcomeScreen.classList.add('hidden');
        mainDashboard.classList.remove('hidden');
    }
}


function setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = item.dataset.tab;
            switchTab(tab);
        });
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');

}

function updateOverviewTab() {
    const totalStats = accounts.reduce((acc, account) => {
        acc.views += account.currentStats.views || 0;
        acc.subscribers += account.currentStats.subscribers || 0;
        acc.videos += account.currentStats.videos || 0;
        return acc;
    }, { views: 0, subscribers: 0, videos: 0 });

    const totalViewsEl = document.getElementById('totalViews');
    const totalSubsEl = document.getElementById('totalSubscribers');
    const totalVideosEl = document.getElementById('totalVideos');
    const totalAccountsEl = document.getElementById('totalAccounts');

    if (totalViewsEl) totalViewsEl.textContent = formatNumber(totalStats.views);
    if (totalSubsEl) totalSubsEl.textContent = formatNumber(totalStats.subscribers);
    if (totalVideosEl) totalVideosEl.textContent = formatNumber(totalStats.videos);
    if (totalAccountsEl) totalAccountsEl.textContent = accounts.length;

    updateTopPerformers();
    updatePlatformChart();
}

function updateTopPerformers() {
    const container = document.getElementById('topPerformers');

    if (!container) {
        console.warn('topPerformers element not found');
        return;
    }

    if (accounts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                </div>
                <p>No data available yet</p>
            </div>
        `;
        return;
    }

    const sorted = [...accounts].sort((a, b) =>
        (b.currentStats.subscribers || 0) - (a.currentStats.subscribers || 0)
    ).slice(0, 5);

    container.innerHTML = sorted.map((account, index) => `
        <div class="performer-item">
            <div class="performer-rank">${index + 1}</div>
            <div class="performer-info">
                <div class="performer-name">${escapeHtml(account.name)}</div>
                <div class="performer-metric">${formatNumber(account.currentStats.subscribers)} subscribers</div>
            </div>
        </div>
    `).join('');
}

function updatePlatformChart() {
    const canvas = document.getElementById('platformComparisonChart');

    if (!canvas) {
        console.warn('platformComparisonChart element not found');
        return;
    }

    const ctx = canvas.getContext('2d');

    if (charts.platform) {
        charts.platform.destroy();
    }

    const platformStats = {};
    accounts.forEach(account => {
        if (!platformStats[account.platform]) {
            platformStats[account.platform] = { views: 0, subscribers: 0 };
        }
        platformStats[account.platform].views += account.currentStats.views || 0;
        platformStats[account.platform].subscribers += account.currentStats.subscribers || 0;
    });

    if (typeof Chart !== 'undefined') {
        charts.platform = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(platformStats).map(p => p.charAt(0).toUpperCase() + p.slice(1)),
                datasets: [
                    {
                        label: 'Total Views',
                        data: Object.values(platformStats).map(s => s.views),
                        backgroundColor: '#FF6B6B',
                        borderRadius: 8
                    },
                    {
                        label: 'Total Subscribers',
                        data: Object.values(platformStats).map(s => s.subscribers),
                        backgroundColor: '#51CF66',
                        borderRadius: 8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                return formatNumber(value);
                            }
                        }
                    }
                }
            }
        });
    }
}


function updateYouTubeTab() {
    const youtubeAccounts = accounts.filter(acc => acc.platform === 'youtube');

    const totalStats = youtubeAccounts.reduce((acc, account) => {
        acc.views += account.currentStats.views || 0;
        acc.subscribers += account.currentStats.subscribers || 0;
        acc.videos += account.currentStats.videos || 0;
        return acc;
    }, { views: 0, subscribers: 0, videos: 0 });

    const viewsEl = document.getElementById('ytTotalViews');
    const subsEl = document.getElementById('ytTotalSubs');
    const videosEl = document.getElementById('ytTotalVideos');
    const channelCountEl = document.getElementById('ytChannelCount');

    if (viewsEl) viewsEl.textContent = formatNumber(totalStats.views);
    if (subsEl) subsEl.textContent = formatNumber(totalStats.subscribers);
    if (videosEl) videosEl.textContent = formatNumber(totalStats.videos);
    if (channelCountEl) channelCountEl.textContent = youtubeAccounts.length;

    updateYouTubeChannelsList();
}

function updateYouTubeChannelsList() {
    const container = document.getElementById('youtubeChannels');

    if (!container) {
        console.warn('youtubeChannels element not found');
        return;
    }

    const youtubeAccounts = accounts.filter(acc => acc.platform === 'youtube');

    if (youtubeAccounts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                </div>
                <p>No YouTube channels added yet</p>
                <button class="btn-primary" onclick="switchTab('accounts')">Add YouTube Channel</button>
            </div>
        `;
        return;
    }

    container.innerHTML = youtubeAccounts.map(account => `
        <div class="channel-item">
            <div class="channel-thumbnail">
                <img src="${account.thumbnailUrl || 'https://via.placeholder.com/56'}" 
                     alt="${escapeHtml(account.name)}">
            </div>
            <div class="channel-info">
                <div class="channel-name">${escapeHtml(account.name)}</div>
                <div class="channel-stats">
                    <div class="stat">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        <span>${formatNumber(account.currentStats.views)}</span>
                    </div>
                    <div class="stat">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        <span>${formatNumber(account.currentStats.subscribers)}</span>
                    </div>
                    <div class="stat">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="23 7 16 12 23 17 23 7"></polygon>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                        </svg>
                        <span>${formatNumber(account.currentStats.videos)}</span>
                    </div>
                </div>
            </div>
            <div class="channel-actions">
                <button class="btn-secondary btn-small" onclick="viewChannelDetails('${account.id}')">View</button>
                <button class="btn-secondary btn-small" onclick="updateSingleAccount('${account.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

async function viewChannelDetails(accountId) {
    currentChannelId = accountId;
    const account = accounts.find(acc => acc.id === accountId);

    if (!account) return;

    const detailsSection = document.getElementById('channelDetailsSection');
    const channelNameEl = document.getElementById('selectedChannelName');
    const videosContainer = document.getElementById('channelVideos');

    if (!detailsSection) {
        console.warn('Channel details section not found');
        return;
    }

    if (channelNameEl) channelNameEl.textContent = account.name;
    detailsSection.style.display = 'block';

    showLoading();

    try {
        const res = await fetch(`${API_BASE}/accounts/${accountId}/videos`);
        const data = await res.json();

        if (data.success && videosContainer) {
            if (data.videos.length === 0) {
                videosContainer.innerHTML = '<div class="empty-state"><p>No videos found</p></div>';
            } else {
                videosContainer.innerHTML = data.videos.slice(0, 12).map(video => `
                    <div class="video-card">
                        <div class="video-thumbnail">
                            <img src="${video.thumbnailUrl}" alt="${escapeHtml(video.title)}">
                        </div>
                        <div class="video-info">
                            <div class="video-title">${escapeHtml(video.title)}</div>
                            <div class="video-stats">
                                <span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                    ${formatNumber(video.viewCount || 0)}
                                </span>
                                <span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                                    </svg>
                                    ${formatNumber(video.likeCount || 0)}
                                </span>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading channel videos:', error);
        showToast('Failed to load videos', 'error');
    } finally {
        hideLoading();
    }
}

function closeChannelDetails() {
    const detailsSection = document.getElementById('channelDetailsSection');
    if (detailsSection) {
        detailsSection.style.display = 'none';
    }
    currentChannelId = null;
}

function updateAccountsTab() {
    const container = document.getElementById('accountsList');

    if (!container) {
        console.warn('accountsList element not found');
        return;
    }

    if (accounts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                </div>
                <p>No accounts connected</p>
            </div>
        `;
        return;
    }

    container.innerHTML = accounts.map(account => `
        <div class="account-item">
            <div class="account-thumbnail">
                <img src="${account.thumbnailUrl || 'https://via.placeholder.com/56'}" 
                     alt="${escapeHtml(account.name)}">
            </div>
            <div class="account-info">
                <div class="account-name">${escapeHtml(account.name)}</div>
                <div class="account-stats">
                    <div class="stat">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                        <span>${account.platform.charAt(0).toUpperCase() + account.platform.slice(1)}</span>
                    </div>
                    <div class="stat">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        <span>${formatNumber(account.currentStats.subscribers)}</span>
                    </div>
                    <div class="stat">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span>Added ${formatDate(account.addedAt)}</span>
                    </div>
                </div>
            </div>
            <div class="account-actions">
                <button class="btn-secondary btn-small" onclick="updateSingleAccount('${account.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                </button>
                <button class="btn-danger btn-small" onclick="deleteAccount('${account.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}


function showSetupWizard() {
    showAddAccountModal();
}

function showAddAccountModal() {
    const modal = document.getElementById('addAccountModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('accountName').value = '';
        document.getElementById('accountChannelId').value = '';
        document.getElementById('modalStatus').classList.add('hidden');
    }
}

function closeAddAccountModal() {
    const modal = document.getElementById('addAccountModal');
    if (modal) modal.classList.add('hidden');
}

async function testConnection() {
    const channelId = document.getElementById('accountChannelId').value.trim();

    if (!channelId) {
        showModalStatus('Please enter a Channel ID', 'error');
        return;
    }

    showLoading();

    try {
        const res = await fetch(`${API_BASE}/test-youtube-connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId })
        });

        const data = await res.json();

        if (data.success) {
            showModalStatus(`Connection successful! Found: ${data.data.title}`, 'success');
        } else {
            showModalStatus(data.message, 'error');
        }
    } catch (error) {
        showModalStatus('Connection test failed', 'error');
    } finally {
        hideLoading();
    }
}

async function addAccount() {
    const name = document.getElementById('accountName').value.trim();
    const platform = document.getElementById('accountPlatform').value;
    const channelId = document.getElementById('accountChannelId').value.trim();

    if (!name || !channelId) {
        showModalStatus('Please fill in all fields', 'error');
        return;
    }

    showLoading();

    try {
        const res = await fetch(`${API_BASE}/accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, platform, channelId })
        });

        const data = await res.json();

        if (data.success) {
            accounts.push(data.account);
            closeAddAccountModal();
            showToast('Account added successfully!', 'success');
            await loadInitialData();
            checkFirstRun();
        } else {
            showModalStatus(data.message, 'error');
        }
    } catch (error) {
        console.error('Failed to add account:', error);
        showModalStatus(`Failed to add account: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

async function deleteAccount(accountId) {
    if (!confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
        return;
    }

    showLoading();

    try {
        const res = await fetch(`${API_BASE}/accounts/${accountId}`, {
            method: 'DELETE'
        });

        const data = await res.json();

        if (data.success) {
            accounts = accounts.filter(acc => acc.id !== accountId);
            showToast('Account deleted successfully', 'success');
            await loadInitialData();
            checkFirstRun();
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        showToast('Failed to delete account', 'error');
    } finally {
        hideLoading();
    }
}

async function updateSingleAccount(accountId) {
    showLoading();

    try {
        const res = await fetch(`${API_BASE}/accounts/${accountId}/update`, {
            method: 'POST'
        });

        const data = await res.json();

        if (data.success) {
            const index = accounts.findIndex(acc => acc.id === accountId);
            if (index !== -1) {
                accounts[index] = data.account;
            }

            showToast('Stats updated successfully!', 'success');
            await loadInitialData();
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        showToast('Failed to update stats', 'error');
    } finally {
        hideLoading();
    }
}

async function updateAllStats() {
    if (accounts.length === 0) {
        showToast('No accounts to update', 'error');
        return;
    }

    showLoading();

    try {
        const res = await fetch(`${API_BASE}/update-stats`, {
            method: 'POST'
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();

        if (data.success) {
            accounts = data.accounts;
            showToast('All stats updated successfully!', 'success');
            updateLastUpdateTime(new Date(data.updatedAt));
            await loadInitialData();
        } else {
            showToast(data.message, 'error');
            console.error('Update stats error:', data);
        }
    } catch (error) {
        console.error('Failed to update stats:', error);
        showToast(`Failed to update stats: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}


async function saveAPIKey() {
    const youtubeEl = document.getElementById('youtubeApiKey');

    if (!youtubeEl) {
        console.warn('youtubeApiKey element not found');
        showToast('API key input not found', 'error');
        return;
    }

    const youtube = youtubeEl.value.trim();

    if (!youtube) {
        showToast('Please enter an API key', 'error');
        return;
    }

    showLoading();

    try {
        const res = await fetch(`${API_BASE}/keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ youtube })
        });

        const data = await res.json();

        if (data.success) {
            showToast('API key saved successfully!', 'success');
            updateAPIStatus(youtube);
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        showToast('Failed to save API key', 'error');
    } finally {
        hideLoading();
    }
}

function updateAPIStatus(apiKey) {
    const statusContainer = document.getElementById('apiStatus');
    if (!statusContainer) return;

    const indicator = statusContainer.querySelector('.status-indicator');
    const text = statusContainer.querySelector('span:last-child');

    if (!indicator || !text) return;

    if (apiKey && apiKey.length > 0) {
        indicator.className = 'status-indicator status-success';
        text.textContent = 'API Key Status: Configured';
    } else {
        indicator.className = 'status-indicator status-unknown';
        text.textContent = 'API Key Status: Not configured';
    }
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateLastUpdateTime(date) {
    const timeString = date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const lastUpdateEl = document.getElementById('lastUpdateTime');
    const settingsUpdateEl = document.getElementById('settingsLastUpdate');

    if (lastUpdateEl) lastUpdateEl.textContent = timeString;
    if (settingsUpdateEl) settingsUpdateEl.textContent = timeString;
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

function showModalStatus(message, type) {
    const status = document.getElementById('modalStatus');
    status.textContent = message;
    status.className = `modal-status ${type}`;
    status.classList.remove('hidden');
}

document.addEventListener('click', (e) => {
    const modal = document.getElementById('addAccountModal');
    if (e.target === modal) {
        closeAddAccountModal();
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showToast(`Unhandled error: ${event.reason?.message || event.reason}`, 'error');
});

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

console.log('Dashboard initialized. Server endpoint:', API_BASE);