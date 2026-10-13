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

const CLOUDINARY_API = 'https://api.cloudinary.com/v1_1';

const UPLOAD_ERROR_MESSAGES = {
    network: 'The upload lost its network connection',
    rejected: 'Upload failed',
};

// callers read the reason and details so each page keeps its own wording
function uploadError(reason, details = {}) {
    return Object.assign(new Error(UPLOAD_ERROR_MESSAGES[reason]), { reason, ...details });
}

function readUploadError(responseText) {
    try {
        return { cloudinaryMessage: JSON.parse(responseText).error?.message };
    } catch (err) {
        return { parseMessage: err.message };
    }
}

// the browser posts the file straight to Cloudinary so the Worker never handles binary uploads
function uploadToCloudinary(file, cloudConfig, { onProgress, resourceType } = {}) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudConfig.uploadPreset);
    const type = resourceType || (file.type.startsWith('video/') ? 'video' : 'image');
    const xhr = new XMLHttpRequest();
    return new Promise((resolve, reject) => {
        if (onProgress) {
            xhr.upload.addEventListener('progress', e => {
                if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
            });
        }
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText).secure_url);
                return;
            }
            reject(uploadError('rejected', readUploadError(xhr.responseText)));
        });
        xhr.addEventListener('error', () => reject(uploadError('network')));
        xhr.open('POST', `${CLOUDINARY_API}/${cloudConfig.cloudName}/${type}/upload`);
        xhr.send(formData);
    });
}

// tracked item screenshots use fetch so failures surface exactly as before
async function uploadImage(file, cloudConfig) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudConfig.uploadPreset);

    const res = await fetch(`${CLOUDINARY_API}/${cloudConfig.cloudName}/image/upload`, { method: 'POST', body: formData });
    const json = await res.json();
    if (!res.ok || !json.secure_url) {
        throw new Error(json.error?.message || 'Cloudinary did not return an image URL');
    }
    return json.secure_url;
}

export const api = {
    health: () => request('/health'),

    // Server key status - all keys are env vars, this just returns configured: true/false
    getKeys: () => request('/keys'),

    getAccounts: () => request('/accounts'),
    addAccount: (input) => request('/accounts', { method: 'POST', body: JSON.stringify({ input }) }),
    deleteAccount: (id) => request(`/accounts/${id}`, { method: 'DELETE' }),
    refreshAccount: (id) => request(`/accounts/${id}/refresh`, { method: 'POST' }),
    refreshAll: () => request('/accounts/refresh-all', { method: 'POST' }),

    // Instagram OAuth - gets the auth URL to redirect the browser to
    getInstagramAuthUrl: () => request('/auth/instagram/url'),

    addInstagramAccount: (accessToken) => request('/accounts/instagram', { method: 'POST', body: JSON.stringify({ accessToken }) }),
    refreshIGToken: (id) => request(`/accounts/${id}/refresh-ig-token`, { method: 'POST' }),
    getIGAnalytics: (id) => request(`/accounts/${id}/ig-analytics`),
    getIGMedia: (id) => request(`/accounts/${id}/ig-media`),

    // Channel URL/ID resolution
    resolveChannel: (input) => request('/resolve-channel', { method: 'POST', body: JSON.stringify({ input }) }),

    // Analytics (YouTube)
    getAnalytics: (id) => request(`/accounts/${id}/analytics`),
    getVideos: (id) => request(`/accounts/${id}/videos`),

    getComparison: () => request('/comparison'),

    getCloudinaryConfig: () => request('/cloudinary-config'),
    uploadToCloudinary,
    uploadImage,

    // Instagram Publishing
    getIGPublishingLimit: (id) => request(`/accounts/${id}/ig-publishing-limit`),
    createIGContainer: (id, data) => request(`/accounts/${id}/ig-publish`, { method: 'POST', body: JSON.stringify(data) }),
    getIGContainerStatus: (containerId, accountId) => request(`/ig-container/${containerId}/status?accountId=${accountId}`),
    publishIGContainer: (id, containerId) => request(`/accounts/${id}/ig-media-publish`, { method: 'POST', body: JSON.stringify({ containerId }) }),

    addRedditAccount: (username, cookie) => request('/accounts/reddit', { method: 'POST', body: JSON.stringify({ username, cookie }) }),
    getRedditAnalytics: (id) => request(`/accounts/${id}/reddit-analytics`),
    getRedditPosts: (id) => request(`/accounts/${id}/reddit-posts`),

    // Overview dashboard (tracked content + per-account analytics cache)
    getOverview: () => request('/overview'),

    // Tracked Content (Reddit posts and YouTube videos)
    getTrackedContent: () => request('/tracked-content'),
    addTrackedContent: (url, accountId, label, category) => request('/tracked-content', { method: 'POST', body: JSON.stringify({ url, accountId, label, category }) }),
    updateTrackedContent: (id, updates) => request(`/tracked-content/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    deleteTrackedContent: (id) => request(`/tracked-content/${id}`, { method: 'DELETE' }),
    refreshTrackedContent: (id) => request(`/tracked-content/${id}/refresh`, { method: 'POST' }),

    // GitHub settings
    getGithubSettings: () => request('/settings/github'),
    saveGithubSettings: (data) => request('/settings/github', { method: 'PUT', body: JSON.stringify(data) }),

    getScheduledPosts: () => request('/scheduled-posts'),
    createScheduledPost: (data) => request('/scheduled-posts', { method: 'POST', body: JSON.stringify(data) }),
    updateScheduledPost: (id, data) => request(`/scheduled-posts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteScheduledPost: (id) => request(`/scheduled-posts/${id}`, { method: 'DELETE' }),
    deleteAllScheduledPosts: () => request('/scheduled-posts', { method: 'DELETE' }),
    processScheduled: () => request('/process-scheduled'),
};
