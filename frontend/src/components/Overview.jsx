import React from 'react';
import {
    Box, Typography, Grid, Card, CardContent, Button, Avatar, Chip,
    LinearProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    IconButton, Tooltip, Paper, Divider,
} from '@mui/material';
import {
    Visibility, People, VideoLibrary, YouTube, Refresh, TrendingUp,
    EmojiEvents, OpenInNew, Speed, BarChart, Instagram, Favorite, Photo,
} from '@mui/icons-material';
import {
    BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import StatCard from './StatCard';
import { fmtNum, fmtNumFull, fmtDate, timeAgo } from '../utils/formatters';

const COLORS = ['#FF0000', '#3EA6FF', '#4CAF50', '#FF9800', '#AB47BC', '#26A69A', '#EC407A', '#5C6BC0'];

export default function Overview({ accounts, onViewChannel, onRefreshAll, loading }) {
    const ytAccounts = accounts.filter(a => a.platform !== 'instagram');
    const igAccounts = accounts.filter(a => a.platform === 'instagram');

    const totals = accounts.reduce((acc, a) => {
        if (a.platform === 'instagram') {
            return {
                ...acc,
                followers: acc.followers + (a.followersCount || 0),
                posts: acc.posts + (a.mediaCount || 0),
            };
        }
        return {
            ...acc,
            subscribers: acc.subscribers + (a.subscriberCount || 0),
            views: acc.views + (a.viewCount || 0),
            videos: acc.videos + (a.videoCount || 0),
        };
    }, { subscribers: 0, views: 0, videos: 0, followers: 0, posts: 0 });

    const totalAudience = totals.subscribers + totals.followers;

    const sorted = {
        byAudience: [...accounts].sort((a, b) => (b.subscriberCount || b.followersCount || 0) - (a.subscriberCount || a.followersCount || 0)),
        byContent: [...accounts].sort((a, b) => (b.viewCount || b.mediaCount || 0) - (a.viewCount || a.mediaCount || 0)),
    };

    const chartData = accounts.map(a => ({
        name: a.title?.length > 20 ? a.title.substring(0, 20) + '...' : a.title,
        audience: a.subscriberCount || a.followersCount || 0,
        platform: a.platform || 'youtube',
    }));

    const pieData = accounts.map((a, i) => ({
        name: a.title?.length > 15 ? a.title.substring(0, 15) + '...' : a.title,
        value: a.subscriberCount || a.followersCount || 0,
        color: COLORS[i % COLORS.length],
    }));

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>Dashboard Overview</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Combined analytics across {accounts.length} account{accounts.length !== 1 ? 's' : ''}
                        {ytAccounts.length > 0 && igAccounts.length > 0 && ` (${ytAccounts.length} YouTube, ${igAccounts.length} Instagram)`}
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<Refresh />} onClick={onRefreshAll}
                    disabled={loading || accounts.length === 0}
                    sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                    {loading ? 'Refreshing...' : 'Refresh All'}
                </Button>
            </Box>

            {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} color="error" />}

            {/* KPI Cards */}
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard icon={<People />} label="Total Audience" value={fmtNum(totalAudience)}
                        subtitle={`${fmtNum(totals.subscribers)} subs + ${fmtNum(totals.followers)} followers`} gradient="green" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard icon={<Visibility />} label="Total YT Views" value={fmtNum(totals.views)}
                        subtitle={fmtNumFull(totals.views)} gradient="red" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard icon={<VideoLibrary />} label="Total Content" value={fmtNum(totals.videos + totals.posts)}
                        subtitle={`${fmtNum(totals.videos)} videos + ${fmtNum(totals.posts)} posts`} gradient="orange" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard icon={<BarChart />} label="Accounts" value={accounts.length}
                        subtitle={`${ytAccounts.length} YT · ${igAccounts.length} IG`} gradient="purple" />
                </Grid>
            </Grid>

            {accounts.length === 0 ? (
                <Card sx={{ p: 6, textAlign: 'center' }}>
                    <People sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h5" sx={{ mb: 1 }}>Welcome to Social Media Analytics</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                        Add your first YouTube channel or Instagram account to start tracking analytics
                    </Typography>
                </Card>
            ) : (
                <>
                    {/* Charts Row */}
                    <Grid container spacing={2.5} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 12, md: 8 }}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                                        <BarChart sx={{ verticalAlign: 'middle', mr: 1, color: 'primary.main' }} />
                                        Audience Comparison
                                    </Typography>
                                    <ResponsiveContainer width="100%" height={320}>
                                        <ReBarChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="name" tick={{ fill: '#aaa', fontSize: 12 }} />
                                            <YAxis tick={{ fill: '#aaa', fontSize: 12 }} tickFormatter={fmtNum} />
                                            <ReTooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                                                formatter={(v) => fmtNumFull(v)} />
                                            <Bar dataKey="audience" fill="#667eea" radius={[6, 6, 0, 0]} name="Audience" />
                                        </ReBarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Card sx={{ height: '100%' }}>
                                <CardContent>
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Audience Share</Typography>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <PieChart>
                                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                                                outerRadius={90} innerRadius={50} paddingAngle={3}>
                                                {pieData.map((entry, i) => (
                                                    <Cell key={i} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <ReTooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                                                formatter={(v) => fmtNumFull(v)} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* Account Rankings */}
                    <Grid container spacing={2.5} sx={{ mb: 3 }}>
                        {/* Top by Audience */}
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <EmojiEvents sx={{ color: '#FFD700' }} /> Top by Audience
                                    </Typography>
                                    {sorted.byAudience.map((a, i) => {
                                        const isIG = a.platform === 'instagram';
                                        return (
                                            <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' }, borderRadius: 1, px: 1 }}
                                                onClick={() => onViewChannel(a)}>
                                                <Typography sx={{ width: 24, fontWeight: 700, color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'text.secondary', fontSize: 16 }}>
                                                    {i + 1}
                                                </Typography>
                                                <Avatar src={a.thumbnail || a.profilePictureUrl || a.thumbnails?.default} sx={{ width: 32, height: 32 }} />
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>{a.title}</Typography>
                                                </Box>
                                                {isIG ? <Instagram sx={{ fontSize: 16, color: '#E1306C' }} /> : <YouTube sx={{ fontSize: 16, color: '#FF0000' }} />}
                                                <Chip label={fmtNum(isIG ? a.followersCount : a.subscriberCount)} size="small"
                                                    sx={{ bgcolor: isIG ? 'rgba(225,48,108,0.15)' : 'rgba(76,175,80,0.15)', color: isIG ? '#E1306C' : '#4CAF50', fontWeight: 600 }} />
                                            </Box>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Top by Content */}
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <TrendingUp sx={{ color: '#FF9800' }} /> Top by Content
                                    </Typography>
                                    {sorted.byContent.map((a, i) => {
                                        const isIG = a.platform === 'instagram';
                                        return (
                                            <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' }, borderRadius: 1, px: 1 }}
                                                onClick={() => onViewChannel(a)}>
                                                <Typography sx={{ width: 24, fontWeight: 700, color: i === 0 ? '#FFD700' : 'text.secondary', fontSize: 16 }}>
                                                    {i + 1}
                                                </Typography>
                                                <Avatar src={a.thumbnail || a.profilePictureUrl || a.thumbnails?.default} sx={{ width: 32, height: 32 }} />
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>{a.title}</Typography>
                                                </Box>
                                                {isIG ? <Instagram sx={{ fontSize: 16, color: '#E1306C' }} /> : <YouTube sx={{ fontSize: 16, color: '#FF0000' }} />}
                                                <Chip label={isIG ? `${fmtNum(a.mediaCount)} posts` : `${fmtNum(a.viewCount)} views`} size="small"
                                                    sx={{ bgcolor: isIG ? 'rgba(138,58,185,0.15)' : 'rgba(255,0,0,0.15)', color: isIG ? '#8134AF' : '#FF4444', fontWeight: 600 }} />
                                            </Box>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* All Accounts Table */}
                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>All Accounts</Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>#</TableCell>
                                            <TableCell>Account</TableCell>
                                            <TableCell align="center">Platform</TableCell>
                                            <TableCell align="right">Audience</TableCell>
                                            <TableCell align="right">Content</TableCell>
                                            <TableCell align="right">Last Updated</TableCell>
                                            <TableCell align="center">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {sorted.byAudience.map((a, i) => {
                                            const isIG = a.platform === 'instagram';
                                            return (
                                                <TableRow key={a.id} hover sx={{ cursor: 'pointer' }} onClick={() => onViewChannel(a)}>
                                                    <TableCell>{i + 1}</TableCell>
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                            <Avatar src={a.thumbnail || a.profilePictureUrl || a.thumbnails?.default} sx={{ width: 32, height: 32 }} />
                                                            <Box>
                                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.title}</Typography>
                                                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                                    {isIG ? `@${a.username || a.igUsername}` : (a.customUrl || a.channelId)}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        {isIG ? <Instagram sx={{ color: '#E1306C', fontSize: 20 }} /> : <YouTube sx={{ color: '#FF0000', fontSize: 20 }} />}
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                                                        {fmtNum(isIG ? a.followersCount : a.subscriberCount)}
                                                        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                                                            {isIG ? 'followers' : 'subscribers'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {isIG ? `${fmtNum(a.mediaCount)} posts` : `${fmtNum(a.viewCount)} views / ${fmtNum(a.videoCount)} videos`}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{timeAgo(a.lastUpdated)}</Typography>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Tooltip title="View Analytics">
                                                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onViewChannel(a); }}>
                                                                <OpenInNew fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </>
            )}
        </Box>
    );
}
