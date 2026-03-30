import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Grid, Card, CardContent, Button, Avatar, Chip,
    CircularProgress, LinearProgress, IconButton, Tooltip, Divider,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
    Instagram, ArrowBack, Refresh, Favorite, ChatBubble, People,
    PersonAdd, Photo, Collections, Movie, Link as LinkIcon, OpenInNew,
    TrendingUp, CalendarMonth, Schedule, Speed, Star, ThumbDown,
    Tag, Notes, BarChart as BarChartIcon, Whatshot, WorkspacePremium,
    QueryStats,
} from '@mui/icons-material';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line,
    AreaChart, Area,
} from 'recharts';
import StatCard from '../../../components/ui/StatCard';
import { fmtNum, fmtNumFull, fmtDate, timeAgo } from '../../../utils/formatters';
import { api } from '../../../services/api';

const IG_GRADIENT = 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF, #515BD4)';
const IG_COLORS = ['#F58529', '#DD2A7B', '#8134AF', '#515BD4', '#FEDA77', '#405DE6'];
const MEDIA_TYPE_NAMES = { IMAGE: 'Photos', VIDEO: 'Videos', CAROUSEL_ALBUM: 'Carousels', REEL: 'Reels' };
const MEDIA_TYPE_COLORS = { IMAGE: '#F58529', VIDEO: '#DD2A7B', CAROUSEL_ALBUM: '#8134AF', REEL: '#515BD4' };

const chartTooltipStyle = { background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 };

export default function InstagramAnalytics({ account, showToast, onBack }) {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const data = await api.getIGAnalytics(account.id);
            setProfile(data.profile);
            setAnalytics(data.analytics);
        } catch (err) {
            showToast('Failed to load Instagram analytics: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadAnalytics(); }, [account.id]);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await api.refreshAccount(account.id);
            await loadAnalytics();
            showToast('Instagram account refreshed!');
        } catch (err) {
            showToast('Refresh failed: ' + err.message, 'error');
        } finally {
            setRefreshing(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <CircularProgress sx={{ color: '#DD2A7B' }} />
            </Box>
        );
    }

    const p = profile || account;
    const a = analytics || {};

    const mediaTypeData = a.mediaTypeDistribution
        ? Object.entries(a.mediaTypeDistribution).map(([key, value], i) => ({
            name: MEDIA_TYPE_NAMES[key] || key,
            value,
            color: MEDIA_TYPE_COLORS[key] || IG_COLORS[i % IG_COLORS.length],
        }))
        : [];

    const topPostsData = (a.topPosts || []).slice(0, 8).map((post, i) => ({
        name: `#${i + 1}`,
        likes: post.likeCount,
        comments: post.commentsCount,
        total: post.likeCount + post.commentsCount,
    }));

    const perfByTypeData = a.performanceByType
        ? Object.entries(a.performanceByType).map(([type, s]) => ({
            name: MEDIA_TYPE_NAMES[type] || type,
            avgLikes: s.avgLikes,
            avgComments: s.avgComments,
            count: s.count,
            color: MEDIA_TYPE_COLORS[type] || '#999',
        }))
        : [];

    const dayOfWeekData = (a.postsByDayOfWeek || []).map(d => ({
        name: d.shortDay, posts: d.posts,
        avgEngagement: d.avgEngagement,
        avgLikes: d.avgLikes,
    }));

    const timelineData = (a.engagementTimeline || []).map(m => ({
        name: m.month, posts: m.posts,
        likes: m.likes, comments: m.comments,
        avgLikes: m.avgLikes, engagement: m.engagement,
    }));

    const captionData = a.captionLengthCorrelation || [];

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Button variant="outlined" onClick={onBack}
                        sx={{ borderColor: 'rgba(255,255,255,0.15)', minWidth: 40, p: 1 }}>
                        <ArrowBack />
                    </Button>
                    <Avatar src={p.profilePictureUrl} sx={{ width: 56, height: 56, border: '3px solid #DD2A7B' }}>
                        <Instagram />
                    </Avatar>
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="h4" sx={{ fontWeight: 700 }}>{p.name || p.username}</Typography>
                            <Instagram sx={{ color: '#DD2A7B' }} />
                        </Box>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            @{p.username}
                            {p.website && (
                                <Chip icon={<LinkIcon sx={{ fontSize: 14 }} />} label={p.website}
                                    size="small" clickable component="a" href={p.website} target="_blank"
                                    sx={{ ml: 1, fontSize: 11, height: 22 }} />
                            )}
                        </Typography>
                        {p.biography && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block', maxWidth: 500 }}>
                                {p.biography}
                            </Typography>
                        )}
                    </Box>
                </Box>
                <Button variant="contained" startIcon={refreshing ? <CircularProgress size={16} /> : <Refresh />}
                    onClick={handleRefresh} disabled={refreshing}
                    sx={{ background: IG_GRADIENT }}>
                    Refresh
                </Button>
            </Box>

            {refreshing && <LinearProgress sx={{ mb: 2, borderRadius: 1, '& .MuiLinearProgress-bar': { background: IG_GRADIENT } }} />}

            {/* ROW 1: Key Stats */}
            <Grid container spacing={2} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <StatCard icon={<People />} label="Followers" value={fmtNum(p.followersCount)}
                        subtitle={fmtNumFull(p.followersCount)} gradient="purple" small />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <StatCard icon={<PersonAdd />} label="Following" value={fmtNum(p.followsCount)}
                        subtitle={fmtNumFull(p.followsCount)} gradient="blue" small />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <StatCard icon={<Photo />} label="Total Posts" value={fmtNum(a.totalPosts || p.mediaCount)}
                        subtitle={`${a.fetchedPosts || 0} analyzed`} gradient="orange" small />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <StatCard icon={<Favorite />} label="Total Likes" value={fmtNum(a.totalLikes)}
                        subtitle={fmtNumFull(a.totalLikes)} gradient="red" small />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <StatCard icon={<ChatBubble />} label="Total Comments" value={fmtNum(a.totalComments)}
                        subtitle={fmtNumFull(a.totalComments)} gradient="teal" small />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <StatCard icon={<TrendingUp />} label="Engagement Rate" value={`${a.engagementRate || 0}%`}
                        subtitle={`Avg ${fmtNum(a.avgLikes)} likes/post`} gradient="green" small />
                </Grid>
            </Grid>

            {/* ROW 2: Averages & Medians */}
            <Grid container spacing={2} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <StatCard icon={<Speed />} label="Avg Likes/Post" value={fmtNum(a.avgLikes)} gradient="cyan" small />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <StatCard icon={<ChatBubble />} label="Avg Comments" value={fmtNum(a.avgComments)} gradient="indigo" small />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <StatCard icon={<QueryStats />} label="Median Likes" value={fmtNum(a.medianLikes)} gradient="amber" small />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <StatCard icon={<People />} label="Follower Ratio"
                        value={p.followersCount > 0 ? (p.followersCount / Math.max(1, p.followsCount)).toFixed(1) : '0'}
                        subtitle="Followers / Following" gradient="pink" small />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <StatCard icon={<Favorite />} label="Likes/Follower" value={`${a.likesPerFollower || 0}%`}
                        subtitle="Per post avg" gradient="red" small />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <StatCard icon={<TrendingUp />} label="Like:Comment" value={`${a.likesToCommentsRatio || 0}:1`}
                        subtitle="Ratio" gradient="blue" small />
                </Grid>
            </Grid>

            {/* ROW 3: Activity & Scores */}
            <Grid container spacing={2} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <StatCard icon={<Schedule />} label="Posts/Week" value={a.postFrequency?.perWeek || 0}
                        subtitle={`${a.postFrequency?.perMonth || 0}/month`} gradient="orange" small />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <StatCard icon={<CalendarMonth />} label="Last 7 Days" value={a.postsLast7Days || 0}
                        subtitle="Recent posts" gradient="red" small />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <StatCard icon={<CalendarMonth />} label="Last 30 Days" value={a.postsLast30Days || 0}
                        subtitle="Monthly" gradient="green" small />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <StatCard icon={<CalendarMonth />} label="Last 90 Days" value={a.postsLast90Days || 0}
                        subtitle="Quarterly" gradient="blue" small />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <StatCard icon={<Whatshot />} label="Virality Score" value={`${a.viralityScore || 0}x`}
                        subtitle="Best vs Average" gradient="pink" small />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <StatCard icon={<WorkspacePremium />} label="Consistency" value={`${a.consistencyScore || 0}/100`}
                        subtitle="Engagement stability" gradient="amber" small />
                </Grid>
            </Grid>

            {/* Best posting day & hour + Avg Engagement */}
            <Card sx={{ mb: 2.5 }}>
                <CardContent sx={{ py: 1.5, px: 2.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                        {a.bestPostingDay && (
                            <Chip icon={<Star sx={{ color: '#F59E0B !important', fontSize: '16px !important' }} />}
                                label={`Best Day: ${a.bestPostingDay}`}
                                sx={{ fontSize: 12, fontWeight: 700, height: 30, bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }} />
                        )}
                        {a.bestPostingHour && (
                            <Chip icon={<Schedule sx={{ color: '#22C55E !important', fontSize: '16px !important' }} />}
                                label={`Best Hour: ${a.bestPostingHour}`}
                                sx={{ fontSize: 12, fontWeight: 700, height: 30, bgcolor: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)' }} />
                        )}
                        <Chip icon={<TrendingUp sx={{ color: '#3B82F6 !important', fontSize: '16px !important' }} />}
                            label={`Avg Engagement: ${fmtNum(a.avgEngagement || 0)}/post`}
                            sx={{ fontSize: 12, fontWeight: 700, height: 30, bgcolor: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }} />
                        <Chip icon={<WorkspacePremium sx={{ color: '#A78BFA !important', fontSize: '16px !important' }} />}
                            label={`Consistency: ${a.consistencyScore || 0}/100`}
                            sx={{ fontSize: 12, fontWeight: 700, height: 30, bgcolor: 'rgba(167,139,250,0.1)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.2)' }} />
                    </Box>
                </CardContent>
            </Card>

            {/* CHARTS ROW 1: Engagement Timeline + Content Mix */}
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 8 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                                Engagement Timeline
                            </Typography>
                            {timelineData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={timelineData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis dataKey="name" tick={{ fill: '#999', fontSize: 11 }} />
                                        <YAxis tick={{ fill: '#999', fontSize: 11 }} />
                                        <ReTooltip contentStyle={chartTooltipStyle} />
                                        <Area type="monotone" dataKey="likes" name="Likes" stroke="#DD2A7B" fill="rgba(221,42,123,0.2)" />
                                        <Area type="monotone" dataKey="comments" name="Comments" stroke="#8134AF" fill="rgba(129,52,175,0.2)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
                                    Not enough data for timeline
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                                Content Type Mix
                            </Typography>
                            {mediaTypeData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie data={mediaTypeData} dataKey="value" nameKey="name"
                                            cx="50%" cy="50%" outerRadius={70} innerRadius={35}
                                            label={({ cx, cy, midAngle, outerRadius, name, value }) => {
                                                const RADIAN = Math.PI / 180;
                                                const radius = outerRadius + 18;
                                                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                                return (
                                                    <text x={x} y={y} fill="#ccc" fontSize={11} fontWeight={500}
                                                        textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                                                        {`${value}`}
                                                    </text>
                                                );
                                            }}
                                            labelLine={{ strokeWidth: 1, stroke: '#666' }}>
                                            {mediaTypeData.map((entry, i) => (
                                                <Cell key={i} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                        <ReTooltip contentStyle={chartTooltipStyle}
                                            formatter={(value, name) => [`${value} posts`, name]} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
                                    No data
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* CHARTS ROW 2: Performance by Type + Day of Week */}
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                                Performance by Content Type
                            </Typography>
                            {perfByTypeData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={perfByTypeData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis dataKey="name" tick={{ fill: '#999', fontSize: 12 }} />
                                        <YAxis tick={{ fill: '#999', fontSize: 12 }} />
                                        <ReTooltip contentStyle={chartTooltipStyle} />
                                        <Bar dataKey="avgLikes" name="Avg Likes" fill="#DD2A7B" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="avgComments" name="Avg Comments" fill="#8134AF" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
                                    No data
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                                Best Posting Days
                            </Typography>
                            {dayOfWeekData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={dayOfWeekData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis dataKey="name" tick={{ fill: '#999', fontSize: 12 }} />
                                        <YAxis tick={{ fill: '#999', fontSize: 12 }} />
                                        <ReTooltip contentStyle={chartTooltipStyle} />
                                        <Bar dataKey="avgEngagement" name="Avg Engagement" fill="#F58529" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="posts" name="Posts" fill="rgba(255,255,255,0.15)" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
                                    No data
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* CHARTS ROW 3: Top Posts Bar + Caption Length Analysis */}
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                                Top Posts by Engagement
                            </Typography>
                            {topPostsData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={topPostsData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis dataKey="name" tick={{ fill: '#999', fontSize: 12 }} />
                                        <YAxis tick={{ fill: '#999', fontSize: 12 }} />
                                        <ReTooltip contentStyle={chartTooltipStyle} />
                                        <Bar dataKey="likes" name="Likes" fill="#DD2A7B" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="comments" name="Comments" fill="#8134AF" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
                                    No data
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                                Caption Length vs Engagement
                            </Typography>
                            {captionData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={captionData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis dataKey="label" tick={{ fill: '#999', fontSize: 11 }} />
                                        <YAxis tick={{ fill: '#999', fontSize: 12 }} />
                                        <ReTooltip contentStyle={chartTooltipStyle} />
                                        <Bar dataKey="avgEngagement" name="Avg Engagement" fill="#515BD4" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
                                    No data
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Monthly Posting Volume */}
            {timelineData.length > 1 && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                            Monthly Posting Volume
                        </Typography>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={timelineData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis dataKey="name" tick={{ fill: '#999', fontSize: 11 }} />
                                <YAxis tick={{ fill: '#999', fontSize: 12 }} />
                                <ReTooltip contentStyle={chartTooltipStyle} />
                                <Bar dataKey="posts" name="Posts" fill="#F58529" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Top Hashtags */}
            {(a.hashtagAnalysis || []).length > 0 && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                            <Tag sx={{ verticalAlign: 'middle', mr: 1, color: '#DD2A7B' }} />
                            Top Hashtags
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {a.hashtagAnalysis.slice(0, 20).map((h, i) => (
                                <Tooltip key={h.tag} title={`Used ${h.count}x \u2022 Avg engagement: ${fmtNum(h.avgEngagement)}`}>
                                    <Chip label={`${h.tag} (${h.count})`}
                                        sx={{
                                            fontSize: 12, fontWeight: 500,
                                            bgcolor: `${IG_COLORS[i % IG_COLORS.length]}22`,
                                            borderColor: IG_COLORS[i % IG_COLORS.length],
                                            color: IG_COLORS[i % IG_COLORS.length],
                                        }}
                                        variant="outlined" />
                                </Tooltip>
                            ))}
                        </Box>
                    </CardContent>
                </Card>
            )}

            {/* Recent Media Grid */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                        Recent Posts ({a.fetchedPosts || 0} loaded)
                    </Typography>
                    {(a.recentMedia || []).length > 0 ? (
                        <Grid container spacing={2}>
                            {a.recentMedia.map((post) => (
                                <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={post.id}>
                                    <Card sx={{
                                        position: 'relative', overflow: 'hidden', cursor: 'pointer',
                                        '&:hover': { transform: 'translateY(-2px)', transition: 'all 0.2s' },
                                        '&:hover .media-overlay': { opacity: 1 },
                                    }}
                                        onClick={() => post.permalink && window.open(post.permalink, '_blank')}>
                                        <Box sx={{
                                            width: '100%', paddingTop: '100%', position: 'relative',
                                            bgcolor: 'rgba(255,255,255,0.05)',
                                        }}>
                                            <Box component="img"
                                                src={post.thumbnailUrl || post.mediaUrl}
                                                sx={{
                                                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                                                    objectFit: 'cover',
                                                }}
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                            {post.mediaType !== 'IMAGE' && (
                                                <Chip label={MEDIA_TYPE_NAMES[post.mediaType] || post.mediaType}
                                                    size="small"
                                                    sx={{
                                                        position: 'absolute', top: 8, right: 8,
                                                        bgcolor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 10, height: 20,
                                                    }} />
                                            )}
                                        </Box>
                                        <Box className="media-overlay" sx={{
                                            position: 'absolute', bottom: 0, left: 0, right: 0,
                                            background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                                            p: 1, opacity: 0, transition: 'opacity 0.2s',
                                            display: 'flex', justifyContent: 'center', gap: 2,
                                        }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#fff' }}>
                                                <Favorite sx={{ fontSize: 14 }} />
                                                <Typography variant="caption" sx={{ fontWeight: 600 }}>{fmtNum(post.likeCount)}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#fff' }}>
                                                <ChatBubble sx={{ fontSize: 14 }} />
                                                <Typography variant="caption" sx={{ fontWeight: 600 }}>{fmtNum(post.commentsCount)}</Typography>
                                            </Box>
                                        </Box>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    ) : (
                        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
                            No posts found
                        </Typography>
                    )}
                </CardContent>
            </Card>

            {/* Top Posts Table */}
            {(a.topPosts || []).length > 0 && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                            Top Performing Posts
                        </Typography>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Caption</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }} align="right">Likes</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }} align="right">Comments</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }} align="right">Engagement</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                                        <TableCell></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {a.topPosts.slice(0, 10).map((post, i) => (
                                        <TableRow key={post.id} hover>
                                            <TableCell>{i + 1}</TableCell>
                                            <TableCell sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {post.caption || '(no caption)'}
                                            </TableCell>
                                            <TableCell>
                                                <Chip label={MEDIA_TYPE_NAMES[post.mediaType] || post.mediaType} size="small"
                                                    sx={{ fontSize: 10, height: 20, bgcolor: `${MEDIA_TYPE_COLORS[post.mediaType] || '#999'}33`, color: MEDIA_TYPE_COLORS[post.mediaType] || '#999' }} />
                                            </TableCell>
                                            <TableCell align="right">{fmtNum(post.likeCount)}</TableCell>
                                            <TableCell align="right">{fmtNum(post.commentsCount)}</TableCell>
                                            <TableCell align="right">{fmtNum(post.engagement)}</TableCell>
                                            <TableCell>{fmtDate(post.timestamp)}</TableCell>
                                            <TableCell>
                                                {post.permalink && (
                                                    <IconButton size="small" onClick={() => window.open(post.permalink, '_blank')}>
                                                        <OpenInNew fontSize="small" />
                                                    </IconButton>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            )}

            {/* Performance by Type Table */}
            {perfByTypeData.length > 0 && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                            Performance Summary by Content Type
                        </Typography>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }} align="right">Count</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }} align="right">Avg Likes</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }} align="right">Avg Comments</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }} align="right">Avg Engagement</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {perfByTypeData.map(row => (
                                        <TableRow key={row.name} hover>
                                            <TableCell>
                                                <Chip label={row.name} size="small"
                                                    sx={{ fontSize: 11, height: 22, bgcolor: `${row.color}33`, color: row.color }} />
                                            </TableCell>
                                            <TableCell align="right">{row.count}</TableCell>
                                            <TableCell align="right">{fmtNum(row.avgLikes)}</TableCell>
                                            <TableCell align="right">{fmtNum(row.avgComments)}</TableCell>
                                            <TableCell align="right">{fmtNum(row.avgLikes + row.avgComments)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            )}

            {/* Last Updated */}
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textAlign: 'center', mt: 3 }}>
                Last updated: {timeAgo(account.lastUpdated)}
            </Typography>
        </Box>
    );
}
