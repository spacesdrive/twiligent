export function newAccountId() {
    return Date.now().toString() + Math.random().toString(36).substring(2, 6);
}

// a token without a known lifetime is stored with no expiry
export function tokenExpiryIso(expiresIn) {
    return expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null;
}

export function buildYouTubeAccount(channelData) {
    return {
        id: newAccountId(),
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

export function buildRedditAccount(profile, cookie) {
    return {
        id: newAccountId(),
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

export function buildInstagramAccount(profile, accessToken, expiresIn) {
    return {
        id: newAccountId(),
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
