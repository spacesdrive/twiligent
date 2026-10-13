export type InstagramContentType = 'reel' | 'post' | 'video';

// a media item as normalizeInstagramMedia() stores it in the ig: cache
export interface InstagramMedia {
    id: string;
    caption: string;
    contentType: InstagramContentType;
    mediaType: string;
    mediaUrl: string;
    thumbnailUrl: string;
    permalink: string;
    timestamp: string;
    likeCount: number;
    commentsCount: number;
    viewCount: number | null;
}

export interface IGCacheData {
    media: InstagramMedia[];
    fetchedAt: string;
}
