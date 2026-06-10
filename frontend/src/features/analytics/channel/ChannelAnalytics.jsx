import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box, Typography, Grid, Card, CardContent, Button, Avatar, Chip, Tabs, Tab,
    LinearProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    IconButton, Tooltip, Skeleton, Alert,
} from '@mui/material';
import {
    ArrowBack, Refresh, Visibility, People, VideoLibrary, ThumbUp, Comment,
    TrendingUp, Schedule, EmojiEvents, Speed, Whatshot, CalendarMonth, AccessTime,
    HighQuality, ClosedCaption, Tag, Timelapse, WorkspacePremium, SignalCellularAlt,
    Subscriptions, QueryStats, PlayCircleOutline, BarChart as BarChartIcon,
} from '@mui/icons-material';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
    ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
    AreaChart, Area,
} from 'recharts';
import StatCard from '../../../components/ui/StatCard';
import MainCard from '../../../components/MainCard';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, fmtNumFull, fmtDate, fmtPercent, fmtDuration, CATEGORY_MAP } from '../../../utils/formatters';
import { PRIMARY, SUCCESS, WARNING, ERROR, GREY } from '../../../themes/index';

const C = {
    blue:   PRIMARY.main,
    green:  '#52c41a',
    orange: '#fa8c16',
    red:    '#ff4d4f',
    purple: '#722ed1',
    cyan:   '#13c2c2',
    pink:   '#eb2f96',
    indigo: '#2f54eb',
    amber:  '#faad14',
};

const tooltipStyle = {
    backgroundColor: '#fff',
    border: `1px solid ${GREY.A800}`,
    borderRadius: 8,
    fontSize: 13,
    color: GREY[700],
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
};

function ChartCard({ title, children, sx }) {
    return (
        <MainCard title={title} contentSX={{ p: 2, ...sx }}>
            {children}
        </MainCard>
    );
}

export default function ChannelAnalytics() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { accounts, showToast } = useAppContext();
    const account = accounts.find(a => a.id === id);

    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [tabValue, setTabValue] = useState(0);

    useEffect(() => { if (id) loadAnalytics(); }, [id]);

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const res = await api.getAnalytics(id);
            setData(res);
        } catch (err) {
            showToast('Failed to load analytics: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!account && !loading) {
        return (
            <Box>
                <Button startIcon={<ArrowBack />} onClick={() => navigate('/')} sx={{ mb: 2 }}>Back to Overview</Button>
                <Alert severity="error">Account not found. It may have been removed.</Alert>
            </Box>
        );
    }

    if (loading) {
        return (
            <Box>
                <Button startIcon={<ArrowBack />} onClick={() => navigate('/')} sx={{ mb: 2, color: 'text.secondary' }}>Back</Button>
                <LinearProgress sx={{ mb: 3, borderRadius: 1 }} />
                <Grid container spacing={2.5}>
                    {[...Array(8)].map((_, i) => (
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
                            <Skeleton variant="rounded" height={110} sx={{ borderRadius: 2 }} />
                        </Grid>
                    ))}
                </Grid>
            </Box>
        );
    }

    if (!data) return null;
    const { channel, analytics } = data;

    const dayData  = analytics.publishDayDistribution
        ? Object.entries(analytics.publishDayDistribution).map(([day, count]) => ({ day, count }))
        : [];
    const hourData = analytics.publishHourDistribution
        ? Object.entries(analytics.publishHourDistribution)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
            .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
        : [];
    const durationData = analytics.durationDistribution
        ? [
            { name: 'Shorts (<1m)',   value: analytics.durationDistribution.short,    color: C.red    },
            { name: 'Medium (1-10m)', value: analytics.durationDistribution.medium,   color: C.blue   },
            { name: 'Long (10-60m)', value: analytics.durationDistribution.long,     color: C.green  },
            { name: 'Very Long (>1h)',value: analytics.durationDistribution.veryLong, color: C.orange },
        ].filter(d => d.value > 0)
        : [];
    const catData = analytics.categoryDistribution
        ? Object.entries(analytics.categoryDistribution).map(([id, count]) => ({
            name: CATEGORY_MAP[id] || `Cat ${id}`, value: count,
        }))
        : [];

    const TABS = ['Overview', 'Videos', 'Engagement', 'Content', 'Publishing', 'Growth', 'Shorts vs Regular', 'Tags & SEO'];

    return (
        <Box>
            {/* Back */}
            <Button
                startIcon={<ArrowBack />}
                onClick={() => navigate('/')}
                size="small"
                sx={{ mb: 1.5, color: 'text.secondary', fontWeight: 500 }}
            >
                Back to Overview
            </Button>

            {/* Channel header */}
            <MainCard sx={{ mb: 3 }} content={false}>
                <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
                    <Avatar
                        src={channel.thumbnails?.high || channel.thumbnails?.medium}
                        sx={{ width: 64, height: 64, border: `2px solid ${GREY.A800}` }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h4" sx={{ mb: 0.5 }}>{channel.title}</Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                            {channel.customUrl && (
                                <Chip label={channel.customUrl} size="small" variant="outlined" />
                            )}
                            {channel.country && channel.country !== 'Unknown' && (
                                <Chip label={channel.country} size="small" variant="outlined" />
                            )}
                            <Chip label={`${channel.channelAgeYears} years old`} size="small" variant="outlined" />
                            <Chip label={`Since ${fmtDate(channel.publishedAt)}`} size="small" variant="outlined" />
                        </Box>
                    </Box>
                    <Button
                        variant="contained"
                        startIcon={<Refresh />}
                        onClick={loadAnalytics}
                        size="small"
                    >
                        Refresh
                    </Button>
                </Box>
            </MainCard>

            {/* Tabs */}
            <Box sx={{ borderBottom: `1px solid ${GREY.A800}`, mb: 3 }}>
                <Tabs
                    value={tabValue}
                    onChange={(_, v) => setTabValue(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{ minHeight: 46 }}
                >
                    {TABS.map(label => <Tab key={label} label={label} />)}
                </Tabs>
            </Box>

            {/* TAB 0: Overview */}
            {tabValue === 0 && (
                <Box>
                    <Grid container spacing={2} sx={{ mb: 2.5 }}>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}><StatCard icon={<Visibility />} label="Total Views"     value={fmtNum(channel.viewCount)}               subtitle={fmtNumFull(channel.viewCount)}         gradient="red"    small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}><StatCard icon={<People />}    label="Subscribers"     value={fmtNum(channel.subscriberCount)}          subtitle={fmtNumFull(channel.subscriberCount)}   gradient="green"  small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}><StatCard icon={<VideoLibrary />} label="Total Videos" value={fmtNum(channel.videoCount)}               subtitle={`${analytics.totalVideos} analyzed`}   gradient="orange" small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}><StatCard icon={<ThumbUp />}   label="Total Likes"     value={fmtNum(analytics.totalLikes)}            subtitle={fmtNumFull(analytics.totalLikes)}      gradient="blue"   small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}><StatCard icon={<Comment />}   label="Total Comments"  value={fmtNum(analytics.totalComments)}         subtitle={fmtNumFull(analytics.totalComments)}   gradient="purple" small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}><StatCard icon={<TrendingUp />} label="Engagement Rate" value={fmtPercent(analytics.overallEngagementRate)} subtitle="Likes+Comments/Views"             gradient="teal"   small /></Grid>
                    </Grid>
                    <Grid container spacing={2} sx={{ mb: 2.5 }}>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard icon={<Speed />}      label="Avg Views/Video"   value={fmtNum(analytics.avgViews)}                 gradient="cyan"   small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard icon={<ThumbUp />}    label="Avg Likes/Video"   value={fmtNum(analytics.avgLikes)}                 gradient="indigo" small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard icon={<Comment />}    label="Avg Comments"      value={fmtNum(analytics.avgComments)}              gradient="pink"   small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard icon={<QueryStats />} label="Median Views"      value={fmtNum(analytics.medianViews)}              gradient="amber"  small /></Grid>
                    </Grid>
                    <Grid container spacing={2} sx={{ mb: 2.5 }}>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard icon={<Visibility />}    label="Views/Subscriber"    value={channel.viewsPerSubscriber}              gradient="red"    small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard icon={<TrendingUp />}   label="Avg Subs/Day"        value={fmtNum(channel.avgSubGainPerDay)}        gradient="green"  small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard icon={<Visibility />}   label="Avg Views/Day"       value={fmtNum(channel.avgViewsPerDay)}          gradient="blue"   small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard icon={<Timelapse />}    label="Avg Duration"        value={analytics.avgDurationFormatted}          gradient="orange" small /></Grid>
                    </Grid>
                    <Grid container spacing={2} sx={{ mb: 2.5 }}>
                        <Grid size={{ xs: 6, sm: 3 }}><StatCard icon={<Schedule />} label="Videos (7d)"   value={analytics.videosLast7Days}    gradient="red"    small /></Grid>
                        <Grid size={{ xs: 6, sm: 3 }}><StatCard icon={<Schedule />} label="Videos (30d)"  value={analytics.videosLast30Days}   gradient="blue"   small /></Grid>
                        <Grid size={{ xs: 6, sm: 3 }}><StatCard icon={<Schedule />} label="Videos (90d)"  value={analytics.videosLast90Days}   gradient="green"  small /></Grid>
                        <Grid size={{ xs: 6, sm: 3 }}><StatCard icon={<Schedule />} label="Videos (365d)" value={analytics.videosLast365Days}  gradient="orange" small /></Grid>
                    </Grid>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard icon={<CalendarMonth />} label="Est. Monthly Views" value={fmtNum(channel.estimatedMonthlyViews)}   gradient="indigo" small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard icon={<People />}        label="Est. Monthly Subs"  value={fmtNum(channel.estimatedMonthlySubGain)} gradient="teal"   small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard icon={<Whatshot />}      label="Virality Score"     value={`${analytics.viralityScore}x`}           gradient="pink"   small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard icon={<WorkspacePremium />} label="Consistency"    value={`${analytics.consistencyScore}/100`}      gradient="amber"  small /></Grid>
                    </Grid>

                    <Typography variant="h5" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EmojiEvents sx={{ color: '#faad14' }} /> Best Performing Videos
                    </Typography>
                    <Grid container spacing={2}>
                        {[
                            { label: 'Most Viewed',     video: analytics.bestByViews,      color: C.red    },
                            { label: 'Most Liked',      video: analytics.bestByLikes,      color: C.green  },
                            { label: 'Most Comments',   video: analytics.bestByComments,   color: C.blue   },
                            { label: 'Best Engagement', video: analytics.bestByEngagement, color: C.orange },
                        ].map(({ label, video, color }) => video && (
                            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={label}>
                                <Card
                                    sx={{ cursor: 'pointer', border: `1px solid ${GREY.A800}`, transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.12)' } }}
                                    onClick={() => window.open(`https://www.youtube.com/watch?v=${video.videoId}`, '_blank', 'noopener')}
                                >
                                    <Box sx={{ position: 'relative' }}>
                                        <Box component="img" src={video.thumbnail} sx={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                                        <Chip label={label} size="small" sx={{ position: 'absolute', top: 8, left: 8, bgcolor: color, color: '#fff', fontWeight: 600, fontSize: '0.7rem' }} />
                                    </Box>
                                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {video.title}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {fmtNum(video.viewCount)} views · {fmtNum(video.likeCount)} likes
                                        </Typography>
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
                    <ChartCard title="Top 10 Videos by Views" sx={{ mb: 2.5 }}>
                        <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={(analytics.top10ByViews || []).map(v => ({ name: (v?.title || '').slice(0, 28) + '…', views: v?.viewCount || 0, likes: v?.likeCount || 0 }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke={GREY[200]} vertical={false} />
                                <XAxis dataKey="name" tick={{ fill: GREY[500], fontSize: 10 }} angle={-15} textAnchor="end" height={70} />
                                <YAxis tick={{ fill: GREY[500], fontSize: 12 }} tickFormatter={fmtNum} axisLine={false} tickLine={false} />
                                <ReTooltip contentStyle={tooltipStyle} formatter={v => fmtNumFull(v)} />
                                <Bar dataKey="views" fill={C.red}   radius={[4, 4, 0, 0]} name="Views" />
                                <Bar dataKey="likes" fill={C.green} radius={[4, 4, 0, 0]} name="Likes" />
                                <Legend />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>

                    <MainCard title="Video List" content={false}>
                        <TableContainer sx={{ maxHeight: 560 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>#</TableCell>
                                        <TableCell>Video</TableCell>
                                        <TableCell align="right">Views</TableCell>
                                        <TableCell align="right">Likes</TableCell>
                                        <TableCell align="right">Comments</TableCell>
                                        <TableCell align="right">Engagement</TableCell>
                                        <TableCell align="right">Duration</TableCell>
                                        <TableCell align="right">Published</TableCell>
                                        <TableCell align="center" sx={{ width: 50 }} />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {(analytics.top10ByViews || []).concat(analytics.top10ByLikes || [])
                                        .filter((v, i, arr) => v && arr.findIndex(x => x?.videoId === v?.videoId) === i)
                                        .sort((a, b) => (b?.viewCount || 0) - (a?.viewCount || 0))
                                        .map((v, i) => v && (
                                            <TableRow key={v.videoId} hover sx={{ cursor: 'pointer' }}
                                                onClick={() => window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank', 'noopener')}>
                                                <TableCell><Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>{i + 1}</Typography></TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" sx={{ fontWeight: 500, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {v.title}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 600 }}>{fmtNum(v.viewCount)}</Typography></TableCell>
                                                <TableCell align="right"><Typography variant="body2">{fmtNum(v.likeCount)}</Typography></TableCell>
                                                <TableCell align="right"><Typography variant="body2">{fmtNum(v.commentCount)}</Typography></TableCell>
                                                <TableCell align="right">
                                                    <Chip label={fmtPercent(v.engagementRate)} size="small"
                                                        sx={{ bgcolor: parseFloat(v.engagementRate) > 5 ? '#f6ffed' : GREY[100], color: parseFloat(v.engagementRate) > 5 ? '#389e0d' : 'text.secondary', fontWeight: 600, fontSize: '0.7rem', height: 20 }} />
                                                </TableCell>
                                                <TableCell align="right"><Typography variant="body2">{fmtDuration(v.durationSeconds)}</Typography></TableCell>
                                                <TableCell align="right"><Typography variant="caption" color="text.secondary">{fmtDate(v.publishedAt)}</Typography></TableCell>
                                                <TableCell align="center">
                                                    <Tooltip title="Watch on YouTube">
                                                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank', 'noopener'); }}
                                                            sx={{ color: '#ff4d4f', '&:hover': { bgcolor: '#fff1f0' } }}>
                                                            <PlayCircleOutline sx={{ fontSize: 16 }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </MainCard>
                </Box>
            )}

            {/* TAB 2: Engagement */}
            {tabValue === 2 && (
                <Box>
                    <Grid container spacing={2} sx={{ mb: 2.5 }}>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}><StatCard icon={<ThumbUp />}          label="Total Engagement"   value={fmtNum(analytics.totalEngagement)}         gradient="blue"   small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}><StatCard icon={<TrendingUp />}        label="Engagement Rate"    value={fmtPercent(analytics.overallEngagementRate)} gradient="green" small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}><StatCard icon={<ThumbUp />}          label="Avg Like Rate"      value={analytics.totalViews > 0 ? fmtPercent(analytics.totalLikes / analytics.totalViews * 100) : '0%'} gradient="red" small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}><StatCard icon={<Comment />}           label="Avg Comment Rate"   value={analytics.totalViews > 0 ? fmtPercent(analytics.totalComments / analytics.totalViews * 100) : '0%'} gradient="purple" small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}><StatCard icon={<Whatshot />}          label="Virality Score"     value={`${analytics.viralityScore}x`}              gradient="orange" small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}><StatCard icon={<SignalCellularAlt />} label="Like/Comment Ratio" value={analytics.totalComments > 0 ? (analytics.totalLikes / analytics.totalComments).toFixed(1) + ':1' : 'N/A'} gradient="teal" small /></Grid>
                    </Grid>
                    <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <ChartCard title="Engagement Rate Trend">
                                <ResponsiveContainer width="100%" height={280}>
                                    <AreaChart data={analytics.engagementTrend || []}>
                                        <defs><linearGradient id="egGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.green} stopOpacity={0.15} /><stop offset="95%" stopColor={C.green} stopOpacity={0.01} /></linearGradient></defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke={GREY[200]} vertical={false} />
                                        <XAxis dataKey="month" tick={{ fill: GREY[500], fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: GREY[500], fontSize: 11 }} tickFormatter={v => v + '%'} axisLine={false} tickLine={false} />
                                        <ReTooltip contentStyle={tooltipStyle} />
                                        <Area type="monotone" dataKey="value" stroke={C.green} fill="url(#egGrad)" strokeWidth={2} name="Engagement %" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <ChartCard title="Like Rate Trend">
                                <ResponsiveContainer width="100%" height={280}>
                                    <AreaChart data={analytics.likeRateTrend || []}>
                                        <defs><linearGradient id="lrGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.red} stopOpacity={0.12} /><stop offset="95%" stopColor={C.red} stopOpacity={0.01} /></linearGradient></defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke={GREY[200]} vertical={false} />
                                        <XAxis dataKey="month" tick={{ fill: GREY[500], fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: GREY[500], fontSize: 11 }} tickFormatter={v => v + '%'} axisLine={false} tickLine={false} />
                                        <ReTooltip contentStyle={tooltipStyle} />
                                        <Area type="monotone" dataKey="value" stroke={C.red} fill="url(#lrGrad)" strokeWidth={2} name="Like Rate %" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        </Grid>
                    </Grid>
                    <MainCard title="Top 10 by Engagement Rate" content={false}>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>#</TableCell><TableCell>Video</TableCell><TableCell align="right">Views</TableCell>
                                        <TableCell align="right">Likes</TableCell><TableCell align="right">Comments</TableCell>
                                        <TableCell align="right">Eng. Rate</TableCell><TableCell align="center" sx={{ width: 50 }} />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {(analytics.top10ByEngagement || []).map((v, i) => v && (
                                        <TableRow key={v.videoId} hover sx={{ cursor: 'pointer' }} onClick={() => window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank', 'noopener')}>
                                            <TableCell><Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>{i + 1}</Typography></TableCell>
                                            <TableCell><Typography variant="body2" sx={{ fontWeight: 500, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</Typography></TableCell>
                                            <TableCell align="right"><Typography variant="body2">{fmtNum(v.viewCount)}</Typography></TableCell>
                                            <TableCell align="right"><Typography variant="body2">{fmtNum(v.likeCount)}</Typography></TableCell>
                                            <TableCell align="right"><Typography variant="body2">{fmtNum(v.commentCount)}</Typography></TableCell>
                                            <TableCell align="right"><Chip label={fmtPercent(v.engagementRate)} size="small" sx={{ bgcolor: '#f6ffed', color: '#389e0d', fontWeight: 600, fontSize: '0.7rem', height: 20 }} /></TableCell>
                                            <TableCell align="center">
                                                <Tooltip title="Watch on YouTube"><IconButton size="small" onClick={(e) => { e.stopPropagation(); window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank', 'noopener'); }} sx={{ color: '#ff4d4f', '&:hover': { bgcolor: '#fff1f0' } }}><PlayCircleOutline sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </MainCard>
                </Box>
            )}

            {/* TAB 3: Content */}
            {tabValue === 3 && (
                <Box>
                    <Grid container spacing={2} sx={{ mb: 2.5 }}>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}><StatCard icon={<HighQuality />}    label="HD Videos"    value={analytics.hdCount}         subtitle={fmtPercent(analytics.hdPercentage)}         gradient="blue"   small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}><StatCard icon={<ClosedCaption />}  label="Captions"     value={analytics.captionCount}    subtitle={fmtPercent(analytics.captionPercentage)}    gradient="green"  small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}><StatCard icon={<WorkspacePremium />} label="Licensed"   value={analytics.licensedCount}   subtitle={fmtPercent(analytics.licensedPercentage)}   gradient="purple" small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}><StatCard icon={<VideoLibrary />}   label="Embeddable"  value={analytics.embeddableCount} subtitle={fmtPercent(analytics.embeddablePercentage)} gradient="orange" small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}><StatCard icon={<People />}         label="Kids Content" value={analytics.madeForKidsCount}                                                     gradient="cyan"   small /></Grid>
                        <Grid size={{ xs: 6, sm: 4, md: 2 }}><StatCard icon={<Timelapse />}      label="Avg Duration" value={analytics.avgDurationFormatted}                                                  gradient="amber"  small /></Grid>
                    </Grid>
                    <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <ChartCard title="Duration Distribution">
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie data={durationData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={50} paddingAngle={3} strokeWidth={0}>
                                            {durationData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                        </Pie>
                                        <ReTooltip contentStyle={tooltipStyle} />
                                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <ChartCard title="Category Distribution">
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={catData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke={GREY[200]} horizontal={false} />
                                        <XAxis type="number" tick={{ fill: GREY[500], fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <YAxis dataKey="name" type="category" tick={{ fill: GREY[500], fontSize: 11 }} width={110} axisLine={false} tickLine={false} />
                                        <ReTooltip contentStyle={tooltipStyle} />
                                        <Bar dataKey="value" fill={C.blue} radius={[0, 4, 4, 0]} name="Videos" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        </Grid>
                    </Grid>
                    <ChartCard title="Views Distribution">
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={(analytics.viewsDistribution?.ranges || []).map((r, i) => ({ range: r, count: analytics.viewsDistribution.counts[i] || 0 }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke={GREY[200]} vertical={false} />
                                <XAxis dataKey="range" tick={{ fill: GREY[500], fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
                                <YAxis tick={{ fill: GREY[500], fontSize: 12 }} axisLine={false} tickLine={false} />
                                <ReTooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="count" fill={C.orange} radius={[4, 4, 0, 0]} name="Videos" />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                </Box>
            )}

            {/* TAB 4: Publishing */}
            {tabValue === 4 && (
                <Box>
                    <Grid container spacing={2} sx={{ mb: 2.5 }}>
                        <Grid size={{ xs: 6, sm: 3 }}><StatCard icon={<CalendarMonth />}  label="Peak Publish Day"  value={analytics.peakPublishDay || 'N/A'}                                                                   gradient="blue"   small /></Grid>
                        <Grid size={{ xs: 6, sm: 3 }}><StatCard icon={<AccessTime />}     label="Peak Publish Hour" value={analytics.peakPublishHour !== undefined ? `${analytics.peakPublishHour}:00 UTC` : 'N/A'}             gradient="green"  small /></Grid>
                        <Grid size={{ xs: 6, sm: 3 }}><StatCard icon={<Speed />}          label="Uploads/Week"      value={analytics.uploadFrequencyPerWeek}                                                                    gradient="orange" small /></Grid>
                        <Grid size={{ xs: 6, sm: 3 }}><StatCard icon={<WorkspacePremium />} label="Consistency"     value={`${analytics.consistencyScore}/100`}                                                                 gradient="purple" small /></Grid>
                    </Grid>
                    <Grid container spacing={2.5}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <ChartCard title="Publish Day Distribution">
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={dayData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={GREY[200]} vertical={false} />
                                        <XAxis dataKey="day" tick={{ fill: GREY[500], fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: GREY[500], fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <ReTooltip contentStyle={tooltipStyle} />
                                        <Bar dataKey="count" fill={C.blue} radius={[4, 4, 0, 0]} name="Videos" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <ChartCard title="Publish Hour Distribution (UTC)">
                                <ResponsiveContainer width="100%" height={280}>
                                    <AreaChart data={hourData}>
                                        <defs><linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.orange} stopOpacity={0.15} /><stop offset="95%" stopColor={C.orange} stopOpacity={0.01} /></linearGradient></defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke={GREY[200]} vertical={false} />
                                        <XAxis dataKey="hour" tick={{ fill: GREY[500], fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: GREY[500], fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <ReTooltip contentStyle={tooltipStyle} />
                                        <Area type="monotone" dataKey="count" stroke={C.orange} fill="url(#hourGrad)" strokeWidth={2} name="Videos" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        </Grid>
                    </Grid>
                </Box>
            )}

            {/* TAB 5: Growth */}
            {tabValue === 5 && (
                <Box>
                    <Grid container spacing={2} sx={{ mb: 2.5 }}>
                        <Grid size={{ xs: 6, sm: 3 }}><StatCard icon={<TrendingUp />}  label="Est. Yearly Views" value={fmtNum(channel.estimatedYearlyViews)}    gradient="red"    small /></Grid>
                        <Grid size={{ xs: 6, sm: 3 }}><StatCard icon={<People />}       label="Est. Yearly Subs"  value={fmtNum(channel.estimatedYearlySubGain)} gradient="green"  small /></Grid>
                        <Grid size={{ xs: 6, sm: 3 }}><StatCard icon={<Visibility />}   label="Views/Day Avg"     value={fmtNum(channel.avgViewsPerDay)}          gradient="blue"   small /></Grid>
                        <Grid size={{ xs: 6, sm: 3 }}><StatCard icon={<Subscriptions />} label="Subs/Day Avg"     value={fmtNum(channel.avgSubGainPerDay)}        gradient="purple" small /></Grid>
                    </Grid>
                    <ChartCard title="Monthly Views Trend" sx={{ mb: 2.5 }}>
                        <ResponsiveContainer width="100%" height={320}>
                            <AreaChart data={analytics.viewsTrend || []}>
                                <defs><linearGradient id="viewGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.red} stopOpacity={0.12} /><stop offset="95%" stopColor={C.red} stopOpacity={0.01} /></linearGradient></defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={GREY[200]} vertical={false} />
                                <XAxis dataKey="month" tick={{ fill: GREY[500], fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: GREY[500], fontSize: 11 }} tickFormatter={fmtNum} axisLine={false} tickLine={false} />
                                <ReTooltip contentStyle={tooltipStyle} formatter={v => fmtNumFull(v)} />
                                <Area type="monotone" dataKey="value" stroke={C.red} fill="url(#viewGrad)" strokeWidth={2} name="Views" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </ChartCard>
                    <ChartCard title="Monthly Upload Count">
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={(analytics.viewsTrend || []).map(t => ({ month: t.month, uploads: t.count }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke={GREY[200]} vertical={false} />
                                <XAxis dataKey="month" tick={{ fill: GREY[500], fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: GREY[500], fontSize: 12 }} axisLine={false} tickLine={false} />
                                <ReTooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="uploads" fill={C.green} radius={[4, 4, 0, 0]} name="Uploads" />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                </Box>
            )}

            {/* TAB 6: Shorts vs Regular */}
            {tabValue === 6 && (
                <Box>
                    <Grid container spacing={2} sx={{ mb: 2.5 }}>
                        <Grid size={{ xs: 6, sm: 3 }}><StatCard icon={<Whatshot />}     label="Shorts Count"      value={analytics.shortsCount}              gradient="red"    small /></Grid>
                        <Grid size={{ xs: 6, sm: 3 }}><StatCard icon={<VideoLibrary />} label="Regular Videos"    value={analytics.regularCount}             gradient="blue"   small /></Grid>
                        <Grid size={{ xs: 6, sm: 3 }}><StatCard icon={<Visibility />}   label="Avg Short Views"   value={fmtNum(analytics.avgShortViews)}    gradient="orange" small /></Grid>
                        <Grid size={{ xs: 6, sm: 3 }}><StatCard icon={<Visibility />}   label="Avg Regular Views" value={fmtNum(analytics.avgRegularViews)}  gradient="green"  small /></Grid>
                    </Grid>
                    <Grid container spacing={2.5}>
                        <Grid size={{ xs: 12, md: 5 }}>
                            <ChartCard title="Content Split">
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie data={[{ name: 'Shorts', value: analytics.shortsCount, color: C.red }, { name: 'Regular', value: analytics.regularCount, color: C.blue }].filter(d => d.value > 0)}
                                            dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={50} paddingAngle={4} strokeWidth={0}>
                                            {[{ color: C.red }, { color: C.blue }].map((d, i) => <Cell key={i} fill={d.color} />)}
                                        </Pie>
                                        <ReTooltip contentStyle={tooltipStyle} />
                                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        </Grid>
                        <Grid size={{ xs: 12, md: 7 }}>
                            <ChartCard title="Performance Comparison">
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={[
                                        { metric: 'Avg Views', Shorts: analytics.avgShortViews,  Regular: analytics.avgRegularViews  },
                                        { metric: 'Avg Likes', Shorts: analytics.avgShortLikes,  Regular: analytics.avgRegularLikes  },
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={GREY[200]} vertical={false} />
                                        <XAxis dataKey="metric" tick={{ fill: GREY[500], fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: GREY[500], fontSize: 12 }} tickFormatter={fmtNum} axisLine={false} tickLine={false} />
                                        <ReTooltip contentStyle={tooltipStyle} formatter={v => fmtNumFull(v)} />
                                        <Bar dataKey="Shorts"  fill={C.red}  radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Regular" fill={C.blue} radius={[4, 4, 0, 0]} />
                                        <Legend />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        </Grid>
                    </Grid>
                </Box>
            )}

            {/* TAB 7: Tags & SEO */}
            {tabValue === 7 && (
                <Box>
                    <Grid container spacing={2} sx={{ mb: 2.5 }}>
                        <Grid size={{ xs: 6, sm: 3 }}><StatCard icon={<Tag />}           label="Unique Tags"    value={analytics.tagFrequency?.length || 0}        gradient="blue"   small /></Grid>
                        <Grid size={{ xs: 6, sm: 3 }}><StatCard icon={<ClosedCaption />} label="Caption Rate"   value={fmtPercent(analytics.captionPercentage)}    gradient="green"  small /></Grid>
                        <Grid size={{ xs: 6, sm: 3 }}><StatCard icon={<HighQuality />}   label="HD Rate"        value={fmtPercent(analytics.hdPercentage)}         gradient="purple" small /></Grid>
                        <Grid size={{ xs: 6, sm: 3 }}><StatCard icon={<VideoLibrary />}  label="Embeddable Rate" value={fmtPercent(analytics.embeddablePercentage)} gradient="orange" small /></Grid>
                    </Grid>
                    <MainCard title="Most Used Tags" sx={{ mb: 2.5 }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {(analytics.tagFrequency || []).map(({ tag, count }, i) => (
                                <Chip key={i} label={`${tag} (${count})`} size="small" variant="outlined"
                                    sx={{ fontWeight: i < 5 ? 600 : 400, fontSize: Math.max(11, 14 - i * 0.1), borderColor: i < 5 ? PRIMARY.main : GREY[300], color: i < 5 ? PRIMARY.main : 'text.secondary' }} />
                            ))}
                            {(!analytics.tagFrequency || analytics.tagFrequency.length === 0) && (
                                <Typography variant="body2" color="text.secondary">No tags data available</Typography>
                            )}
                        </Box>
                    </MainCard>
                    {(analytics.tagFrequency || []).length > 0 && (
                        <ChartCard title="Tag Usage Frequency (Top 20)">
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={(analytics.tagFrequency || []).slice(0, 20)} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke={GREY[200]} horizontal={false} />
                                    <XAxis type="number" tick={{ fill: GREY[500], fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis dataKey="tag" type="category" tick={{ fill: GREY[500], fontSize: 11 }} width={140} axisLine={false} tickLine={false} />
                                    <ReTooltip contentStyle={tooltipStyle} />
                                    <Bar dataKey="count" fill={C.red} radius={[0, 4, 4, 0]} name="Usage Count" />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    )}
                </Box>
            )}
        </Box>
    );
}
