import { newRowId } from '../lib/ids.ts';
import type { Account, NewAccount } from '../../shared/types/domain.ts';
import type { YouTubeChannelData } from '../../shared/types/youtube.ts';
import type { RedditProfile } from '../../shared/types/reddit.ts';
import type { InstagramProfile } from '../../shared/types/instagram.ts';

// a token without a known lifetime is stored with no expiry
export function tokenExpiryIso(expiresIn: number): string | null {
    return expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null;
}

export function buildYouTubeAccount(channelData: YouTubeChannelData): NewAccount {
    return {
        id: newRowId(),
        channelId: channelData.channelId,
        title: channelData.title,
        description: channelData.description,
        customUrl: channelData.customUrl,
        publishedAt: channelData.publishedAt,
        country: channelData.country,
        thumbnails: channelData.thumbnails,
        subscriberCount: channelData.subscriberCount,
        viewCount: channelData.viewCount,
        videoCount: channelData.videoCount,
        hiddenSubscriberCount: channelData.hiddenSubscriberCount,
        uploadsPlaylistId: channelData.uploadsPlaylistId,
        keywords: channelData.keywords,
        topicCategories: channelData.topicCategories,
        madeForKids: channelData.madeForKids,
        addedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
    };
}

export function buildRedditAccount(profile: RedditProfile, cookie: string): Account {
    return {
        id: newRowId(),
        platform: 'reddit',
        username: profile.username,
        title: `u/${profile.username}`,
        totalKarma: profile.totalKarma,
        postKarma: profile.postKarma,
        commentKarma: profile.commentKarma,
        iconUrl: profile.iconUrl,
        createdAt: profile.createdAt,
        cookie,
        addedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
    };
}

export function buildInstagramAccount(profile: InstagramProfile, accessToken: string, expiresIn: number): Account {
    return {
        id: newRowId(),
        platform: 'instagram',
        igUserId: profile.igUserId,
        username: profile.username,
        title: profile.name || profile.username,
        biography: profile.biography,
        website: profile.website,
        profilePictureUrl: profile.profilePictureUrl,
        followersCount: profile.followersCount,
        followsCount: profile.followsCount,
        mediaCount: profile.mediaCount,
        accessToken,
        tokenExpiresAt: tokenExpiryIso(expiresIn),
        addedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
    };
}
