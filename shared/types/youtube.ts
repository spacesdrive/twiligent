// a video as normalizeYouTubeVideo() stores it in the videos: cache
export interface YouTubeVideo {
    videoId: string;
    title: string;
    description: string;
    publishedAt: string;
    channelTitle: string;
    thumbnails: { default: string; medium: string; high: string };
    tags: string[];
    categoryId: string;
    liveBroadcastContent: string;
    defaultAudioLanguage: string;
    duration: string;
    dimension: string;
    definition: string;
    caption: boolean;
    licensedContent: boolean;
    projection: string;
    viewCount: number;
    // null when the owner hides likes or turns comments off
    likeCount: number | null;
    commentCount: number | null;
    privacyStatus: string;
    embeddable: boolean;
    madeForKids: boolean;
}

export interface VideosCacheData {
    videos: YouTubeVideo[];
    fetchedAt: string;
}
