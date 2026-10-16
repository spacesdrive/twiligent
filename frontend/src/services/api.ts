import { supabase } from '../lib/supabase';
import { failureMessage } from '../lib/apiErrors.ts';
import type {
    AccountListResponse, AccountRefreshAllResponse, AccountResponse, ApiFailure, GitHubSettingsRequest,
    GitHubSettingsResponse, HealthResponse, KeysStatusResponse, OverviewResponse, ScheduledPostDeleteAllResponse,
    ScheduledPostListResponse, ScheduledPostRequest, ScheduledPostResponse, ScheduledPostUpdateRequest,
    ScheduledPostUpdateResponse, ScheduledPublishRunResponse, SuccessMessageResponse, SuccessResponse,
    TrackedContentItem, TrackedContentUpdateRequest, YouTubeAccountAddResponse,
} from '@shared/types/domain.ts';
import type {
    CloudinaryConfigResponse, InstagramAnalyticsResponse, InstagramAuthUrlResponse, InstagramContainerStatusResponse,
    InstagramMediaPublishResponse, InstagramMediaResponse, InstagramPublishingLimitResponse, InstagramPublishRequest,
    InstagramPublishResponse, InstagramTokenRefreshResponse,
} from '@shared/types/instagram.ts';
import type { RedditCacheData, RedditPost } from '@shared/types/reddit.ts';
import type {
    AutomationAccountResponse, AutomationActivityItemResponse, AutomationActivityResponse, AutomationOverviewResponse,
    AutomationRuleRequest, AutomationRuleResponse, AutomationRuleUpdateRequest, AutomationStatsResponse, AutomationTestRequest,
    AutomationTestResponse,
} from '@shared/types/automation.ts';
import type {
    ResolveChannelResponse, YouTubeAnalyticsPayload, YouTubeComparisonResponse, YouTubeVideosResponse,
} from '@shared/types/youtube.ts';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8787/api';

// every failure arrives with a 4xx or 5xx status and the ApiFailure body, so a 2xx is always a success
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const res = await fetch(`${API}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        ...options,
    });
    // a proxy error page is not JSON; the status still explains the failure
    const data = await res.json().catch(() => null) as unknown;
    if (!res.ok) throw new Error(failureMessage(res.status, data as Partial<ApiFailure> | null));
    return data as T;
}

const CLOUDINARY_API = 'https://api.cloudinary.com/v1_1';

export type UploadErrorReason = 'network' | 'rejected';

interface UploadErrorDetails {
    cloudinaryMessage?: string;
    parseMessage?: string;
}

// what uploadToCloudinary rejects with
export type UploadError = Error & UploadErrorDetails & { reason: UploadErrorReason };

export type CloudinaryUploadConfig = Pick<CloudinaryConfigResponse, 'cloudName' | 'uploadPreset'>;

export interface UploadOptions {
    onProgress?: (percent: number) => void;
}

// the parts of a Cloudinary upload response the client reads
interface CloudinaryUploadBody {
    secure_url?: string;
    error?: { message?: string };
}

const UPLOAD_ERROR_MESSAGES: Record<UploadErrorReason, string> = {
    network: 'The upload lost its network connection',
    rejected: 'Upload failed',
};

// callers read the reason and details so each page keeps its own wording
function uploadError(reason: UploadErrorReason, details: UploadErrorDetails = {}): UploadError {
    return Object.assign(new Error(UPLOAD_ERROR_MESSAGES[reason]), { reason, ...details });
}

function readUploadError(responseText: string): UploadErrorDetails {
    try {
        return { cloudinaryMessage: (JSON.parse(responseText) as CloudinaryUploadBody).error?.message };
    } catch (err) {
        return { parseMessage: (err as Error).message };
    }
}

// the browser posts straight to Cloudinary so the Worker never handles binaries
function uploadToCloudinary(file: File, cloudConfig: CloudinaryUploadConfig, { onProgress }: UploadOptions = {}): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudConfig.uploadPreset);
    const type = file.type.startsWith('video/') ? 'video' : 'image';
    const xhr = new XMLHttpRequest();
    return new Promise<string>((resolve, reject) => {
        if (onProgress) {
            xhr.upload.addEventListener('progress', e => {
                if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
            });
        }
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve((JSON.parse(xhr.responseText) as CloudinaryUploadBody).secure_url as string);
                return;
            }
            reject(uploadError('rejected', readUploadError(xhr.responseText)));
        });
        xhr.addEventListener('error', () => reject(uploadError('network')));
        xhr.open('POST', `${CLOUDINARY_API}/${cloudConfig.cloudName}/${type}/upload`);
        xhr.send(formData);
    });
}

// screenshots need no progress events and show cloudinary's own error message
async function uploadImage(file: File, cloudConfig: CloudinaryUploadConfig): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudConfig.uploadPreset);

    const res = await fetch(`${CLOUDINARY_API}/${cloudConfig.cloudName}/image/upload`, { method: 'POST', body: formData });
    const json = await res.json() as CloudinaryUploadBody;
    if (!res.ok || !json.secure_url) {
        throw new Error(json.error?.message || 'Cloudinary did not return an image URL');
    }
    return json.secure_url;
}

export const api = {
    health: () => request<HealthResponse>('/health'),

    // Server key status - all keys are env vars, this just returns configured: true/false
    getKeys: () => request<KeysStatusResponse>('/keys'),

    getAccounts: () => request<AccountListResponse>('/accounts'),
    addAccount: (input: string) => request<YouTubeAccountAddResponse>('/accounts', { method: 'POST', body: JSON.stringify({ input }) }),
    deleteAccount: (id: string) => request<SuccessResponse>(`/accounts/${id}`, { method: 'DELETE' }),
    refreshAccount: (id: string) => request<AccountResponse>(`/accounts/${id}/refresh`, { method: 'POST' }),
    refreshAll: () => request<AccountRefreshAllResponse>('/accounts/refresh-all', { method: 'POST' }),

    // Instagram OAuth - gets the auth URL to redirect the browser to
    getInstagramAuthUrl: () => request<InstagramAuthUrlResponse>('/auth/instagram/url'),

    addInstagramAccount: (accessToken: string) => request<AccountResponse>('/accounts/instagram', { method: 'POST', body: JSON.stringify({ accessToken }) }),
    refreshIGToken: (id: string) => request<InstagramTokenRefreshResponse>(`/accounts/${id}/refresh-ig-token`, { method: 'POST' }),
    getIGAnalytics: (id: string) => request<InstagramAnalyticsResponse>(`/accounts/${id}/ig-analytics`),
    getIGMedia: (id: string) => request<InstagramMediaResponse>(`/accounts/${id}/ig-media`),

    // Channel URL/ID resolution
    resolveChannel: (input: string) => request<ResolveChannelResponse>('/resolve-channel', { method: 'POST', body: JSON.stringify({ input }) }),

    // Analytics (YouTube)
    getAnalytics: (id: string) => request<YouTubeAnalyticsPayload>(`/accounts/${id}/analytics`),
    getVideos: (id: string) => request<YouTubeVideosResponse>(`/accounts/${id}/videos`),

    getComparison: () => request<YouTubeComparisonResponse>('/comparison'),

    getCloudinaryConfig: () => request<CloudinaryConfigResponse>('/cloudinary-config'),
    uploadToCloudinary,
    uploadImage,

    // Instagram Publishing
    getIGPublishingLimit: (id: string) => request<InstagramPublishingLimitResponse>(`/accounts/${id}/ig-publishing-limit`),
    createIGContainer: (id: string, data: InstagramPublishRequest) => request<InstagramPublishResponse>(`/accounts/${id}/ig-publish`, { method: 'POST', body: JSON.stringify(data) }),
    getIGContainerStatus: (containerId: string, accountId: string) => request<InstagramContainerStatusResponse>(`/ig-container/${containerId}/status?accountId=${accountId}`),
    publishIGContainer: (id: string, containerId: string) => request<InstagramMediaPublishResponse>(`/accounts/${id}/ig-media-publish`, { method: 'POST', body: JSON.stringify({ containerId }) }),

    addRedditAccount: (username: string, cookie: string) => request<AccountResponse>('/accounts/reddit', { method: 'POST', body: JSON.stringify({ username, cookie }) }),
    getRedditAnalytics: (id: string) => request<RedditCacheData>(`/accounts/${id}/reddit-analytics`),
    getRedditPosts: (id: string) => request<RedditPost[]>(`/accounts/${id}/reddit-posts`),

    // Overview dashboard (tracked content + per-account analytics cache)
    getOverview: () => request<OverviewResponse>('/overview'),

    // Tracked Content (Reddit posts and YouTube videos)
    getTrackedContent: () => request<TrackedContentItem[]>('/tracked-content'),
    addTrackedContent: (url: string, accountId: string | null, label: string, category: string) => request<TrackedContentItem>('/tracked-content', { method: 'POST', body: JSON.stringify({ url, accountId, label, category }) }),
    updateTrackedContent: (id: string, updates: TrackedContentUpdateRequest) => request<TrackedContentItem>(`/tracked-content/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    deleteTrackedContent: (id: string) => request<SuccessResponse>(`/tracked-content/${id}`, { method: 'DELETE' }),
    refreshTrackedContent: (id: string) => request<TrackedContentItem>(`/tracked-content/${id}/refresh`, { method: 'POST' }),

    // GitHub settings
    getGithubSettings: () => request<GitHubSettingsResponse>('/settings/github'),
    saveGithubSettings: (data: GitHubSettingsRequest) => request<SuccessResponse>('/settings/github', { method: 'PUT', body: JSON.stringify(data) }),

    getScheduledPosts: () => request<ScheduledPostListResponse>('/scheduled-posts'),
    createScheduledPost: (data: ScheduledPostRequest) => request<ScheduledPostResponse>('/scheduled-posts', { method: 'POST', body: JSON.stringify(data) }),
    updateScheduledPost: (id: string, data: ScheduledPostUpdateRequest) => request<ScheduledPostUpdateResponse>(`/scheduled-posts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteScheduledPost: (id: string) => request<SuccessMessageResponse>(`/scheduled-posts/${id}`, { method: 'DELETE' }),
    deleteAllScheduledPosts: () => request<ScheduledPostDeleteAllResponse>('/scheduled-posts', { method: 'DELETE' }),
    processScheduled: () => request<ScheduledPublishRunResponse>('/process-scheduled'),

    // Comment-to-DM automation; activity and stats take filters as query parameters
    getAutomations: () => request<AutomationOverviewResponse>('/automations'),
    createAutomationRule: (data: AutomationRuleRequest) => request<AutomationRuleResponse>('/automations/rules', { method: 'POST', body: JSON.stringify(data) }),
    updateAutomationRule: (id: string, data: AutomationRuleUpdateRequest) => request<AutomationRuleResponse>(`/automations/rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    duplicateAutomationRule: (id: string) => request<AutomationRuleResponse>(`/automations/rules/${id}/duplicate`, { method: 'POST' }),
    deleteAutomationRule: (id: string) => request<SuccessMessageResponse>(`/automations/rules/${id}`, { method: 'DELETE' }),
    testAutomationRule: (data: AutomationTestRequest) => request<AutomationTestResponse>('/automations/test', { method: 'POST', body: JSON.stringify(data) }),
    getAutomationActivity: (query: URLSearchParams) => request<AutomationActivityResponse>(`/automations/activity?${query}`),
    retryAutomationActivity: (id: string) => request<AutomationActivityItemResponse>(`/automations/activity/${id}/retry`, { method: 'POST' }),
    getAutomationStats: (query: URLSearchParams) => request<AutomationStatsResponse>(`/automations/stats?${query}`),
    setAutomationAccountPaused: (accountId: string, paused: boolean) => request<AutomationAccountResponse>(`/automations/accounts/${accountId}`, { method: 'PUT', body: JSON.stringify({ paused }) }),
    subscribeAutomationAccount: (accountId: string) => request<AutomationAccountResponse>(`/automations/accounts/${accountId}/subscribe`, { method: 'POST' }),
};
