import { supabase } from '../lib/supabase';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8787/api';

async function request(path, options = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const res = await fetch(`${API}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        ...options,
    });
    const data = await res.json();
    if (!res.ok && !data.success) throw new Error(data.message || data.error || 'Request failed');
    return data;
}

export const api = {
    // Health
    health: () => request('/health'),

    // Server key status - all keys are env vars, this just returns configured: true/false
    getKeys: () => request('/keys'),

    // Accounts
    getAccounts: () => request('/accounts'),
    addAccount: (input) => request('/accounts', { method: 'POST', body: JSON.stringify({ input }) }),
    deleteAccount: (id) => request(`/accounts/${id}`, { method: 'DELETE' }),
    refreshAccount: (id) => request(`/accounts/${id}/refresh`, { method: 'POST' }),
    refreshAll: () => request('/accounts/refresh-all', { method: 'POST' }),

    // Instagram OAuth - gets the auth URL to redirect the browser to
    getInstagramAuthUrl: () => request('/auth/instagram/url'),

    // Instagram accounts
    addInstagramAccount: (accessToken) => request('/accounts/instagram', { method: 'POST', body: JSON.stringify({ accessToken }) }),
    refreshIGToken: (id) => request(`/accounts/${id}/refresh-ig-token`, { method: 'POST' }),
    getIGAnalytics: (id) => request(`/accounts/${id}/ig-analytics`),
    getIGMedia: (id) => request(`/accounts/${id}/ig-media`),

    // Channel URL/ID resolution
    resolveChannel: (input) => request('/resolve-channel', { method: 'POST', body: JSON.stringify({ input }) }),

    // Analytics (YouTube)
    getAnalytics: (id) => request(`/accounts/${id}/analytics`),
    getVideos: (id) => request(`/accounts/${id}/videos`),

    // Comparison
    getComparison: () => request('/comparison'),

    // Cloudinary config
    getCloudinaryConfig: () => request('/cloudinary-config'),

    // Instagram Publishing
    getIGPublishingLimit: (id) => request(`/accounts/${id}/ig-publishing-limit`),
    createIGContainer: (id, data) => request(`/accounts/${id}/ig-publish`, { method: 'POST', body: JSON.stringify(data) }),
    getIGContainerStatus: (containerId, accountId) => request(`/ig-container/${containerId}/status?accountId=${accountId}`),
    publishIGContainer: (id, containerId) => request(`/accounts/${id}/ig-media-publish`, { method: 'POST', body: JSON.stringify({ containerId }) }),

    // Reddit accounts
    addRedditAccount: (username, cookie) => request('/accounts/reddit', { method: 'POST', body: JSON.stringify({ username, cookie }) }),
    getRedditAnalytics: (id) => request(`/accounts/${id}/reddit-analytics`),
    getRedditPosts: (id) => request(`/accounts/${id}/reddit-posts`),

    // Tracked Content (Reddit posts and YouTube videos)
    getTrackedContent: () => request('/tracked-content'),
    addTrackedContent: (url, accountId, label, category) => request('/tracked-content', { method: 'POST', body: JSON.stringify({ url, accountId, label, category }) }),
    updateTrackedContent: (id, updates) => request(`/tracked-content/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    deleteTrackedContent: (id) => request(`/tracked-content/${id}`, { method: 'DELETE' }),
    refreshTrackedContent: (id) => request(`/tracked-content/${id}/refresh`, { method: 'POST' }),

    // GitHub settings
    getGithubSettings: () => request('/settings/github'),
    saveGithubSettings: (data) => request('/settings/github', { method: 'PUT', body: JSON.stringify(data) }),

    // Scheduled Posts
    getScheduledPosts: () => request('/scheduled-posts'),
    createScheduledPost: (data) => request('/scheduled-posts', { method: 'POST', body: JSON.stringify(data) }),
    updateScheduledPost: (id, data) => request(`/scheduled-posts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteScheduledPost: (id) => request(`/scheduled-posts/${id}`, { method: 'DELETE' }),
    deleteAllScheduledPosts: () => request('/scheduled-posts', { method: 'DELETE' }),
    processScheduled: () => request('/process-scheduled'),
};
