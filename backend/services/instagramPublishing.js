function addCarouselParams(params, post) {
    const { caption, children, collaborators, locationId } = post;
    params.media_type = 'CAROUSEL';
    if (caption) params.caption = caption;
    if (children?.length) params.children = children.join(',');
    if (collaborators?.length) params.collaborators = JSON.stringify(collaborators);
    if (locationId) params.location_id = locationId;
    return params;
}

function addCarouselImageParams(params, post) {
    params.image_url = post.mediaUrl;
    params.is_carousel_item = true;
    return params;
}

function addCarouselVideoParams(params, post) {
    params.media_type = 'VIDEO';
    params.video_url = post.mediaUrl;
    params.is_carousel_item = true;
    return params;
}

function addReelParams(params, post) {
    const { mediaUrl, caption, shareToFeed, coverUrl, collaborators, audioName, thumbOffset, locationId, userTags } = post;
    params.media_type = 'REELS';
    params.video_url = mediaUrl;
    if (caption) params.caption = caption;
    if (shareToFeed !== undefined) params.share_to_feed = shareToFeed;
    if (coverUrl) params.cover_url = coverUrl;
    if (collaborators?.length) params.collaborators = JSON.stringify(collaborators);
    if (audioName) params.audio_name = audioName;
    if (thumbOffset != null) params.thumb_offset = thumbOffset;
    if (locationId) params.location_id = locationId;
    if (userTags?.length) params.user_tags = JSON.stringify(userTags);
    return params;
}

function addStoryParams(params, post) {
    const { mediaUrl, userTags } = post;
    params.media_type = 'STORIES';
    if (mediaUrl?.match(/\.(mp4|mov|avi|webm)/i)) {
        params.video_url = mediaUrl;
    } else {
        params.image_url = mediaUrl;
    }
    if (userTags?.length) params.user_tags = JSON.stringify(userTags);
    return params;
}

function addPhotoParams(params, post) {
    const { mediaUrl, caption, locationId, userTags, altText } = post;
    params.image_url = mediaUrl;
    if (caption) params.caption = caption;
    if (locationId) params.location_id = locationId;
    if (userTags?.length) params.user_tags = JSON.stringify(userTags);
    if (altText) params.alt_text = altText;
    return params;
}

// scripts/publish-scheduled.js keeps its own copy because it must stay dependency-free
export function buildMediaParams(post, accessToken) {
    const params = { access_token: accessToken };
    const { mediaType } = post;
    if (mediaType === 'CAROUSEL') return addCarouselParams(params, post);
    if (mediaType === 'CAROUSEL_ITEM_IMAGE') return addCarouselImageParams(params, post);
    if (mediaType === 'CAROUSEL_ITEM_VIDEO') return addCarouselVideoParams(params, post);
    if (mediaType === 'REELS') return addReelParams(params, post);
    if (mediaType === 'STORIES') return addStoryParams(params, post);
    return addPhotoParams(params, post);
}
