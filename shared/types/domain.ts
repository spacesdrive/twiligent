export type Platform = 'youtube' | 'instagram' | 'reddit';

export interface YouTubeThumbnail {
    url: string;
    width?: number;
    height?: number;
}

export type YouTubeThumbnails = Partial<Record<'default' | 'medium' | 'high' | 'standard' | 'maxres', YouTubeThumbnail>>;

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
    thumbnails?: YouTubeThumbnails;
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
    igUserId?: string;
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
