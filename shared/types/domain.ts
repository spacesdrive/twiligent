import type { InstagramContentTypeSummary } from './instagram.ts';
import type { RedditTrackedPostData } from './reddit.ts';
import type { YouTubeTrackedVideoData } from './youtube.ts';

export type Platform = 'youtube' | 'instagram' | 'reddit';

export interface YouTubeThumbnail {
    url: string;
    width?: number;
    height?: number;
}

export type YouTubeThumbnails = Partial<Record<'default' | 'medium' | 'high' | 'standard' | 'maxres', YouTubeThumbnail>>;

// fetchChannelData() flattens each size to its url, and accounts store that shape
export interface ChannelThumbnails {
    default: string;
    medium: string;
    high: string;
}

// one row of `accounts`: id and platform are columns, every other field lives in the data jsonb
export interface Account {
    id: string;
    platform: Platform;
    title?: string;
    addedAt?: string;
    lastUpdated?: string;

    // youtube
    channelId?: string;
    description?: string;
    customUrl?: string;
    publishedAt?: string;
    country?: string;
    thumbnails?: ChannelThumbnails;
    subscriberCount?: number;
    viewCount?: number;
    videoCount?: number;
    hiddenSubscriberCount?: boolean;
    uploadsPlaylistId?: string;
    keywords?: string;
    topicCategories?: string[];
    madeForKids?: boolean;

    // instagram and reddit
    username?: string;

    // instagram
    // null when neither the profile nor the request had an id
    igUserId?: string | null;
    biography?: string;
    website?: string;
    profilePictureUrl?: string;
    followersCount?: number;
    followsCount?: number;
    mediaCount?: number;
    accessToken?: string;
    tokenExpiresAt?: string | null;

    // reddit
    totalKarma?: number;
    postKarma?: number;
    commentKarma?: number;
    iconUrl?: string;
    createdAt?: string | number;
    cookie?: string;
    encryptedPassword?: string;
    encryptedTotpSecret?: string;
    authToken?: string;
    ct0?: string;
}

// youtube accounts are created without a platform field; createAccount stores them as 'youtube'
export type NewAccount = Omit<Account, 'platform'> & { platform?: Platform };

// what an account looks like in a response: secrets removed, cookie presence kept
export type SafeAccount = Omit<Account, 'accessToken' | 'cookie' | 'encryptedPassword' | 'encryptedTotpSecret' | 'authToken' | 'ct0'> & {
    hasCookie: boolean;
};

export type PostStatus = 'pending' | 'publishing' | 'published' | 'failed';

export type MediaType = 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES' | 'CAROUSEL';

export interface UserTag {
    username: string;
    x?: number;
    y?: number;
}

export interface CarouselItem {
    mediaUrl: string;
    mediaType?: MediaType;
}

// one row of `scheduled_posts`: id, account_id, status and scheduled_at are columns, the rest is data jsonb
export interface ScheduledPost {
    id: string;
    accountId: string;
    status: PostStatus;
    scheduledAt: string;
    platform?: Platform;
    mediaType?: MediaType;
    mediaUrl?: string;
    caption?: string;
    coverUrl?: string | null;
    shareToFeed?: boolean;
    collaborators?: string[];
    audioName?: string;
    thumbOffset?: number | null;
    locationId?: string;
    userTags?: UserTag[];
    altText?: string;
    children?: string[];
    carouselItems?: CarouselItem[];
    createdAt?: string;
    publishedAt?: string;
    publishedMediaId?: string | null;
    error?: string | null;
}

export interface ScheduledPublishFailure {
    id: string;
    error: string;
}

// processScheduledPosts() output; the process-scheduled routes add success and timestamp
export interface ScheduledPublishRun {
    processed: number;
    errors: ScheduledPublishFailure[];
}

// one row of `tracked_posts`; fields refreshed from the platform live in the data jsonb
export interface TrackedPost {
    id: string;
    accountId: string | null;
    url: string;
    label: string;
    category: string;
    // 'reddit' unless the row says otherwise
    contentType: string;
    createdAt: string;
    updatedAt: string;
    [field: string]: unknown;
}

// one entry of the refresh-all response, in the same order as the accounts
export interface AccountRefreshResult {
    id: string;
    success: boolean;
    error?: string;
}

// an account whose analytics cache is empty; syncing is true once a background fetch started
export interface PendingAccountSummary {
    id: string;
    cacheWarmed: false;
    syncing: boolean;
}

export interface RedditAccountSummary {
    id: string;
    cacheWarmed: true;
    fetchedPosts: number;
    totalScore: number;
    totalComments: number;
}

export interface InstagramAccountSummary {
    id: string;
    cacheWarmed: true;
    totalLikes: number;
    totalComments: number;
    totalViews: number;
    contentTypes: InstagramContentTypeSummary;
}

export interface YouTubeAccountSummary {
    id: string;
    cacheWarmed: true;
    totalLikes: number;
    totalComments: number;
}

export type AccountSummary = PendingAccountSummary | RedditAccountSummary | InstagramAccountSummary | YouTubeAccountSummary;

// the overview's analyticsCache, keyed by account id; accounts whose cache read failed are left out
export type OverviewAnalyticsCache = Record<string, AccountSummary>;

// GET /api/accounts
export type AccountListResponse = SafeAccount[];

// the reddit, instagram and single refresh account routes
export interface AccountResponse {
    success: true;
    account: SafeAccount;
}

// POST /api/accounts adds a youtube account, which stores no secrets, so it is sent as created
export interface YouTubeAccountAddResponse {
    success: true;
    account: NewAccount;
}

// POST /api/accounts/refresh-all
export interface AccountRefreshAllResponse {
    success: true;
    accounts: SafeAccount[];
    results: AccountRefreshResult[];
    updatedAt: string;
}

// GET /api/scheduled-posts
export interface ScheduledPostListResponse {
    success: true;
    posts: ScheduledPost[];
}

// POST /api/scheduled-posts
export interface ScheduledPostResponse {
    success: true;
    post: ScheduledPost;
}

// PUT /api/scheduled-posts/:id; post is null when the row is gone by the time it is read back
export interface ScheduledPostUpdateResponse {
    success: true;
    post: ScheduledPost | null;
}

// DELETE /api/scheduled-posts; posts that are publishing are kept
export interface ScheduledPostDeleteAllResponse {
    success: true;
    deleted: number;
    kept: number;
}

// GET and POST /api/process-scheduled
export interface ScheduledPublishRunResponse extends ScheduledPublishRun {
    success: true;
    timestamp: string;
}

// GET /api/tracked-content
export type TrackedContentListResponse = TrackedPost[];

// GET /api/overview
export interface OverviewResponse {
    tracked: TrackedPost[];
    analyticsCache: OverviewAnalyticsCache;
}

// body of PUT /api/settings/github; the repository fills the scheduling guide links
export interface GitHubSettingsRequest {
    repoOwner?: string;
    repoName?: string;
    branch?: string;
}

// GET /api/settings/github, exactly what is stored under settings.github
export interface GitHubSettingsResponse {
    repoOwner: string;
    repoName: string;
    branch: string;
}

export interface KeyStatus {
    configured: boolean;
}

// GET /api/keys reports which server secrets are set
export interface KeysStatusResponse {
    youtube: KeyStatus;
    instagram: KeyStatus;
    cloudinary: KeyStatus;
}

// the failure body most routes send; request() only passes it on when the status is 2xx
export interface ApiFailure {
    success: false;
    message: string;
}

// DELETE /api/accounts/:id, DELETE /api/tracked-content/:id and PUT /api/settings/github
export interface SuccessResponse {
    success: true;
}

// DELETE /api/scheduled-posts/:id
export interface SuccessMessageResponse {
    success: true;
    message: string;
}

// GET /api/health
export interface HealthResponse {
    status: string;
    timestamp: string;
}

// body of POST /api/scheduled-posts; the route fills in defaults for the optional fields
export interface ScheduledPostRequest {
    accountId: string;
    mediaUrl: string;
    scheduledAt: string;
    platform?: Platform;
    mediaType?: MediaType;
    caption?: string;
    coverUrl?: string | null;
    shareToFeed?: boolean;
    collaborators?: string[];
    audioName?: string;
    thumbOffset?: number | null;
    locationId?: string;
    userTags?: UserTag[];
    altText?: string;
}

// body of PUT /api/scheduled-posts/:id; any other field is ignored
export type ScheduledPostUpdateRequest = Partial<Pick<ScheduledPost,
    'caption' | 'scheduledAt' | 'shareToFeed' | 'collaborators' | 'audioName' | 'thumbOffset' | 'locationId' | 'userTags' | 'altText' | 'coverUrl'>>;

// fields the user types in for a reddit post, kept in the data jsonb next to the fetched ones
export interface TrackedPostManualFields {
    manualViews?: number | null;
    imageUrl?: string | null;
}

// a tracked post with the fetched fields of whichever platform it tracks
export type TrackedContentItem = TrackedPost
    & Partial<RedditTrackedPostData>
    & Partial<Omit<YouTubeTrackedVideoData, 'contentType'>>
    & TrackedPostManualFields;

// body of POST /api/tracked-content
export interface TrackedContentAddRequest {
    url: string;
    accountId?: string | null;
    label?: string;
    category?: string;
}

// body of PUT /api/tracked-content/:id; null clears manualViews or imageUrl
export interface TrackedContentUpdateRequest extends TrackedPostManualFields {
    label?: string;
    category?: string;
    accountId?: string | null;
}
