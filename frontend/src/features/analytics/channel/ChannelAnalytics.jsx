import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Grid, Card, CardContent, Button, Avatar, Chip, Tabs, Tab,
    LinearProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    IconButton, Tooltip, Divider, Skeleton, Paper, CircularProgress,
} from '@mui/material';
import {
    ArrowBack, Refresh, Visibility, People, VideoLibrary, ThumbUp, Comment,
    TrendingUp, TrendingDown, Schedule, EmojiEvents, Speed, BarChart as BarChartIcon,
    Whatshot, Timeline, CalendarMonth, AccessTime, HighQuality, ClosedCaption,
    Tag, Category, Timelapse, WorkspacePremium, ShowChart, PieChartOutline,
    Subscriptions, QueryStats, Analytics, SignalCellularAlt, Insights,
    PlayCircleOutline,
} from '@mui/icons-material';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
    ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
    AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import StatCard from '../../../components/ui/StatCard';
import { api } from '../../../services/api';
import { fmtNum, fmtNumFull, fmtDate, fmtPercent, fmtDuration, timeAgo, CATEGORY_MAP } from '../../../utils/formatters';

const COLORS = ['#FF0000', '#3EA6FF', '#4CAF50', '#FF9800', '#AB47BC', '#26A69A', '#EC407A', '#5C6BC0', '#FFCA28', '#00BCD4'];

export default function ChannelAnalytics({ account, showToast, onBack }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tabValue, setTabValue] = useState(0);

    useEffect(() => {
        loadAnalytics();
    }, [account.id]);

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const res = await api.getAnalytics(account.id);
            setData(res);
        } catch (err) {
            showToast('Failed to load analytics: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Button startIcon={<ArrowBack />} onClick={onBack}>Back</Button>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>Loading Analytics...</Typography>
                </Box>
                <LinearProgress color="error" sx={{ mb: 3 }} />
                <Grid container spacing={2.5}>
                    {[...Array(8)].map((_, i) => (
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
                            <Skeleton variant="rounded" height={100} sx={{ borderRadius: 3 }} />
                        </Grid>
                    ))}
                </Grid>
            </Box>
        );
    }

    if (!data) return null;
    const { channel, analytics } = data;

    const dayData = analytics.publishDayDistribution
        ? Object.entries(analytics.publishDayDistribution).map(([day, count]) => ({ day, count }))
        : [];

    const hourData = analytics.publishHourDistribution
        ? Object.entries(analytics.publishHourDistribution)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
            .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
        : [];

    const durationData = analytics.durationDistribution
        ? [
            { name: 'Shorts (<1m)', value: analytics.durationDistribution.short, color: '#FF0000' },
            { name: 'Medium (1-10m)', value: analytics.durationDistribution.medium, color: '#3EA6FF' },
            { name: 'Long (10-60m)', value: analytics.durationDistribution.long, color: '#4CAF50' },
            { name: 'Very Long (>1h)', value: analytics.durationDistribution.veryLong, color: '#FF9800' },
        ].filter(d => d.value > 0)
        : [];

    const catData = analytics.categoryDistribution
        ? Object.entries(analytics.categoryDistribution).map(([id, count]) => ({
            name: CATEGORY_MAP[id] || `Cat ${id}`, value: count,
        }))
        : [];

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Button startIcon={<ArrowBack />} onClick={onBack} sx={{ color: 'text.secondary' }}>Back</Button>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mb: 3 }}>
                <Avatar src={channel.thumbnails?.high || channel.thumbnails?.medium} sx={{ width: 72, height: 72, border: '3px solid rgba(255,0,0,0.3)' }} />
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>{channel.title}</Typography>
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: 0.5, flexWrap: 'wrap' }}>
                        {channel.customUrl && <Chip label={channel.customUrl} size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />}
                        {channel.country && channel.country !== 'Unknown' && <Chip label={channel.country} size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />}
                        <Chip label={`${channel.channelAgeYears} years old`} size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
                        <Chip label={`Since ${fmtDate(channel.publishedAt)}`} size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
                    </Box>
                </Box>
                <Button variant="contained" startIcon={<Refresh />} onClick={loadAnalytics}
                    sx={{ background: 'linear-gradient(135deg, #FF0000, #FF4444)' }}>Refresh</Button>
            </Box>

            {/* Navigation Tabs */}
            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3 }}
                textColor="inherit" TabIndicatorProps={{ sx: { bgcolor: '#FF0000' } }}
                variant="scrollable" scrollButtons="auto">
                <Tab label="Overview" />
                <Tab label="Videos" />
                <Tab label="Engagement" />
                <Tab label="Content" />
                <Tab label="Publishing" />
                <Tab label="Growth" />
                <Tab label="Shorts vs Regular" />
                <Tab label="Tags & SEO" />
            </Tabs>

            {/* TAB 0: Overview */}
            {tabValue === 0 && (
                <Box>
                    {/* Primary KPIs */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                            <StatCard icon={<Visibility />} label="Total Views" value={fmtNum(channel.viewCount)} subtitle={fmtNumFull(channel.viewCount)} gradient="red" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                            <StatCard icon={<People />} label="Subscribers" value={fmtNum(channel.subscriberCount)} subtitle={fmtNumFull(channel.subscriberCount)} gradient="green" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                            <StatCard icon={<VideoLibrary />} label="Total Videos" value={fmtNum(channel.videoCount)} subtitle={`${analytics.totalVideos} analyzed`} gradient="orange" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                            <StatCard icon={<ThumbUp />} label="Total Likes" value={fmtNum(analytics.totalLikes)} subtitle={fmtNumFull(analytics.totalLikes)} gradient="blue" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                            <StatCard icon={<Comment />} label="Total Comments" value={fmtNum(analytics.totalComments)} subtitle={fmtNumFull(analytics.totalComments)} gradient="purple" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                            <StatCard icon={<TrendingUp />} label="Engagement Rate" value={fmtPercent(analytics.overallEngagementRate)} subtitle="Likes+Comments/Views" gradient="teal" small />
                        </Grid>
                    </Grid>

                    {/* Secondary KPIs */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<Speed />} label="Avg Views/Video" value={fmtNum(analytics.avgViews)} gradient="cyan" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<ThumbUp />} label="Avg Likes/Video" value={fmtNum(analytics.avgLikes)} gradient="indigo" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<Comment />} label="Avg Comments/Video" value={fmtNum(analytics.avgComments)} gradient="pink" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<QueryStats />} label="Median Views" value={fmtNum(analytics.medianViews)} gradient="amber" small />
                        </Grid>
                    </Grid>

                    {/* Channel-Level Computed Metrics */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<Visibility />} label="Views per Subscriber" value={channel.viewsPerSubscriber} gradient="red" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<TrendingUp />} label="Avg Subs Gained/Day" value={fmtNum(channel.avgSubGainPerDay)} gradient="green" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<Visibility />} label="Avg Views/Day" value={fmtNum(channel.avgViewsPerDay)} gradient="blue" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<Timelapse />} label="Avg Duration" value={analytics.avgDurationFormatted} gradient="orange" small />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<CalendarMonth />} label="Est. Monthly Views" value={fmtNum(channel.estimatedMonthlyViews)} gradient="indigo" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<People />} label="Est. Monthly Subs" value={fmtNum(channel.estimatedMonthlySubGain)} gradient="teal" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<Whatshot />} label="Virality Score" value={`${analytics.viralityScore}x`} subtitle="Best vs Average" gradient="pink" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<WorkspacePremium />} label="Consistency Score" value={`${analytics.consistencyScore}/100`} gradient="amber" small />
                        </Grid>
                    </Grid>

                    {/* Recent Activity */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <StatCard icon={<Schedule />} label="Videos Last 7 Days" value={analytics.videosLast7Days} gradient="red" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <StatCard icon={<Schedule />} label="Videos Last 30 Days" value={analytics.videosLast30Days} gradient="blue" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <StatCard icon={<Schedule />} label="Videos Last 90 Days" value={analytics.videosLast90Days} gradient="green" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <StatCard icon={<Schedule />} label="Videos Last Year" value={analytics.videosLast365Days} gradient="orange" small />
                        </Grid>
                    </Grid>

                    {/* Upload Frequency */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<Speed />} label="Uploads/Week" value={analytics.uploadFrequencyPerWeek} gradient="purple" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<Speed />} label="Uploads/Month" value={analytics.uploadFrequencyPerMonth} gradient="cyan" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<Timelapse />} label="Total Watch Time" value={fmtNum(analytics.estimatedTotalWatchTimeHours) + 'h'} subtitle="Estimated" gradient="indigo" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<Timelapse />} label="Total Duration" value={analytics.totalDurationFormatted} gradient="amber" small />
                        </Grid>
                    </Grid>

                    {/* Best Performing Videos */}
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, mt: 1 }}>
                        <EmojiEvents sx={{ verticalAlign: 'middle', mr: 1, color: '#FFD700' }} /> Best Performing Videos
                    </Typography>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        {[
                            { label: 'Most Viewed', video: analytics.bestByViews, color: '#FF0000' },
                            { label: 'Most Liked', video: analytics.bestByLikes, color: '#4CAF50' },
                            { label: 'Most Comments', video: analytics.bestByComments, color: '#3EA6FF' },
                            { label: 'Best Engagement', video: analytics.bestByEngagement, color: '#FF9800' },
                        ].map(({ label, video, color }) => video && (
                            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={label}>
                                <Card sx={{ cursor: 'pointer', '&:hover': { transform: 'translateY(-2px)', transition: 'all 0.2s' } }}
                                    onClick={() => window.open(`https://www.youtube.com/watch?v=${video.videoId}`, '_blank', 'noopener')}>
                                    <Box sx={{ position: 'relative' }}>
                                        <Box component="img" src={video.thumbnail} sx={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                                        <Chip label={label} size="small" sx={{ position: 'absolute', top: 8, left: 8, bgcolor: color, color: '#fff', fontWeight: 600 }} />
                                        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0)', transition: 'all 0.2s', '&:hover': { bgcolor: 'rgba(0,0,0,0.4)' } }}>
                                            <PlayCircleOutline sx={{ fontSize: 40, color: '#fff', opacity: 0, transition: 'opacity 0.2s', '.MuiCard-root:hover &': { opacity: 1 } }} />
                                        </Box>
                                    </Box>
                                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {video.title}
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: 1.5, fontSize: 12, color: 'text.secondary', alignItems: 'center' }}>
                                            <span>{fmtNum(video.viewCount)} views</span>
                                            <span>{fmtNum(video.likeCount)} likes</span>
                                            <span>{fmtNum(video.commentCount)} comments</span>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            )}

            {/* TAB 1: Videos */}
            {tabValue === 1 && (
                <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                        Top 10 Videos by Views
                    </Typography>
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={(analytics.top10ByViews || []).map(v => ({ name: v?.title?.substring(0, 30) + '...', views: v?.viewCount || 0, likes: v?.likeCount || 0 }))}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="name" tick={{ fill: '#aaa', fontSize: 10 }} angle={-20} textAnchor="end" height={80} />
                                    <YAxis tick={{ fill: '#aaa', fontSize: 12 }} tickFormatter={fmtNum} />
                                    <ReTooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} formatter={v => fmtNumFull(v)} />
                                    <Bar dataKey="views" fill="#FF0000" radius={[6, 6, 0, 0]} name="Views" />
                                    <Bar dataKey="likes" fill="#4CAF50" radius={[6, 6, 0, 0]} name="Likes" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>All Videos</Typography>
                    <Card>
                        <TableContainer sx={{ maxHeight: 600 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ bgcolor: '#1A1A1A' }}>#</TableCell>
                                        <TableCell sx={{ bgcolor: '#1A1A1A' }}>Video</TableCell>
                                        <TableCell align="right" sx={{ bgcolor: '#1A1A1A' }}>Views</TableCell>
                                        <TableCell align="right" sx={{ bgcolor: '#1A1A1A' }}>Likes</TableCell>
                                        <TableCell align="right" sx={{ bgcolor: '#1A1A1A' }}>Comments</TableCell>
                                        <TableCell align="right" sx={{ bgcolor: '#1A1A1A' }}>Engagement</TableCell>
                                        <TableCell align="right" sx={{ bgcolor: '#1A1A1A' }}>Duration</TableCell>
                                        <TableCell align="right" sx={{ bgcolor: '#1A1A1A' }}>Published</TableCell>
                                        <TableCell align="center" sx={{ bgcolor: '#1A1A1A', width: 50 }}>Watch</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {(analytics.top10ByViews || []).concat(analytics.top10ByLikes || [])
                                        .filter((v, i, arr) => v && arr.findIndex(x => x?.videoId === v?.videoId) === i)
                                        .sort((a, b) => (b?.viewCount || 0) - (a?.viewCount || 0))
                                        .map((v, i) => v && (
                                            <TableRow key={v.videoId} hover sx={{ cursor: 'pointer' }}
                                                onClick={() => window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank', 'noopener')}>
                                                <TableCell>{i + 1}</TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" sx={{ fontWeight: 500, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {v.title}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 600 }}>{fmtNum(v.viewCount)}</TableCell>
                                                <TableCell align="right">{fmtNum(v.likeCount)}</TableCell>
                                                <TableCell align="right">{fmtNum(v.commentCount)}</TableCell>
                                                <TableCell align="right">
                                                    <Chip label={fmtPercent(v.engagementRate)} size="small"
                                                        sx={{ bgcolor: parseFloat(v.engagementRate) > 5 ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.05)', color: parseFloat(v.engagementRate) > 5 ? '#4CAF50' : 'text.secondary', fontWeight: 600, fontSize: 12 }} />
                                                </TableCell>
                                                <TableCell align="right">{fmtDuration(v.durationSeconds)}</TableCell>
                                                <TableCell align="right">
                                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{fmtDate(v.publishedAt)}</Typography>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Tooltip title="Watch on YouTube">
                                                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank', 'noopener'); }}
                                                            sx={{ color: '#FF0000', '&:hover': { bgcolor: 'rgba(255,0,0,0.1)' } }}>
                                                            <PlayCircleOutline fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Card>
                </Box>
            )}

            {/* TAB 2: Engagement */}
            {tabValue === 2 && (
                <Box>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                            <StatCard icon={<ThumbUp />} label="Total Engagement" value={fmtNum(analytics.totalEngagement)} gradient="blue" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                            <StatCard icon={<TrendingUp />} label="Engagement Rate" value={fmtPercent(analytics.overallEngagementRate)} gradient="green" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                            <StatCard icon={<ThumbUp />} label="Avg Like Rate" value={analytics.totalViews > 0 ? fmtPercent((analytics.totalLikes / analytics.totalViews * 100)) : '0%'} gradient="red" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                            <StatCard icon={<Comment />} label="Avg Comment Rate" value={analytics.totalViews > 0 ? fmtPercent((analytics.totalComments / analytics.totalViews * 100)) : '0%'} gradient="purple" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                            <StatCard icon={<Whatshot />} label="Virality Score" value={`${analytics.viralityScore}x`} gradient="orange" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                            <StatCard icon={<SignalCellularAlt />} label="Like/Comment Ratio" value={analytics.totalComments > 0 ? (analytics.totalLikes / analytics.totalComments).toFixed(1) + ':1' : 'N/A'} gradient="teal" small />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2.5}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Engagement Rate Trend</Typography>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <AreaChart data={(analytics.engagementTrend || [])}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="month" tick={{ fill: '#aaa', fontSize: 11 }} />
                                            <YAxis tick={{ fill: '#aaa', fontSize: 11 }} tickFormatter={v => v + '%'} />
                                            <ReTooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                                            <Area type="monotone" dataKey="value" stroke="#4CAF50" fill="rgba(76,175,80,0.15)" strokeWidth={2} name="Engagement %" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Like Rate Trend</Typography>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <AreaChart data={(analytics.likeRateTrend || [])}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="month" tick={{ fill: '#aaa', fontSize: 11 }} />
                                            <YAxis tick={{ fill: '#aaa', fontSize: 11 }} tickFormatter={v => v + '%'} />
                                            <ReTooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                                            <Area type="monotone" dataKey="value" stroke="#FF0000" fill="rgba(255,0,0,0.1)" strokeWidth={2} name="Like Rate %" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    <Card sx={{ mt: 2.5 }}>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Top 10 by Engagement Rate</Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>#</TableCell>
                                            <TableCell>Video</TableCell>
                                            <TableCell align="right">Views</TableCell>
                                            <TableCell align="right">Likes</TableCell>
                                            <TableCell align="right">Comments</TableCell>
                                            <TableCell align="right">Engagement Rate</TableCell>
                                            <TableCell align="center" sx={{ width: 50 }}>Watch</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {(analytics.top10ByEngagement || []).map((v, i) => v && (
                                            <TableRow key={v.videoId} hover sx={{ cursor: 'pointer' }}
                                                onClick={() => window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank', 'noopener')}>
                                                <TableCell>{i + 1}</TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" sx={{ fontWeight: 500, maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {v.title}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right">{fmtNum(v.viewCount)}</TableCell>
                                                <TableCell align="right">{fmtNum(v.likeCount)}</TableCell>
                                                <TableCell align="right">{fmtNum(v.commentCount)}</TableCell>
                                                <TableCell align="right">
                                                    <Chip label={fmtPercent(v.engagementRate)} size="small"
                                                        sx={{ bgcolor: 'rgba(76,175,80,0.15)', color: '#4CAF50', fontWeight: 600 }} />
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Tooltip title="Watch on YouTube">
                                                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank', 'noopener'); }}
                                                            sx={{ color: '#FF0000', '&:hover': { bgcolor: 'rgba(255,0,0,0.1)' } }}>
                                                            <PlayCircleOutline fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </Box>
            )}

            {/* TAB 3: Content */}
            {tabValue === 3 && (
                <Box>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                            <StatCard icon={<HighQuality />} label="HD Videos" value={analytics.hdCount} subtitle={fmtPercent(analytics.hdPercentage)} gradient="blue" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                            <StatCard icon={<ClosedCaption />} label="With Captions" value={analytics.captionCount} subtitle={fmtPercent(analytics.captionPercentage)} gradient="green" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                            <StatCard icon={<WorkspacePremium />} label="Licensed" value={analytics.licensedCount} subtitle={fmtPercent(analytics.licensedPercentage)} gradient="purple" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                            <StatCard icon={<VideoLibrary />} label="Embeddable" value={analytics.embeddableCount} subtitle={fmtPercent(analytics.embeddablePercentage)} gradient="orange" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                            <StatCard icon={<People />} label="Made for Kids" value={analytics.madeForKidsCount} gradient="cyan" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                            <StatCard icon={<Timelapse />} label="Avg Duration" value={analytics.avgDurationFormatted} gradient="amber" small />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2.5}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Duration Distribution</Typography>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie data={durationData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={55} paddingAngle={4}>
                                                {durationData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                            </Pie>
                                            <ReTooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Category Distribution</Typography>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={catData} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis type="number" tick={{ fill: '#aaa', fontSize: 12 }} />
                                            <YAxis dataKey="name" type="category" tick={{ fill: '#aaa', fontSize: 12 }} width={120} />
                                            <ReTooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                                            <Bar dataKey="value" fill="#3EA6FF" radius={[0, 6, 6, 0]} name="Videos" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* Views Distribution */}
                    <Card sx={{ mt: 2.5 }}>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Views Distribution</Typography>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={(analytics.viewsDistribution?.ranges || []).map((r, i) => ({ range: r, count: analytics.viewsDistribution.counts[i] || 0 }))}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="range" tick={{ fill: '#aaa', fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                                    <YAxis tick={{ fill: '#aaa', fontSize: 12 }} />
                                    <ReTooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                                    <Bar dataKey="count" fill="#FF9800" radius={[6, 6, 0, 0]} name="Videos" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </Box>
            )}

            {/* TAB 4: Publishing */}
            {tabValue === 4 && (
                <Box>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<CalendarMonth />} label="Peak Publish Day" value={analytics.peakPublishDay || 'N/A'} gradient="blue" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<AccessTime />} label="Peak Publish Hour" value={analytics.peakPublishHour !== undefined ? `${analytics.peakPublishHour}:00 UTC` : 'N/A'} gradient="green" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<Speed />} label="Uploads/Week" value={analytics.uploadFrequencyPerWeek} gradient="orange" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<WorkspacePremium />} label="Consistency" value={`${analytics.consistencyScore}/100`} gradient="purple" small />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2.5}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Publish Day Distribution</Typography>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={dayData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="day" tick={{ fill: '#aaa', fontSize: 12 }} />
                                            <YAxis tick={{ fill: '#aaa', fontSize: 12 }} />
                                            <ReTooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                                            <Bar dataKey="count" fill="#3EA6FF" radius={[6, 6, 0, 0]} name="Videos" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Publish Hour Distribution (UTC)</Typography>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <AreaChart data={hourData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="hour" tick={{ fill: '#aaa', fontSize: 11 }} />
                                            <YAxis tick={{ fill: '#aaa', fontSize: 12 }} />
                                            <ReTooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                                            <Area type="monotone" dataKey="count" stroke="#FF9800" fill="rgba(255,152,0,0.15)" strokeWidth={2} name="Videos" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Box>
            )}

            {/* TAB 5: Growth */}
            {tabValue === 5 && (
                <Box>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<TrendingUp />} label="Est. Yearly Views" value={fmtNum(channel.estimatedYearlyViews)} gradient="red" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<People />} label="Est. Yearly Subs" value={fmtNum(channel.estimatedYearlySubGain)} gradient="green" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<Visibility />} label="Views/Day Avg" value={fmtNum(channel.avgViewsPerDay)} gradient="blue" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<Subscriptions />} label="Subs/Day Avg" value={fmtNum(channel.avgSubGainPerDay)} gradient="purple" small />
                        </Grid>
                    </Grid>

                    <Card sx={{ mb: 2.5 }}>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Monthly Views Trend</Typography>
                            <ResponsiveContainer width="100%" height={350}>
                                <AreaChart data={(analytics.viewsTrend || [])}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="month" tick={{ fill: '#aaa', fontSize: 11 }} />
                                    <YAxis tick={{ fill: '#aaa', fontSize: 11 }} tickFormatter={fmtNum} />
                                    <ReTooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} formatter={v => fmtNumFull(v)} />
                                    <Area type="monotone" dataKey="value" stroke="#FF0000" fill="rgba(255,0,0,0.1)" strokeWidth={2} name="Views" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Monthly Upload Count</Typography>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={(analytics.viewsTrend || []).map(t => ({ month: t.month, uploads: t.count }))}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="month" tick={{ fill: '#aaa', fontSize: 11 }} />
                                    <YAxis tick={{ fill: '#aaa', fontSize: 12 }} />
                                    <ReTooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                                    <Bar dataKey="uploads" fill="#4CAF50" radius={[6, 6, 0, 0]} name="Uploads" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </Box>
            )}

            {/* TAB 6: Shorts vs Regular */}
            {tabValue === 6 && (
                <Box>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <StatCard icon={<Whatshot />} label="Shorts Count" value={analytics.shortsCount} gradient="red" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <StatCard icon={<VideoLibrary />} label="Regular Videos" value={analytics.regularCount} gradient="blue" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <StatCard icon={<Visibility />} label="Avg Short Views" value={fmtNum(analytics.avgShortViews)} gradient="orange" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <StatCard icon={<Visibility />} label="Avg Regular Views" value={fmtNum(analytics.avgRegularViews)} gradient="green" small />
                        </Grid>
                    </Grid>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <StatCard icon={<ThumbUp />} label="Avg Short Likes" value={fmtNum(analytics.avgShortLikes)} gradient="pink" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <StatCard icon={<ThumbUp />} label="Avg Regular Likes" value={fmtNum(analytics.avgRegularLikes)} gradient="teal" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <StatCard icon={<BarChartIcon />} label="Shorts %" value={analytics.totalVideos > 0 ? fmtPercent(analytics.shortsCount / analytics.totalVideos * 100) : '0%'} gradient="purple" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <StatCard icon={<BarChartIcon />} label="Regular %" value={analytics.totalVideos > 0 ? fmtPercent(analytics.regularCount / analytics.totalVideos * 100) : '0%'} gradient="indigo" small />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2.5}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Content Split</Typography>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: 'Shorts', value: analytics.shortsCount, color: '#FF0000' },
                                                    { name: 'Regular', value: analytics.regularCount, color: '#3EA6FF' },
                                                ].filter(d => d.value > 0)}
                                                dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={55} paddingAngle={4}>
                                                {[{ color: '#FF0000' }, { color: '#3EA6FF' }].map((d, i) => <Cell key={i} fill={d.color} />)}
                                            </Pie>
                                            <ReTooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Performance Comparison</Typography>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={[
                                            { metric: 'Avg Views', Shorts: analytics.avgShortViews, Regular: analytics.avgRegularViews },
                                            { metric: 'Avg Likes', Shorts: analytics.avgShortLikes, Regular: analytics.avgRegularLikes },
                                        ]}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="metric" tick={{ fill: '#aaa', fontSize: 12 }} />
                                            <YAxis tick={{ fill: '#aaa', fontSize: 12 }} tickFormatter={fmtNum} />
                                            <ReTooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} formatter={v => fmtNumFull(v)} />
                                            <Bar dataKey="Shorts" fill="#FF0000" radius={[6, 6, 0, 0]} />
                                            <Bar dataKey="Regular" fill="#3EA6FF" radius={[6, 6, 0, 0]} />
                                            <Legend />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Box>
            )}

            {/* TAB 7: Tags & SEO */}
            {tabValue === 7 && (
                <Box>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<Tag />} label="Unique Tags" value={analytics.tagFrequency?.length || 0} gradient="blue" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<ClosedCaption />} label="Caption Rate" value={fmtPercent(analytics.captionPercentage)} gradient="green" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<HighQuality />} label="HD Rate" value={fmtPercent(analytics.hdPercentage)} gradient="purple" small />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                            <StatCard icon={<VideoLibrary />} label="Embeddable Rate" value={fmtPercent(analytics.embeddablePercentage)} gradient="orange" small />
                        </Grid>
                    </Grid>

                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                                <Tag sx={{ verticalAlign: 'middle', mr: 1 }} /> Most Used Tags
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {(analytics.tagFrequency || []).map(({ tag, count }, i) => (
                                    <Chip key={i} label={`${tag} (${count})`} size="small" variant="outlined"
                                        sx={{
                                            borderColor: `rgba(${i < 5 ? '255,0,0' : i < 15 ? '62,166,255' : '170,170,170'},${0.4 - i * 0.012})`,
                                            color: i < 5 ? '#FF4444' : i < 15 ? '#3EA6FF' : '#aaa',
                                            fontWeight: i < 5 ? 600 : 400,
                                            fontSize: Math.max(11, 14 - i * 0.15),
                                        }} />
                                ))}
                                {(!analytics.tagFrequency || analytics.tagFrequency.length === 0) && (
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>No tags data available</Typography>
                                )}
                            </Box>
                        </CardContent>
                    </Card>

                    {(analytics.tagFrequency || []).length > 0 && (
                        <Card sx={{ mt: 2.5 }}>
                            <CardContent>
                                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Tag Usage Frequency</Typography>
                                <ResponsiveContainer width="100%" height={400}>
                                    <BarChart data={(analytics.tagFrequency || []).slice(0, 20)} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis type="number" tick={{ fill: '#aaa', fontSize: 12 }} />
                                        <YAxis dataKey="tag" type="category" tick={{ fill: '#aaa', fontSize: 11 }} width={150} />
                                        <ReTooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                                        <Bar dataKey="count" fill="#FF0000" radius={[0, 6, 6, 0]} name="Usage Count" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}
                </Box>
            )}
        </Box>
    );
}
