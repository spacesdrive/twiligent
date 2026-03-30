const fetch = require('node-fetch');

async function ytFetch(endpoint, params, apiKey) {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
    params.key = apiKey;
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data;
}

function extractChannelId(input) {
    if (!input) return null;
    input = input.trim();
    if (/^UC[\w-]{22}$/.test(input)) return input;
    const patterns = [
        /youtube\.com\/channel\/(UC[\w-]{22})/,
        /youtube\.com\/@([\w.-]+)/,
        /youtube\.com\/c\/([\w.-]+)/,
        /youtube\.com\/user\/([\w.-]+)/,
        /youtube\.com\/([\w.-]+)/,
    ];
    for (const p of patterns) {
        const m = input.match(p);
        if (m) return m[1];
    }
    return input;
}

async function resolveChannelId(input, apiKey) {
    const extracted = extractChannelId(input);
    if (!extracted) throw new Error('Invalid input');
    if (/^UC[\w-]{22}$/.test(extracted)) return extracted;

    try {
        const data = await ytFetch('channels', { part: 'id', forHandle: extracted }, apiKey);
        if (data.items && data.items.length > 0) return data.items[0].id;
    } catch { }

    try {
        const data = await ytFetch('channels', { part: 'id', forUsername: extracted }, apiKey);
        if (data.items && data.items.length > 0) return data.items[0].id;
    } catch { }

    try {
        const data = await ytFetch('search', { part: 'snippet', q: extracted, type: 'channel', maxResults: '1' }, apiKey);
        if (data.items && data.items.length > 0) return data.items[0].snippet.channelId;
    } catch { }

    throw new Error('Could not resolve channel. Please provide a valid Channel ID (starts with UC).');
}

async function fetchChannelData(channelId, apiKey) {
    const data = await ytFetch('channels', {
        part: 'snippet,statistics,contentDetails,brandingSettings,status,topicDetails',
        id: channelId,
    }, apiKey);

    if (!data.items || data.items.length === 0) throw new Error('Channel not found');
    const ch = data.items[0];

    return {
        channelId: ch.id,
        title: ch.snippet.title,
        description: ch.snippet.description,
        customUrl: ch.snippet.customUrl || '',
        publishedAt: ch.snippet.publishedAt,
        country: ch.snippet.country || 'Unknown',
        thumbnails: {
            default: ch.snippet.thumbnails?.default?.url || '',
            medium: ch.snippet.thumbnails?.medium?.url || '',
            high: ch.snippet.thumbnails?.high?.url || '',
        },
        subscriberCount: parseInt(ch.statistics.subscriberCount) || 0,
        viewCount: parseInt(ch.statistics.viewCount) || 0,
        videoCount: parseInt(ch.statistics.videoCount) || 0,
        hiddenSubscriberCount: ch.statistics.hiddenSubscriberCount || false,
        uploadsPlaylistId: ch.contentDetails?.relatedPlaylists?.uploads || '',
        keywords: ch.brandingSettings?.channel?.keywords || '',
        bannerUrl: ch.brandingSettings?.image?.bannerExternalUrl || '',
        madeForKids: ch.status?.madeForKids || false,
        topicCategories: ch.topicDetails?.topicCategories || [],
        isLinked: ch.status?.isLinked || false,
    };
}

async function fetchAllVideos(playlistId, apiKey, maxPages = 10) {
    let allVideos = [];
    let pageToken = '';
    let page = 0;

    while (page < maxPages) {
        const params = { part: 'snippet,contentDetails', playlistId, maxResults: '50' };
        if (pageToken) params.pageToken = pageToken;

        const data = await ytFetch('playlistItems', params, apiKey);
        if (!data.items || data.items.length === 0) break;

        const videoIds = data.items.map(i => i.snippet.resourceId.videoId).join(',');
        const statsData = await ytFetch('videos', {
            part: 'statistics,contentDetails,snippet,status',
            id: videoIds,
        }, apiKey);

        if (statsData.items) {
            allVideos = allVideos.concat(statsData.items.map(v => ({
                videoId: v.id,
                title: v.snippet.title,
                description: v.snippet.description?.substring(0, 200) || '',
                publishedAt: v.snippet.publishedAt,
                channelTitle: v.snippet.channelTitle,
                thumbnails: {
                    default: v.snippet.thumbnails?.default?.url || '',
                    medium: v.snippet.thumbnails?.medium?.url || '',
                    high: v.snippet.thumbnails?.high?.url || '',
                },
                tags: v.snippet.tags || [],
                categoryId: v.snippet.categoryId || '',
                liveBroadcastContent: v.snippet.liveBroadcastContent || 'none',
                defaultAudioLanguage: v.snippet.defaultAudioLanguage || '',
                duration: v.contentDetails.duration,
                dimension: v.contentDetails.dimension || '2d',
                definition: v.contentDetails.definition || 'hd',
                caption: v.contentDetails.caption === 'true',
                licensedContent: v.contentDetails.licensedContent || false,
                projection: v.contentDetails.projection || 'rectangular',
                viewCount: parseInt(v.statistics.viewCount) || 0,
                likeCount: parseInt(v.statistics.likeCount) || 0,
                commentCount: parseInt(v.statistics.commentCount) || 0,
                privacyStatus: v.status?.privacyStatus || 'public',
                embeddable: v.status?.embeddable || false,
                madeForKids: v.status?.madeForKids || false,
            })));
        }

        pageToken = data.nextPageToken || '';
        if (!pageToken) break;
        page++;
    }

    return allVideos;
}

function parseDuration(iso) {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

function formatCompact(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toString();
}

function computeVideoAnalytics(videos) {
    if (!videos || videos.length === 0) {
        return {
            totalVideos: 0, totalViews: 0, totalLikes: 0, totalComments: 0,
            avgViews: 0, avgLikes: 0, avgComments: 0, medianViews: 0,
            totalEngagement: 0, overallEngagementRate: 0,
            avgDurationSeconds: 0, avgDurationFormatted: '0:00',
            totalDurationSeconds: 0, totalDurationFormatted: '0:00',
            bestByViews: null, bestByLikes: null, bestByComments: null,
            bestByEngagement: null, worstByViews: null,
            mostRecent: null, oldest: null,
            top10ByViews: [], top10ByLikes: [], top10ByComments: [], top10ByEngagement: [],
            shortsCount: 0, regularCount: 0,
            avgShortViews: 0, avgRegularViews: 0,
            hdCount: 0, sdCount: 0, hdPercentage: 0,
            captionCount: 0, captionPercentage: 0,
            licensedCount: 0, licensedPercentage: 0,
            madeForKidsCount: 0, embeddableCount: 0,
            publishDayDistribution: {}, publishHourDistribution: {},
            peakPublishDay: '', peakPublishHour: 0,
            durationDistribution: { short: 0, medium: 0, long: 0, veryLong: 0 },
            categoryDistribution: {},
            tagFrequency: [],
            videosLast7Days: 0, videosLast30Days: 0, videosLast90Days: 0, videosLast365Days: 0,
            uploadFrequencyPerWeek: 0, uploadFrequencyPerMonth: 0,
            consistencyScore: 0, viralityScore: 0,
            viewsDistribution: { ranges: [], counts: [] },
            engagementTrend: [], viewsTrend: [], likeRateTrend: [],
        };
    }

    const now = new Date();
    const durations = videos.map(v => parseDuration(v.duration));
    const totalDuration = durations.reduce((a, b) => a + b, 0);

    const withEngagement = videos.map(v => ({
        ...v,
        engagementRate: v.viewCount > 0 ? ((v.likeCount + v.commentCount) / v.viewCount) * 100 : 0,
        likeRate: v.viewCount > 0 ? (v.likeCount / v.viewCount) * 100 : 0,
        commentRate: v.viewCount > 0 ? (v.commentCount / v.viewCount) * 100 : 0,
        durationSeconds: parseDuration(v.duration),
        daysSinceUpload: Math.max(1, Math.floor((now - new Date(v.publishedAt)) / 86400000)),
    }));

    const viewsSorted = [...withEngagement].sort((a, b) => b.viewCount - a.viewCount);
    const likesSorted = [...withEngagement].sort((a, b) => b.likeCount - a.likeCount);
    const commentsSorted = [...withEngagement].sort((a, b) => b.commentCount - a.commentCount);
    const dateSorted = [...withEngagement].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    const engagementSorted = [...withEngagement].sort((a, b) => b.engagementRate - a.engagementRate);

    const totalViews = videos.reduce((s, v) => s + v.viewCount, 0);
    const totalLikes = videos.reduce((s, v) => s + v.likeCount, 0);
    const totalComments = videos.reduce((s, v) => s + v.commentCount, 0);
    const avgViews = Math.round(totalViews / videos.length);
    const avgLikes = Math.round(totalLikes / videos.length);
    const avgComments = Math.round(totalComments / videos.length);

    const sortedViews = [...videos].map(v => v.viewCount).sort((a, b) => a - b);
    const mid = Math.floor(sortedViews.length / 2);
    const medianViews = sortedViews.length % 2 ? sortedViews[mid] : Math.round((sortedViews[mid - 1] + sortedViews[mid]) / 2);

    const shorts = withEngagement.filter(v => v.durationSeconds <= 60);
    const regular = withEngagement.filter(v => v.durationSeconds > 60);

    const durationDist = { short: 0, medium: 0, long: 0, veryLong: 0 };
    withEngagement.forEach(v => {
        if (v.durationSeconds <= 60) durationDist.short++;
        else if (v.durationSeconds <= 600) durationDist.medium++;
        else if (v.durationSeconds <= 3600) durationDist.long++;
        else durationDist.veryLong++;
    });

    const hdCount = videos.filter(v => v.definition === 'hd').length;
    const captionCount = videos.filter(v => v.caption).length;
    const licensedCount = videos.filter(v => v.licensedContent).length;
    const madeForKidsCount = videos.filter(v => v.madeForKids).length;
    const embeddableCount = videos.filter(v => v.embeddable).length;

    const dayDist = {};
    const hourDist = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    videos.forEach(v => {
        const d = new Date(v.publishedAt);
        const day = dayNames[d.getUTCDay()];
        const hour = d.getUTCHours();
        dayDist[day] = (dayDist[day] || 0) + 1;
        hourDist[hour] = (hourDist[hour] || 0) + 1;
    });

    const peakDay = Object.entries(dayDist).sort((a, b) => b[1] - a[1])[0];
    const peakHour = Object.entries(hourDist).sort((a, b) => b[1] - a[1])[0];

    const catDist = {};
    videos.forEach(v => {
        const cat = v.categoryId || 'Unknown';
        catDist[cat] = (catDist[cat] || 0) + 1;
    });

    const tagMap = {};
    videos.forEach(v => {
        (v.tags || []).forEach(t => {
            const lower = t.toLowerCase();
            tagMap[lower] = (tagMap[lower] || 0) + 1;
        });
    });
    const tagFrequency = Object.entries(tagMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([tag, count]) => ({ tag, count }));

    const msDay = 86400000;
    const videosLast7 = videos.filter(v => (now - new Date(v.publishedAt)) < 7 * msDay).length;
    const videosLast30 = videos.filter(v => (now - new Date(v.publishedAt)) < 30 * msDay).length;
    const videosLast90 = videos.filter(v => (now - new Date(v.publishedAt)) < 90 * msDay).length;
    const videosLast365 = videos.filter(v => (now - new Date(v.publishedAt)) < 365 * msDay).length;

    const oldestDate = new Date(dateSorted[dateSorted.length - 1]?.publishedAt || now);
    const totalWeeks = Math.max(1, (now - oldestDate) / (7 * msDay));
    const totalMonths = Math.max(1, totalWeeks / 4.33);

    const weeklyUploads = videos.reduce((acc, v) => {
        const weekNum = Math.floor((now - new Date(v.publishedAt)) / (7 * msDay));
        acc[weekNum] = (acc[weekNum] || 0) + 1;
        return acc;
    }, {});
    const weekValues = Object.values(weeklyUploads);
    const avgWeekly = weekValues.reduce((a, b) => a + b, 0) / Math.max(1, weekValues.length);
    const variance = weekValues.reduce((s, v) => s + Math.pow(v - avgWeekly, 2), 0) / Math.max(1, weekValues.length);
    const stdDev = Math.sqrt(variance);
    const consistencyScore = Math.max(0, Math.min(100, Math.round(100 - (stdDev / Math.max(0.01, avgWeekly)) * 25)));

    const viralityScore = avgViews > 0 ? Math.round((viewsSorted[0]?.viewCount || 0) / avgViews * 10) / 10 : 0;

    const maxViews = viewsSorted[0]?.viewCount || 0;
    const step = Math.max(1, Math.ceil(maxViews / 10));
    const viewsRanges = [];
    const viewsCounts = [];
    for (let i = 0; i < 10; i++) {
        const low = i * step;
        const high = (i + 1) * step;
        viewsRanges.push(`${formatCompact(low)}-${formatCompact(high)}`);
        viewsCounts.push(videos.filter(v => v.viewCount >= low && v.viewCount < high).length);
    }

    const monthlyData = {};
    withEngagement.forEach(v => {
        const d = new Date(v.publishedAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[key]) monthlyData[key] = { views: 0, likes: 0, comments: 0, count: 0 };
        monthlyData[key].views += v.viewCount;
        monthlyData[key].likes += v.likeCount;
        monthlyData[key].comments += v.commentCount;
        monthlyData[key].count++;
    });
    const sortedMonths = Object.keys(monthlyData).sort();
    const viewsTrend = sortedMonths.map(m => ({ month: m, value: monthlyData[m].views, count: monthlyData[m].count }));
    const engagementTrend = sortedMonths.map(m => ({
        month: m,
        value: monthlyData[m].views > 0
            ? ((monthlyData[m].likes + monthlyData[m].comments) / monthlyData[m].views * 100).toFixed(2)
            : 0,
    }));
    const likeRateTrend = sortedMonths.map(m => ({
        month: m,
        value: monthlyData[m].views > 0 ? ((monthlyData[m].likes / monthlyData[m].views) * 100).toFixed(2) : 0,
    }));

    const formatDuration = (s) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m ${sec}s`;
    };

    const formatVid = (v) => v ? {
        videoId: v.videoId, title: v.title, viewCount: v.viewCount,
        likeCount: v.likeCount, commentCount: v.commentCount,
        publishedAt: v.publishedAt,
        thumbnail: v.thumbnails?.medium || v.thumbnails?.default || '',
        engagementRate: v.engagementRate?.toFixed(2) || 0,
        durationSeconds: v.durationSeconds || parseDuration(v.duration),
    } : null;

    return {
        totalVideos: videos.length,
        totalViews, totalLikes, totalComments,
        avgViews, avgLikes, avgComments, medianViews,
        totalEngagement: totalLikes + totalComments,
        overallEngagementRate: totalViews > 0 ? ((totalLikes + totalComments) / totalViews * 100).toFixed(2) : 0,
        avgDurationSeconds: Math.round(totalDuration / videos.length),
        avgDurationFormatted: formatDuration(Math.round(totalDuration / videos.length)),
        totalDurationSeconds: totalDuration,
        totalDurationFormatted: formatDuration(totalDuration),
        estimatedTotalWatchTimeHours: Math.round((totalDuration * totalViews) / 3600),
        bestByViews: formatVid(viewsSorted[0]),
        bestByLikes: formatVid(likesSorted[0]),
        bestByComments: formatVid(commentsSorted[0]),
        bestByEngagement: formatVid(engagementSorted[0]),
        worstByViews: formatVid(viewsSorted[viewsSorted.length - 1]),
        mostRecent: formatVid(dateSorted[0]),
        oldest: formatVid(dateSorted[dateSorted.length - 1]),
        top10ByViews: viewsSorted.slice(0, 10).map(formatVid),
        top10ByLikes: likesSorted.slice(0, 10).map(formatVid),
        top10ByComments: commentsSorted.slice(0, 10).map(formatVid),
        top10ByEngagement: engagementSorted.slice(0, 10).map(formatVid),
        shortsCount: shorts.length,
        regularCount: regular.length,
        avgShortViews: shorts.length > 0 ? Math.round(shorts.reduce((s, v) => s + v.viewCount, 0) / shorts.length) : 0,
        avgRegularViews: regular.length > 0 ? Math.round(regular.reduce((s, v) => s + v.viewCount, 0) / regular.length) : 0,
        avgShortLikes: shorts.length > 0 ? Math.round(shorts.reduce((s, v) => s + v.likeCount, 0) / shorts.length) : 0,
        avgRegularLikes: regular.length > 0 ? Math.round(regular.reduce((s, v) => s + v.likeCount, 0) / regular.length) : 0,
        hdCount, sdCount: videos.length - hdCount,
        hdPercentage: ((hdCount / videos.length) * 100).toFixed(1),
        captionCount, captionPercentage: ((captionCount / videos.length) * 100).toFixed(1),
        licensedCount, licensedPercentage: ((licensedCount / videos.length) * 100).toFixed(1),
        madeForKidsCount, embeddableCount,
        embeddablePercentage: ((embeddableCount / videos.length) * 100).toFixed(1),
        publishDayDistribution: dayDist,
        publishHourDistribution: hourDist,
        peakPublishDay: peakDay ? peakDay[0] : '',
        peakPublishHour: peakHour ? parseInt(peakHour[0]) : 0,
        durationDistribution: durationDist,
        categoryDistribution: catDist,
        tagFrequency,
        videosLast7Days: videosLast7,
        videosLast30Days: videosLast30,
        videosLast90Days: videosLast90,
        videosLast365Days: videosLast365,
        uploadFrequencyPerWeek: (videos.length / totalWeeks).toFixed(1),
        uploadFrequencyPerMonth: (videos.length / totalMonths).toFixed(1),
        consistencyScore, viralityScore,
        viewsDistribution: { ranges: viewsRanges, counts: viewsCounts },
        viewsTrend, engagementTrend, likeRateTrend,
    };
}

module.exports = {
    ytFetch,
    extractChannelId,
    resolveChannelId,
    fetchChannelData,
    fetchAllVideos,
    parseDuration,
    computeVideoAnalytics,
    formatCompact,
};
