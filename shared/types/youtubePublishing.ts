// YouTube publishing: the Google sign-in per channel and the upload jobs, as the API and the Claude tools return them

export type YouTubeConnectionStatus = 'active' | 'needs_reconnect';

// never carries a token; the sealed Google tokens stay in the Worker
export interface YouTubeConnectionSummary {
    id: string;
    channelId: string;
    channelTitle: string;
    // the analytics account for the same channel, when there is one
    accountId: string | null;
    status: YouTubeConnectionStatus;
    scopes: string[];
    createdAt: string;
}

export type YouTubePrivacy = 'private' | 'unlisted' | 'public';

export type YouTubeUploadState =
    | 'queued' | 'uploading' | 'processing' | 'finalizing' | 'done'
    | 'waiting_quota' | 'needs_reconnect' | 'needs_review' | 'failed' | 'cancelled';

export interface YouTubeUploadSummary {
    id: string;
    connectionId: string;
    title: string;
    description: string;
    tags: string[];
    categoryId: string;
    privacy: YouTubePrivacy;
    publishAt: string | null;
    madeForKids: boolean;
    syntheticMedia: boolean;
    notifySubscribers: boolean;
    isShort: boolean;
    hasThumbnail: boolean;
    state: YouTubeUploadState;
    bytesConfirmed: number;
    sourceBytes: number;
    videoId: string | null;
    attempts: number;
    nextAttemptAt: string;
    lastError: string | null;
    createdAt: string;
    updatedAt: string;
}

// body of POST /api/youtube/uploads; the video and thumbnail are files already in the person's media library
export interface YouTubeUploadRequest {
    connectionId: string;
    mediaId: string;
    thumbnailMediaId?: string | null;
    title: string;
    description?: string;
    tags?: string[];
    categoryId?: string;
    privacy: YouTubePrivacy;
    publishAt?: string | null;
    madeForKids: boolean;
    syntheticMedia?: boolean;
    notifySubscribers?: boolean;
    // the same key twice returns the first job instead of uploading the video again
    clientRequestId?: string;
}

// body of PUT /api/youtube/uploads/:id; only a job that has not started uploading can change
export type YouTubeUploadUpdateRequest = Partial<Pick<YouTubeUploadRequest,
    'title' | 'description' | 'tags' | 'categoryId' | 'privacy' | 'publishAt' | 'madeForKids' | 'syntheticMedia' | 'notifySubscribers'>>;

export interface YouTubeConnectionListResponse {
    success: true;
    connections: YouTubeConnectionSummary[];
    // false until the owner sets the Google OAuth client and TOKEN_ENCRYPTION_KEY
    configured: boolean;
}

// the YouTube account (analytics card) whose channel the Google sign-in must prove
export interface YouTubeAuthUrlQuery {
    accountId: string;
}

export interface YouTubeAuthUrlResponse {
    success: true;
    url: string;
}

export interface YouTubeConnectCompleteRequest {
    code: string;
    state: string;
}

export interface YouTubeConnectCompleteResponse {
    success: true;
    connection: YouTubeConnectionSummary;
    outcome: 'connected' | 'reconnected';
}

export interface YouTubeUploadListResponse {
    success: true;
    uploads: YouTubeUploadSummary[];
}

export interface YouTubeUploadResponse {
    success: true;
    upload: YouTubeUploadSummary;
}
