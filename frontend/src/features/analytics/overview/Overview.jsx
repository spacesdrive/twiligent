import React from 'react';
import {
    Box, Typography, Grid, Card, CardContent, Button, Avatar, Chip,
    LinearProgress, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, IconButton, Tooltip,
} from '@mui/material';
import {
    Visibility, People, VideoLibrary, YouTube, Refresh,
    OpenInNew, BarChart, Instagram,
} from '@mui/icons-material';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import StatCard from '../../../components/ui/StatCard';
import { fmtNum, fmtNumFull, timeAgo } from '../../../utils/formatters';

const COLORS = ['#FF0000', '#3B82F6', '#22C55E', '#F59E0B', '#A78BFA', '#14B8A6', '#EC4899', '#6366F1'];

const sectionLabel = (text) => (
    <Typography sx={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'text.secondary', mb: 2,
    }}>
        {text}
    </Typography>
);

const chartTooltipStyle = {
    backgroundColor: '#0E1420',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
};

export default function Overview({ accounts, onViewChannel, onRefreshAll, loading }) {
    const ytAccounts = accounts.filter(a => a.platform !== 'instagram');
    const igAccounts = accounts.filter(a => a.platform === 'instagram');

    const totals = accounts.reduce((acc, a) => {
        if (a.platform === 'instagram') {
            return { ...acc, followers: acc.followers + (a.followersCount || 0), posts: acc.posts + (a.mediaCount || 0) };
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
        name: (a.title || '').length > 14 ? a.title.substring(0, 14) + '…' : a.title,
        audience: a.subscriberCount || a.followersCount || 0,
        platform: a.platform || 'youtube',
    }));

    const pieData = accounts.map((a, i) => ({
        name: (a.title || '').length > 14 ? a.title.substring(0, 14) + '…' : a.title,
        value: a.subscriberCount || a.followersCount || 0,
        color: COLORS[i % COLORS.length],
    }));

    return (
        <Box>
            {/* ── Header ─────────────────────────────────────────────── */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3.5 }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, letterSpacing: '-0.03em' }}>
                        Dashboard Overview
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {accounts.length === 0
                            ? 'Add your first account to start tracking'
                            : `Tracking ${accounts.length} account${accounts.length !== 1 ? 's' : ''} · ${ytAccounts.length} YouTube · ${igAccounts.length} Instagram`}
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<Refresh sx={{ fontSize: 18 }} />}
                    onClick={onRefreshAll}
                    disabled={loading || accounts.length === 0}
                    sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        px: 2.5, py: 1.1,
                        '&:hover': { background: 'linear-gradient(135deg, #7C8FF4 0%, #8A5BB8 100%)' },
                    }}
                >
                    {loading ? 'Refreshing…' : 'Refresh All'}
                </Button>
            </Box>

            {loading && (
                <LinearProgress sx={{ mb: 3, borderRadius: 1, '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #667eea, #764ba2)' } }} />
            )}

            {/* ── KPI Cards ──────────────────────────────────────────── */}
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard icon={<People />} label="Total Audience" value={fmtNum(totalAudience)}
                        subtitle={`${fmtNum(totals.subscribers)} subs · ${fmtNum(totals.followers)} followers`} gradient="purple" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard icon={<Visibility />} label="Total YT Views" value={fmtNum(totals.views)}
                        subtitle={fmtNumFull(totals.views)} gradient="red" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard icon={<VideoLibrary />} label="Total Content" value={fmtNum(totals.videos + totals.posts)}
                        subtitle={`${fmtNum(totals.videos)} videos · ${fmtNum(totals.posts)} posts`} gradient="blue" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard icon={<BarChart />} label="Accounts" value={accounts.length}
                        subtitle={`${ytAccounts.length} YouTube · ${igAccounts.length} Instagram`} gradient="orange" />
                </Grid>
            </Grid>

            {accounts.length === 0 ? (
                <Card sx={{ p: 7, textAlign: 'center' }}>
                    <Box sx={{
                        width: 80, height: 80, borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(102,126,234,0.15), rgba(118,75,162,0.15))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3,
                    }}>
                        <People sx={{ fontSize: 40, color: '#667eea' }} />
                    </Box>
                    <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>Welcome to Social Analytics</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 400, mx: 'auto' }}>
                        Add your first YouTube channel or Instagram account to start tracking analytics
                    </Typography>
                </Card>
            ) : (
                <>
                    {/* ── Charts Row ─────────────────────────────────────── */}
                    <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                        {/* Audience Area Chart */}
                        <Grid size={{ xs: 12, md: 8 }}>
                            <Card sx={{ height: '100%' }}>
                                <CardContent sx={{ p: 2.5 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                                        <Box>
                                            {sectionLabel('Audience Comparison')}
                                        </Box>
                                    </Box>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="audGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#667eea" stopOpacity={0.35} />
                                                    <stop offset="95%" stopColor="#667eea" stopOpacity={0.02} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                            <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fill: '#64748B', fontSize: 12 }} tickFormatter={fmtNum} axisLine={false} tickLine={false} width={52} />
                                            <ReTooltip
                                                contentStyle={chartTooltipStyle}
                                                formatter={(v) => [fmtNumFull(v), 'Audience']}
                                                cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                                            />
                                            <Area type="monotone" dataKey="audience" stroke="#667eea" strokeWidth={2.5}
                                                fill="url(#audGrad)" dot={{ fill: '#667eea', r: 4, strokeWidth: 0 }}
                                                activeDot={{ r: 6, strokeWidth: 0 }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Pie Chart */}
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Card sx={{ height: '100%' }}>
                                <CardContent sx={{ p: 2.5 }}>
                                    {sectionLabel('Audience Share')}
                                    <ResponsiveContainer width="100%" height={280}>
                                        <PieChart>
                                            <Pie data={pieData} dataKey="value" nameKey="name"
                                                cx="50%" cy="45%" outerRadius={95} innerRadius={52}
                                                paddingAngle={3} strokeWidth={0}>
                                                {pieData.map((entry, i) => (
                                                    <Cell key={i} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <ReTooltip contentStyle={chartTooltipStyle} formatter={(v) => fmtNumFull(v)} />
                                            <Legend iconType="circle" iconSize={8}
                                                wrapperStyle={{ fontSize: 12, color: '#94A3B8', paddingTop: 8 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* ── Rankings ───────────────────────────────────────── */}
                    <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card>
                                <CardContent sx={{ p: 2.5 }}>
                                    {sectionLabel('Top by Audience')}
                                    {sorted.byAudience.map((a, i) => {
                                        const isIG = a.platform === 'instagram';
                                        const medalColor = i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#CD7F32' : '#475569';
                                        return (
                                            <Box key={a.id} onClick={() => onViewChannel(a)} sx={{
                                                display: 'flex', alignItems: 'center', gap: 1.5,
                                                py: 1.1, px: 1.2, borderRadius: 2, cursor: 'pointer',
                                                transition: 'background 0.15s',
                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.035)' },
                                            }}>
                                                <Typography sx={{ width: 22, fontWeight: 800, color: medalColor, fontSize: 15, lineHeight: 1 }}>
                                                    {i + 1}
                                                </Typography>
                                                <Avatar src={a.thumbnail || a.profilePictureUrl || a.thumbnails?.default}
                                                    sx={{ width: 34, height: 34, border: 'none' }} />
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography variant="body2" noWrap sx={{ fontWeight: 600, fontSize: 13 }}>{a.title}</Typography>
                                                </Box>
                                                {isIG ? <Instagram sx={{ fontSize: 15, color: '#E1306C' }} /> : <YouTube sx={{ fontSize: 15, color: '#FF0000' }} />}
                                                <Chip
                                                    label={fmtNum(isIG ? a.followersCount : a.subscriberCount)}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: isIG ? 'rgba(225,48,108,0.1)' : 'rgba(34,197,94,0.1)',
                                                        color: isIG ? '#EC4899' : '#22C55E',
                                                        fontWeight: 700, fontSize: 11, height: 22,
                                                        border: `1px solid ${isIG ? 'rgba(225,48,108,0.2)' : 'rgba(34,197,94,0.2)'}`,
                                                    }}
                                                />
                                            </Box>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card>
                                <CardContent sx={{ p: 2.5 }}>
                                    {sectionLabel('Top by Content')}
                                    {sorted.byContent.map((a, i) => {
                                        const isIG = a.platform === 'instagram';
                                        const medalColor = i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#CD7F32' : '#475569';
                                        return (
                                            <Box key={a.id} onClick={() => onViewChannel(a)} sx={{
                                                display: 'flex', alignItems: 'center', gap: 1.5,
                                                py: 1.1, px: 1.2, borderRadius: 2, cursor: 'pointer',
                                                transition: 'background 0.15s',
                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.035)' },
                                            }}>
                                                <Typography sx={{ width: 22, fontWeight: 800, color: medalColor, fontSize: 15, lineHeight: 1 }}>
                                                    {i + 1}
                                                </Typography>
                                                <Avatar src={a.thumbnail || a.profilePictureUrl || a.thumbnails?.default}
                                                    sx={{ width: 34, height: 34, border: 'none' }} />
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography variant="body2" noWrap sx={{ fontWeight: 600, fontSize: 13 }}>{a.title}</Typography>
                                                </Box>
                                                {isIG ? <Instagram sx={{ fontSize: 15, color: '#E1306C' }} /> : <YouTube sx={{ fontSize: 15, color: '#FF0000' }} />}
                                                <Chip
                                                    label={isIG ? `${fmtNum(a.mediaCount)} posts` : `${fmtNum(a.viewCount)} views`}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: isIG ? 'rgba(161,122,204,0.1)' : 'rgba(255,0,0,0.1)',
                                                        color: isIG ? '#A78BFA' : '#FF4444',
                                                        fontWeight: 700, fontSize: 11, height: 22,
                                                        border: `1px solid ${isIG ? 'rgba(161,122,204,0.2)' : 'rgba(255,0,0,0.2)'}`,
                                                    }}
                                                />
                                            </Box>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* ── All Accounts Table ─────────────────────────────── */}
                    <Card>
                        <CardContent sx={{ p: 2.5 }}>
                            {sectionLabel('All Accounts')}
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ width: 36 }}>#</TableCell>
                                            <TableCell>Account</TableCell>
                                            <TableCell align="center" sx={{ width: 80 }}>Platform</TableCell>
                                            <TableCell align="right">Audience</TableCell>
                                            <TableCell align="right">Content</TableCell>
                                            <TableCell align="right">Updated</TableCell>
                                            <TableCell align="center" sx={{ width: 60 }}></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {sorted.byAudience.map((a, i) => {
                                            const isIG = a.platform === 'instagram';
                                            return (
                                                <TableRow key={a.id} onClick={() => onViewChannel(a)}
                                                    sx={{ cursor: 'pointer' }}>
                                                    <TableCell>
                                                        <Typography sx={{ fontWeight: 700, fontSize: 13, color: i < 3 ? '#F59E0B' : 'text.secondary' }}>
                                                            {i + 1}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                            <Avatar src={a.thumbnail || a.profilePictureUrl || a.thumbnails?.default}
                                                                sx={{ width: 34, height: 34, border: 'none' }} />
                                                            <Box>
                                                                <Typography sx={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>{a.title}</Typography>
                                                                <Typography sx={{ color: 'text.secondary', fontSize: 11 }}>
                                                                    {isIG ? `@${a.username || ''}` : (a.customUrl || a.channelId || '')}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        {isIG
                                                            ? <Instagram sx={{ color: '#E1306C', fontSize: 18 }} />
                                                            : <YouTube sx={{ color: '#FF0000', fontSize: 18 }} />}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
                                                            {fmtNum(isIG ? a.followersCount : a.subscriberCount)}
                                                        </Typography>
                                                        <Typography sx={{ color: 'text.secondary', fontSize: 10 }}>
                                                            {isIG ? 'followers' : 'subscribers'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ fontSize: 13 }}>
                                                        {isIG
                                                            ? `${fmtNum(a.mediaCount)} posts`
                                                            : `${fmtNum(a.viewCount)} views · ${fmtNum(a.videoCount)} videos`}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography sx={{ color: 'text.secondary', fontSize: 11 }}>{timeAgo(a.lastUpdated)}</Typography>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Tooltip title="View Analytics">
                                                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onViewChannel(a); }}
                                                                sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>
                                                                <OpenInNew sx={{ fontSize: 15 }} />
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
