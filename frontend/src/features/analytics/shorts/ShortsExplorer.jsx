import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, TextField, InputAdornment,
    Select, MenuItem, FormControl, InputLabel, Chip, IconButton, Tooltip,
    LinearProgress, Avatar, Button, Pagination, Skeleton,
} from '@mui/material';
import {
    Search, Visibility, ThumbUp, Comment, PlayCircleOutline, YouTube,
} from '@mui/icons-material';
import { api } from '../../../services/api';
import { fmtNum, fmtDate, fmtDuration, fmtPercent, timeAgo } from '../../../utils/formatters';

const ITEMS_PER_PAGE = 24;

const PERFORMANCE_TIERS = [
    { label: 'All', value: 'all' },
    { label: 'Viral (>1M)', value: 'viral', min: 1000000 },
    { label: 'High (100K–1M)', value: 'high', min: 100000, max: 1000000 },
    { label: 'Medium (10K–100K)', value: 'medium', min: 10000, max: 100000 },
    { label: 'Low (<10K)', value: 'low', max: 10000 },
];

const SORT_OPTIONS = [
    { label: 'Most Viewed', field: 'viewCount' },
    { label: 'Most Liked', field: 'likeCount' },
    { label: 'Most Comments', field: 'commentCount' },
    { label: 'Best Engagement', field: 'engagementRate' },
    { label: 'Newest First', field: 'publishedAt' },
];

function parseDurationToSeconds(iso) {
    if (!iso || iso === 'P0D') return 0;
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

export default function ShortsExplorer({ accounts, showToast }) {
    const [shorts, setShorts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [channelFilter, setChannelFilter] = useState('all');
    const [performanceTier, setPerformanceTier] = useState('all');
    const [sortField, setSortField] = useState('viewCount');
    const [page, setPage] = useState(1);
    const [channels, setChannels] = useState([]);

    useEffect(() => {
        loadAllShorts();
    }, [accounts]);

    const loadAllShorts = async () => {
        setLoading(true);
        try {
            const allShorts = [];
            const channelList = [];
            for (const acct of (accounts || [])) {
                try {
                    const res = await api.getVideos(acct.id);
                    const vids = res.videos || res.data?.videos || [];
                    const channelTitle = acct.title || acct.name || acct.channelTitle || 'Unknown';
                    channelList.push({ id: acct.id, title: channelTitle, thumbnail: acct.thumbnails?.default || acct.thumbnailUrl || '' });
                    for (const v of vids) {
                        const dur = v.durationSeconds || parseDurationToSeconds(v.duration);
                        if (dur > 0 && dur <= 60) {
                            const thumb = v.thumbnail || v.thumbnails?.medium || v.thumbnails?.high || v.thumbnails?.default || '';
                            const views = v.viewCount || 0;
                            const likes = v.likeCount || 0;
                            const comments = v.commentCount || 0;
                            allShorts.push({
                                ...v,
                                thumbnail: thumb,
                                channelTitle,
                                channelId: acct.id,
                                durationSeconds: dur,
                                engagementRate: views > 0 ? ((likes + comments) / views * 100).toFixed(2) : '0.00',
                            });
                        }
                    }
                } catch (e) {
                    console.warn(`Failed to load videos for ${acct.id}:`, e.message);
                }
            }
            setShorts(allShorts);
            setChannels(channelList);
        } catch (err) {
            showToast('Failed to load shorts: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const filteredShorts = useMemo(() => {
        let result = [...shorts];
        if (channelFilter !== 'all') result = result.filter(v => v.channelId === channelFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(v => v.title?.toLowerCase().includes(q) || (v.tags || []).some(t => t.toLowerCase().includes(q)));
        }
        if (performanceTier !== 'all') {
            const tier = PERFORMANCE_TIERS.find(t => t.value === performanceTier);
            if (tier) {
                if (tier.min != null) result = result.filter(v => (v.viewCount || 0) >= tier.min);
                if (tier.max != null) result = result.filter(v => (v.viewCount || 0) < tier.max);
            }
        }
        result.sort((a, b) => {
            const aVal = sortField === 'publishedAt' ? new Date(a[sortField] || 0).getTime() : (parseFloat(a[sortField]) || 0);
            const bVal = sortField === 'publishedAt' ? new Date(b[sortField] || 0).getTime() : (parseFloat(b[sortField]) || 0);
            return bVal - aVal;
        });
        return result;
    }, [shorts, channelFilter, search, performanceTier, sortField]);

    const pageCount = Math.ceil(filteredShorts.length / ITEMS_PER_PAGE);
    const paginatedShorts = filteredShorts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const stats = useMemo(() => {
        const total = filteredShorts.length;
        const totalViews = filteredShorts.reduce((s, v) => s + (v.viewCount || 0), 0);
        const totalLikes = filteredShorts.reduce((s, v) => s + (v.likeCount || 0), 0);
        const avgViews = total > 0 ? Math.round(totalViews / total) : 0;
        return { total, totalViews, totalLikes, avgViews };
    }, [filteredShorts]);

    const openOnYouTube = (videoId) => {
        window.open(`https://www.youtube.com/shorts/${videoId}`, '_blank', 'noopener');
    };

    if (loading) {
        return (
            <Box>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
                    <YouTube sx={{ verticalAlign: 'middle', mr: 1, color: '#FF0000', fontSize: 36 }} />
                    Shorts Explorer
                </Typography>
                <LinearProgress color="error" sx={{ mb: 3 }} />
                <Grid container spacing={2}>
                    {[...Array(8)].map((_, i) => (
                        <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={i}>
                            <Skeleton variant="rounded" height={320} sx={{ borderRadius: 3 }} />
                        </Grid>
                    ))}
                </Grid>
            </Box>
        );
    }

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    <YouTube sx={{ verticalAlign: 'middle', mr: 1, color: '#FF0000', fontSize: 36 }} />
                    Shorts Explorer
                </Typography>
                <Button variant="contained" onClick={loadAllShorts}
                    sx={{ background: 'linear-gradient(135deg, #FF0000, #FF4444)' }}>
                    Refresh All
                </Button>
            </Box>

            {/* Summary Stats */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 6, sm: 3 }}>
                    <Card sx={{ textAlign: 'center', p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">Shorts</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>{fmtNum(stats.total)}</Typography>
                    </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                    <Card sx={{ textAlign: 'center', p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">Total Views</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#FF0000' }}>{fmtNum(stats.totalViews)}</Typography>
                    </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                    <Card sx={{ textAlign: 'center', p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">Total Likes</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#4CAF50' }}>{fmtNum(stats.totalLikes)}</Typography>
                    </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                    <Card sx={{ textAlign: 'center', p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">Avg Views</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#FF9800' }}>{fmtNum(stats.avgViews)}</Typography>
                    </Card>
                </Grid>
            </Grid>

            {/* Filters */}
            <Card sx={{ mb: 3, p: 2 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12, sm: 3 }}>
                        <TextField fullWidth size="small" placeholder="Search shorts..."
                            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary' }} /></InputAdornment> } }}
                        />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Channel</InputLabel>
                            <Select value={channelFilter} label="Channel"
                                onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}>
                                <MenuItem value="all">All Channels ({channels.length})</MenuItem>
                                {channels.map(c => (
                                    <MenuItem key={c.id} value={c.id}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {c.thumbnail && <Avatar src={c.thumbnail} sx={{ width: 20, height: 20 }} />}
                                            {c.title}
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Performance</InputLabel>
                            <Select value={performanceTier} label="Performance"
                                onChange={(e) => { setPerformanceTier(e.target.value); setPage(1); }}>
                                {PERFORMANCE_TIERS.map(t => (
                                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Sort By</InputLabel>
                            <Select value={sortField} label="Sort By"
                                onChange={(e) => { setSortField(e.target.value); setPage(1); }}>
                                {SORT_OPTIONS.map(s => (
                                    <MenuItem key={s.field} value={s.field}>{s.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
                <Box sx={{ mt: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">
                        Showing {paginatedShorts.length} of {filteredShorts.length} shorts
                        {channelFilter !== 'all' && ` • Channel: ${channels.find(c => c.id === channelFilter)?.title}`}
                        {performanceTier !== 'all' && ` • ${PERFORMANCE_TIERS.find(t => t.value === performanceTier)?.label}`}
                    </Typography>
                </Box>
            </Card>

            {/* Shorts Grid — vertical 9:16 card layout */}
            <Grid container spacing={2}>
                {paginatedShorts.map((v, i) => (
                    <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={`${v.videoId}-${i}`}>
                        <Card sx={{
                            cursor: 'pointer', borderRadius: 3, overflow: 'hidden',
                            '&:hover': { transform: 'translateY(-4px)', transition: 'all 0.2s', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' },
                        }} onClick={() => openOnYouTube(v.videoId)}>
                            <Box sx={{ position: 'relative' }}>
                                <Box component="img" src={v.thumbnail}
                                    sx={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', display: 'block', bgcolor: '#222' }}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                                {/* Play overlay */}
                                <Box sx={{
                                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    bgcolor: 'transparent', transition: 'all 0.2s',
                                    '&:hover': { bgcolor: 'rgba(0,0,0,0.35)' },
                                }}>
                                    <PlayCircleOutline sx={{
                                        fontSize: 44, color: '#fff', opacity: 0, transition: 'opacity 0.2s',
                                        '.MuiCard-root:hover &': { opacity: 1 },
                                    }} />
                                </Box>
                                {/* Views badge */}
                                <Chip icon={<Visibility sx={{ fontSize: '13px !important', color: '#fff !important' }} />}
                                    label={fmtNum(v.viewCount)} size="small"
                                    sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 11, fontWeight: 600, height: 22 }} />
                                {/* Duration badge */}
                                <Chip label={fmtDuration(v.durationSeconds)} size="small"
                                    sx={{ position: 'absolute', bottom: 6, right: 6, bgcolor: 'rgba(0,0,0,0.85)', color: '#fff', fontSize: 11, fontWeight: 600, height: 22 }} />
                            </Box>
                            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                <Typography variant="body2" sx={{
                                    fontWeight: 600, mb: 0.5, fontSize: 12,
                                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4,
                                }}>
                                    {v.title}
                                </Typography>
                                {channels.length > 1 && (
                                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontSize: 11 }}>
                                        {v.channelTitle}
                                    </Typography>
                                )}
                                <Box sx={{ display: 'flex', gap: 1, fontSize: 11, color: 'text.secondary', alignItems: 'center' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                        <ThumbUp sx={{ fontSize: 12 }} /> {fmtNum(v.likeCount)}
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                        <Comment sx={{ fontSize: 12 }} /> {fmtNum(v.commentCount)}
                                    </Box>
                                    <Box sx={{ ml: 'auto', fontSize: 10 }}>{timeAgo(v.publishedAt)}</Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Pagination */}
            {pageCount > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <Pagination count={pageCount} page={page} onChange={(_, p) => setPage(p)}
                        color="error" shape="rounded" size="large" />
                </Box>
            )}

            {/* Empty state */}
            {filteredShorts.length === 0 && !loading && (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                    <YouTube sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">No shorts found</Typography>
                    <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
                        {accounts?.length === 0
                            ? 'Add a channel first to explore shorts'
                            : 'Try adjusting your filters or search query'}
                    </Typography>
                </Box>
            )}
        </Box>
    );
}
