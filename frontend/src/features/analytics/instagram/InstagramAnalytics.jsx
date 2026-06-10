import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Grid, Button, Avatar, Chip,
    CircularProgress, LinearProgress, IconButton, Tooltip, Divider,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
    Instagram, ArrowBack, Refresh, Favorite, ChatBubble, People,
    PersonAdd, Photo, OpenInNew,
    TrendingUp, CalendarMonth, Schedule, Speed, Star,
    Tag, Whatshot, WorkspacePremium, QueryStats,
} from '@mui/icons-material';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend,
    AreaChart, Area,
} from 'recharts';
import StatCard from '../../../components/ui/StatCard';
import MainCard from '../../../components/MainCard';
import { useAppContext } from '../../../context/AppContext';
import { useParams, useNavigate } from 'react-router-dom';
import { fmtNum, fmtNumFull, fmtDate, timeAgo } from '../../../utils/formatters';
import { api } from '../../../services/api';
import { PRIMARY, GREY } from '../../../themes/index';

const IG_COLORS = ['#F58529', '#DD2A7B', '#8134AF', '#515BD4', '#FEDA77', '#405DE6'];
const MEDIA_TYPE_NAMES  = { IMAGE: 'Photos', VIDEO: 'Videos', CAROUSEL_ALBUM: 'Carousels', REEL: 'Reels' };
const MEDIA_TYPE_COLORS = { IMAGE: '#F58529', VIDEO: '#DD2A7B', CAROUSEL_ALBUM: '#8134AF', REEL: '#515BD4' };

const tooltipStyle = {
    backgroundColor: '#fff',
    border: `1px solid ${GREY.A800}`,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    color: GREY[700],
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
};

function ChartCard({ title, children, height = 300 }) {
    return (
        <MainCard title={title} contentSX={{ p: 2 }}>
            <ResponsiveContainer width="100%" height={height}>
                {children}
            </ResponsiveContainer>
        </MainCard>
    );
}

export default function InstagramAnalytics() {
    const { id } = useParams();
    const { accounts, showToast } = useAppContext();
    const navigate = useNavigate();
    const account = accounts.find(a => a.id === id);

    const [loading,    setLoading]    = useState(true);
    const [profile,    setProfile]    = useState(null);
    const [analytics,  setAnalytics]  = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const loadAnalytics = async () => {
        if (!account) return;
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

    useEffect(() => { loadAnalytics(); }, [id]);

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

    if (!account) {
        return (
            <Box>
                <Button startIcon={<ArrowBack />} onClick={() => navigate('/')} sx={{ mb: 2 }}>Back</Button>
                <Typography color="text.secondary">Account not found.</Typography>
            </Box>
        );
    }

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    const p = profile || account;
    const a = analytics || {};

    const mediaTypeData = a.mediaTypeDistribution
        ? Object.entries(a.mediaTypeDistribution).map(([key, value], i) => ({
            name:  MEDIA_TYPE_NAMES[key] || key,
            value,
            color: MEDIA_TYPE_COLORS[key] || IG_COLORS[i % IG_COLORS.length],
        }))
        : [];

    const topPostsData = (a.topPosts || []).slice(0, 8).map((post, i) => ({
        name:     `#${i + 1}`,
        likes:    post.likeCount,
        comments: post.commentsCount,
    }));

    const perfByTypeData = a.performanceByType
        ? Object.entries(a.performanceByType).map(([type, s]) => ({
            name:        MEDIA_TYPE_NAMES[type] || type,
            avgLikes:    s.avgLikes,
            avgComments: s.avgComments,
            count:       s.count,
            color:       MEDIA_TYPE_COLORS[type] || '#999',
        }))
        : [];

    const dayOfWeekData = (a.postsByDayOfWeek || []).map(d => ({
        name:          d.shortDay,
        posts:         d.posts,
        avgEngagement: d.avgEngagement,
        avgLikes:      d.avgLikes,
    }));

    const timelineData = (a.engagementTimeline || []).map(m => ({
        name:     m.month,
        posts:    m.posts,
        likes:    m.likes,
        comments: m.comments,
        avgLikes: m.avgLikes,
    }));

    const captionData = a.captionLengthCorrelation || [];

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Button variant="outlined" onClick={() => navigate('/')} sx={{ minWidth: 40, p: 1 }}>
                        <ArrowBack />
                    </Button>
                    <Avatar src={p.profilePictureUrl} sx={{ width: 56, height: 56 }}>
                        <Instagram />
                    </Avatar>
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="h4">{p.name || p.username}</Typography>
                            <Instagram sx={{ color: '#DD2A7B' }} />
                        </Box>
                        <Typography variant="body2" color="text.secondary">@{p.username}</Typography>
                        {p.biography && (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', maxWidth: 500 }}>
                                {p.biography}
                            </Typography>
                        )}
                    </Box>
                </Box>
                <Button variant="contained" startIcon={refreshing ? <CircularProgress size={16} color="inherit" /> : <Refresh />}
                    onClick={handleRefresh} disabled={refreshing}>
                    Refresh
                </Button>
            </Box>

            {refreshing && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

            {/* ROW 1: Key Stats */}
            <Grid container spacing={2} sx={{ mb: 2.5 }}>
                {[
                    { icon: <People />,    label: 'Followers',       value: fmtNum(p.followersCount),           subtitle: fmtNumFull(p.followersCount), gradient: 'purple' },
                    { icon: <PersonAdd />, label: 'Following',       value: fmtNum(p.followsCount),             subtitle: fmtNumFull(p.followsCount),    gradient: 'blue' },
                    { icon: <Photo />,     label: 'Total Posts',     value: fmtNum(a.totalPosts || p.mediaCount), subtitle: `${a.fetchedPosts || 0} analyzed`, gradient: 'orange' },
                    { icon: <Favorite />,  label: 'Total Likes',     value: fmtNum(a.totalLikes),               subtitle: fmtNumFull(a.totalLikes),      gradient: 'red' },
                    { icon: <ChatBubble />,label: 'Total Comments',  value: fmtNum(a.totalComments),            subtitle: fmtNumFull(a.totalComments),   gradient: 'teal' },
                    { icon: <TrendingUp />,label: 'Engagement Rate', value: `${a.engagementRate || 0}%`,        subtitle: `Avg ${fmtNum(a.avgLikes)} likes/post`, gradient: 'green' },
                ].map((c, i) => (
                    <Grid key={i} size={{ xs: 12, sm: 6, md: 2 }}><StatCard {...c} small /></Grid>
                ))}
            </Grid>

            {/* ROW 2: Averages & Ratios */}
            <Grid container spacing={2} sx={{ mb: 2.5 }}>
                {[
                    { icon: <Speed />,      label: 'Avg Likes/Post', value: fmtNum(a.avgLikes),             gradient: 'cyan' },
                    { icon: <ChatBubble />, label: 'Avg Comments',   value: fmtNum(a.avgComments),          gradient: 'indigo' },
                    { icon: <QueryStats />, label: 'Median Likes',   value: fmtNum(a.medianLikes),          gradient: 'amber' },
                    { icon: <People />,     label: 'Follower Ratio', value: p.followersCount > 0 ? (p.followersCount / Math.max(1, p.followsCount)).toFixed(1) : '0', subtitle: 'Followers / Following', gradient: 'pink' },
                    { icon: <Favorite />,   label: 'Likes/Follower', value: `${a.likesPerFollower || 0}%`,  subtitle: 'Per post avg', gradient: 'red' },
                    { icon: <TrendingUp />, label: 'Like:Comment',   value: `${a.likesToCommentsRatio || 0}:1`, subtitle: 'Ratio', gradient: 'blue' },
                ].map((c, i) => (
                    <Grid key={i} size={{ xs: 12, sm: 6, md: 2 }}><StatCard {...c} small /></Grid>
                ))}
            </Grid>

            {/* ROW 3: Activity */}
            <Grid container spacing={2} sx={{ mb: 2.5 }}>
                {[
                    { icon: <Schedule />,       label: 'Posts/Week',   value: a.postFrequency?.perWeek || 0,  subtitle: `${a.postFrequency?.perMonth || 0}/month`, gradient: 'orange' },
                    { icon: <CalendarMonth />,  label: 'Last 7 Days',  value: a.postsLast7Days || 0,          subtitle: 'Recent posts', gradient: 'red' },
                    { icon: <CalendarMonth />,  label: 'Last 30 Days', value: a.postsLast30Days || 0,         subtitle: 'Monthly', gradient: 'green' },
                    { icon: <CalendarMonth />,  label: 'Last 90 Days', value: a.postsLast90Days || 0,         subtitle: 'Quarterly', gradient: 'blue' },
                    { icon: <Whatshot />,        label: 'Virality Score', value: `${a.viralityScore || 0}x`, subtitle: 'Best vs Average', gradient: 'pink' },
                    { icon: <WorkspacePremium />,label: 'Consistency', value: `${a.consistencyScore || 0}/100`, subtitle: 'Engagement stability', gradient: 'amber' },
                ].map((c, i) => (
                    <Grid key={i} size={{ xs: 12, sm: 6, md: 2 }}><StatCard {...c} small /></Grid>
                ))}
            </Grid>

            {/* Insights chips */}
            <MainCard sx={{ mb: 2.5 }}>
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                    {a.bestPostingDay && (
                        <Chip icon={<Star sx={{ color: '#F59E0B !important', fontSize: '16px !important' }} />}
                            label={`Best Day: ${a.bestPostingDay}`}
                            sx={{ fontSize: 12, fontWeight: 700, height: 30, bgcolor: 'rgba(245,158,11,0.08)', color: '#D97706', border: '1px solid rgba(245,158,11,0.2)' }} />
                    )}
                    {a.bestPostingHour && (
                        <Chip icon={<Schedule sx={{ color: '#22C55E !important', fontSize: '16px !important' }} />}
                            label={`Best Hour: ${a.bestPostingHour}`}
                            sx={{ fontSize: 12, fontWeight: 700, height: 30, bgcolor: 'rgba(34,197,94,0.08)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.2)' }} />
                    )}
                    <Chip icon={<TrendingUp sx={{ color: `${PRIMARY.main} !important`, fontSize: '16px !important' }} />}
                        label={`Avg Engagement: ${fmtNum(a.avgEngagement || 0)}/post`}
                        sx={{ fontSize: 12, fontWeight: 700, height: 30, bgcolor: PRIMARY.lighter, color: PRIMARY.dark, border: `1px solid ${PRIMARY.light}` }} />
                    <Chip icon={<WorkspacePremium sx={{ color: '#7C3AED !important', fontSize: '16px !important' }} />}
                        label={`Consistency: ${a.consistencyScore || 0}/100`}
                        sx={{ fontSize: 12, fontWeight: 700, height: 30, bgcolor: 'rgba(124,58,237,0.08)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.2)' }} />
                </Box>
            </MainCard>

            {/* Charts Row 1: Timeline + Content Mix */}
            <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, md: 8 }}>
                    <MainCard title="Engagement Timeline" contentSX={{ p: 2 }}>
                        {timelineData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={timelineData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={GREY[200]} vertical={false} />
                                    <XAxis dataKey="name" tick={{ fill: GREY[500], fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: GREY[500], fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                                    <ReTooltip contentStyle={tooltipStyle} />
                                    <Area type="monotone" dataKey="likes"    name="Likes"    stroke="#DD2A7B" fill="rgba(221,42,123,0.1)" />
                                    <Area type="monotone" dataKey="comments" name="Comments" stroke="#8134AF" fill="rgba(129,52,175,0.1)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                                Not enough data for timeline
                            </Typography>
                        )}
                    </MainCard>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <MainCard title="Content Type Mix" contentSX={{ p: 2 }}>
                        {mediaTypeData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie data={mediaTypeData} dataKey="value" nameKey="name"
                                        cx="50%" cy="44%" outerRadius={70} innerRadius={35}
                                        paddingAngle={3} strokeWidth={0}>
                                        {mediaTypeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                    </Pie>
                                    <ReTooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v} posts`, n]} />
                                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: GREY[600], paddingTop: 8 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No data</Typography>
                        )}
                    </MainCard>
                </Grid>
            </Grid>

            {/* Charts Row 2: Performance by Type + Day of Week */}
            <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MainCard title="Performance by Content Type" contentSX={{ p: 2 }}>
                        {perfByTypeData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={perfByTypeData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={GREY[200]} vertical={false} />
                                    <XAxis dataKey="name" tick={{ fill: GREY[500], fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: GREY[500], fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
                                    <ReTooltip contentStyle={tooltipStyle} />
                                    <Bar dataKey="avgLikes"    name="Avg Likes"    fill="#DD2A7B" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="avgComments" name="Avg Comments" fill="#8134AF" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No data</Typography>
                        )}
                    </MainCard>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MainCard title="Best Posting Days" contentSX={{ p: 2 }}>
                        {dayOfWeekData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={dayOfWeekData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={GREY[200]} vertical={false} />
                                    <XAxis dataKey="name" tick={{ fill: GREY[500], fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: GREY[500], fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
                                    <ReTooltip contentStyle={tooltipStyle} />
                                    <Bar dataKey="avgEngagement" name="Avg Engagement" fill="#F58529" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="posts"         name="Posts"          fill={GREY[200]}  radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No data</Typography>
                        )}
                    </MainCard>
                </Grid>
            </Grid>

            {/* Charts Row 3: Top Posts + Caption Length */}
            <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MainCard title="Top Posts by Engagement" contentSX={{ p: 2 }}>
                        {topPostsData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={topPostsData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={GREY[200]} vertical={false} />
                                    <XAxis dataKey="name" tick={{ fill: GREY[500], fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: GREY[500], fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
                                    <ReTooltip contentStyle={tooltipStyle} />
                                    <Bar dataKey="likes"    name="Likes"    fill="#DD2A7B" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="comments" name="Comments" fill="#8134AF" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No data</Typography>
                        )}
                    </MainCard>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MainCard title="Caption Length vs Engagement" contentSX={{ p: 2 }}>
                        {captionData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={captionData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={GREY[200]} vertical={false} />
                                    <XAxis dataKey="label" tick={{ fill: GREY[500], fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: GREY[500], fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
                                    <ReTooltip contentStyle={tooltipStyle} />
                                    <Bar dataKey="avgEngagement" name="Avg Engagement" fill="#515BD4" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No data</Typography>
                        )}
                    </MainCard>
                </Grid>
            </Grid>

            {/* Monthly Posting Volume */}
            {timelineData.length > 1 && (
                <MainCard title="Monthly Posting Volume" contentSX={{ p: 2 }} sx={{ mb: 2.5 }}>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={timelineData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={GREY[200]} vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: GREY[500], fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: GREY[500], fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
                            <ReTooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="posts" name="Posts" fill="#F58529" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </MainCard>
            )}

            {/* Top Hashtags */}
            {(a.hashtagAnalysis || []).length > 0 && (
                <MainCard title="Top Hashtags" sx={{ mb: 2.5 }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {a.hashtagAnalysis.slice(0, 20).map((h, i) => (
                            <Tooltip key={h.tag} title={`Used ${h.count}x · Avg engagement: ${fmtNum(h.avgEngagement)}`}>
                                <Chip label={`${h.tag} (${h.count})`}
                                    sx={{
                                        fontSize: 12, fontWeight: 500,
                                        bgcolor: `${IG_COLORS[i % IG_COLORS.length]}15`,
                                        borderColor: IG_COLORS[i % IG_COLORS.length],
                                        color: IG_COLORS[i % IG_COLORS.length],
                                    }}
                                    variant="outlined" />
                            </Tooltip>
                        ))}
                    </Box>
                </MainCard>
            )}

            {/* Recent Posts Grid */}
            <MainCard title={`Recent Posts (${a.fetchedPosts || 0} loaded)`} sx={{ mb: 2.5 }}>
                {(a.recentMedia || []).length > 0 ? (
                    <Grid container spacing={2}>
                        {a.recentMedia.map((post) => (
                            <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={post.id}>
                                <Box
                                    sx={{
                                        position: 'relative', overflow: 'hidden', borderRadius: 1.5,
                                        cursor: 'pointer', border: `1px solid ${GREY.A800}`,
                                        '&:hover .overlay': { opacity: 1 },
                                        '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
                                    }}
                                    onClick={() => post.permalink && window.open(post.permalink, '_blank')}
                                >
                                    <Box sx={{ width: '100%', paddingTop: '100%', position: 'relative', bgcolor: GREY[100] }}>
                                        <Box component="img" src={post.thumbnailUrl || post.mediaUrl}
                                            sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={e => { e.target.style.display = 'none'; }}
                                        />
                                        {post.mediaType !== 'IMAGE' && (
                                            <Chip label={MEDIA_TYPE_NAMES[post.mediaType] || post.mediaType} size="small"
                                                sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 10, height: 20 }} />
                                        )}
                                    </Box>
                                    <Box className="overlay" sx={{
                                        position: 'absolute', bottom: 0, left: 0, right: 0,
                                        background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                                        p: 1, opacity: 0, transition: 'opacity 0.2s',
                                        display: 'flex', justifyContent: 'center', gap: 2,
                                    }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#fff' }}>
                                            <Favorite sx={{ fontSize: 13 }} />
                                            <Typography variant="caption" sx={{ fontWeight: 600 }}>{fmtNum(post.likeCount)}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#fff' }}>
                                            <ChatBubble sx={{ fontSize: 13 }} />
                                            <Typography variant="caption" sx={{ fontWeight: 600 }}>{fmtNum(post.commentsCount)}</Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>
                ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No posts found</Typography>
                )}
            </MainCard>

            {/* Top Posts Table */}
            {(a.topPosts || []).length > 0 && (
                <MainCard title="Top Performing Posts" content={false} sx={{ mb: 2.5 }}>
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
                                    <TableCell />
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
                                                sx={{ fontSize: 10, height: 20, bgcolor: `${MEDIA_TYPE_COLORS[post.mediaType] || GREY[400]}22`, color: MEDIA_TYPE_COLORS[post.mediaType] || GREY[600] }} />
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
                </MainCard>
            )}

            {/* Performance by Type Table */}
            {perfByTypeData.length > 0 && (
                <MainCard title="Performance Summary by Content Type" content={false} sx={{ mb: 2.5 }}>
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
                                                sx={{ fontSize: 11, height: 22, bgcolor: `${row.color}22`, color: row.color }} />
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
                </MainCard>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 3 }}>
                Last updated: {timeAgo(account.lastUpdated)}
            </Typography>
        </Box>
    );
}
