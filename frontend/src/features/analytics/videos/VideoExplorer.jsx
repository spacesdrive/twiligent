import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, TextField, InputAdornment,
    Select, MenuItem, FormControl, InputLabel, Chip, IconButton, Tooltip,
    LinearProgress, Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, Avatar, Button, ToggleButton, ToggleButtonGroup, Pagination,
    Skeleton, Paper, Divider, TableSortLabel,
} from '@mui/material';
import {
    Search, OpenInNew, Visibility, ThumbUp, Comment, FilterList,
    ViewList, ViewModule, Sort, PlayCircleOutline, TrendingUp,
    Schedule, Speed, YouTube,
} from '@mui/icons-material';
import { api } from '../../../services/api';
import { fmtNum, fmtNumFull, fmtDate, fmtDuration, fmtPercent, timeAgo } from '../../../utils/formatters';

const ITEMS_PER_PAGE = 25;

function parseDurationToSeconds(iso) {
    if (!iso || iso === 'P0D') return 0;
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

const PERFORMANCE_TIERS = [
    { label: 'All', value: 'all' },
    { label: 'Viral (>1M)', value: 'viral', min: 1000000 },
    { label: 'High (100K–1M)', value: 'high', min: 100000, max: 1000000 },
    { label: 'Medium (10K–100K)', value: 'medium', min: 10000, max: 100000 },
    { label: 'Low (<10K)', value: 'low', max: 10000 },
];

export default function VideoExplorer({ accounts, showToast }) {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [channelFilter, setChannelFilter] = useState('all');
    const [performanceTier, setPerformanceTier] = useState('all');
    const [sortField, setSortField] = useState('viewCount');
    const [sortOrder, setSortOrder] = useState('desc');
    const [viewMode, setViewMode] = useState('table');
    const [page, setPage] = useState(1);
    const [channels, setChannels] = useState([]);

    useEffect(() => {
        loadAllVideos();
    }, [accounts]);

    const loadAllVideos = async () => {
        setLoading(true);
        try {
            const allVids = [];
            const channelList = [];
            for (const acct of (accounts || [])) {
                try {
                    const res = await api.getVideos(acct.id);
                    const vids = res.videos || res.data?.videos || [];
                    const channelTitle = acct.title || acct.name || acct.channelTitle || 'Unknown';
                    channelList.push({ id: acct.id, title: channelTitle, thumbnail: acct.thumbnails?.default || acct.thumbnailUrl || '' });
                    allVids.push(...vids.map(v => {
                        const thumb = v.thumbnail || v.thumbnails?.medium || v.thumbnails?.high || v.thumbnails?.default || '';
                        const views = v.viewCount || 0;
                        const likes = v.likeCount || 0;
                        const comments = v.commentCount || 0;
                        return {
                            ...v,
                            thumbnail: thumb,
                            channelTitle,
                            channelId: acct.id,
                            channelThumbnail: acct.thumbnails?.default || acct.thumbnailUrl || '',
                            engagementRate: views > 0 ? ((likes + comments) / views * 100).toFixed(2) : '0.00',
                            durationSeconds: v.durationSeconds || parseDurationToSeconds(v.duration),
                        };
                    }));
                } catch (e) {
                    console.warn(`Failed to load videos for ${acct.id}:`, e.message);
                }
            }
            setVideos(allVids);
            setChannels(channelList);
        } catch (err) {
            showToast('Failed to load videos: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const filteredVideos = useMemo(() => {
        let result = [...videos];

        // Channel filter
        if (channelFilter !== 'all') {
            result = result.filter(v => v.channelId === channelFilter);
        }

        // Search filter
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(v =>
                v.title?.toLowerCase().includes(q) ||
                (v.tags || []).some(t => t.toLowerCase().includes(q))
            );
        }

        // Performance tier
        if (performanceTier !== 'all') {
            const tier = PERFORMANCE_TIERS.find(t => t.value === performanceTier);
            if (tier) {
                if (tier.min != null) result = result.filter(v => (v.viewCount || 0) >= tier.min);
                if (tier.max != null) result = result.filter(v => (v.viewCount || 0) < tier.max);
            }
        }

        // Sort
        result.sort((a, b) => {
            const aVal = a[sortField] ?? 0;
            const bVal = b[sortField] ?? 0;
            if (typeof aVal === 'string') return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });

        return result;
    }, [videos, channelFilter, search, performanceTier, sortField, sortOrder]);

    const pageCount = Math.ceil(filteredVideos.length / ITEMS_PER_PAGE);
    const paginatedVideos = filteredVideos.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    };

    const openOnYouTube = (videoId) => {
        window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank', 'noopener');
    };

    // Stats summary
    const stats = useMemo(() => {
        const total = filteredVideos.length;
        const totalViews = filteredVideos.reduce((s, v) => s + (v.viewCount || 0), 0);
        const totalLikes = filteredVideos.reduce((s, v) => s + (v.likeCount || 0), 0);
        const totalComments = filteredVideos.reduce((s, v) => s + (v.commentCount || 0), 0);
        const avgViews = total > 0 ? Math.round(totalViews / total) : 0;
        return { total, totalViews, totalLikes, totalComments, avgViews };
    }, [filteredVideos]);

    if (loading) {
        return (
            <Box>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
                    <YouTube sx={{ verticalAlign: 'middle', mr: 1, color: '#FF0000', fontSize: 36 }} />
                    Video Explorer
                </Typography>
                <LinearProgress color="error" sx={{ mb: 3 }} />
                <Grid container spacing={2}>
                    {[...Array(6)].map((_, i) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                            <Skeleton variant="rounded" height={200} sx={{ borderRadius: 3 }} />
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
                    Video Explorer
                </Typography>
                <Button variant="contained" onClick={loadAllVideos}
                    sx={{ background: 'linear-gradient(135deg, #FF0000, #FF4444)' }}>
                    Refresh All
                </Button>
            </Box>

            {/* Summary Stats */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
                    <Card sx={{ textAlign: 'center', p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">Videos</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>{fmtNum(stats.total)}</Typography>
                    </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
                    <Card sx={{ textAlign: 'center', p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">Total Views</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#FF0000' }}>{fmtNum(stats.totalViews)}</Typography>
                    </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
                    <Card sx={{ textAlign: 'center', p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">Total Likes</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#4CAF50' }}>{fmtNum(stats.totalLikes)}</Typography>
                    </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
                    <Card sx={{ textAlign: 'center', p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">Total Comments</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#3EA6FF' }}>{fmtNum(stats.totalComments)}</Typography>
                    </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
                    <Card sx={{ textAlign: 'center', p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">Avg Views</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#FF9800' }}>{fmtNum(stats.avgViews)}</Typography>
                    </Card>
                </Grid>
            </Grid>

            {/* Filters */}
            <Card sx={{ mb: 3, p: 2 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField
                            fullWidth size="small" placeholder="Search videos by title or tag..."
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
                    <Grid size={{ xs: 12, sm: 2 }}>
                        <ToggleButtonGroup value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)} size="small" fullWidth>
                            <ToggleButton value="table"><ViewList /></ToggleButton>
                            <ToggleButton value="grid"><ViewModule /></ToggleButton>
                        </ToggleButtonGroup>
                    </Grid>
                </Grid>
                <Box sx={{ mt: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">
                        Showing {paginatedVideos.length} of {filteredVideos.length} videos
                        {channelFilter !== 'all' && ` • Channel: ${channels.find(c => c.id === channelFilter)?.title}`}
                        {performanceTier !== 'all' && ` • ${PERFORMANCE_TIERS.find(t => t.value === performanceTier)?.label}`}
                    </Typography>
                </Box>
            </Card>

            {/* Table View */}
            {viewMode === 'table' && (
                <Card>
                    <TableContainer sx={{ maxHeight: 700 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ bgcolor: '#1A1A1A', width: 40 }}>#</TableCell>
                                    <TableCell sx={{ bgcolor: '#1A1A1A', width: 60 }}></TableCell>
                                    <TableCell sx={{ bgcolor: '#1A1A1A' }}>
                                        <TableSortLabel active={sortField === 'title'} direction={sortField === 'title' ? sortOrder : 'asc'} onClick={() => handleSort('title')}>
                                            Video
                                        </TableSortLabel>
                                    </TableCell>
                                    {channels.length > 1 && <TableCell sx={{ bgcolor: '#1A1A1A' }}>Channel</TableCell>}
                                    <TableCell align="right" sx={{ bgcolor: '#1A1A1A' }}>
                                        <TableSortLabel active={sortField === 'viewCount'} direction={sortField === 'viewCount' ? sortOrder : 'desc'} onClick={() => handleSort('viewCount')}>
                                            Views
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell align="right" sx={{ bgcolor: '#1A1A1A' }}>
                                        <TableSortLabel active={sortField === 'likeCount'} direction={sortField === 'likeCount' ? sortOrder : 'desc'} onClick={() => handleSort('likeCount')}>
                                            Likes
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell align="right" sx={{ bgcolor: '#1A1A1A' }}>
                                        <TableSortLabel active={sortField === 'commentCount'} direction={sortField === 'commentCount' ? sortOrder : 'desc'} onClick={() => handleSort('commentCount')}>
                                            Comments
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell align="right" sx={{ bgcolor: '#1A1A1A' }}>
                                        <TableSortLabel active={sortField === 'engagementRate'} direction={sortField === 'engagementRate' ? sortOrder : 'desc'} onClick={() => handleSort('engagementRate')}>
                                            Engagement
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell align="right" sx={{ bgcolor: '#1A1A1A' }}>
                                        <TableSortLabel active={sortField === 'durationSeconds'} direction={sortField === 'durationSeconds' ? sortOrder : 'desc'} onClick={() => handleSort('durationSeconds')}>
                                            Duration
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell align="right" sx={{ bgcolor: '#1A1A1A' }}>
                                        <TableSortLabel active={sortField === 'publishedAt'} direction={sortField === 'publishedAt' ? sortOrder : 'desc'} onClick={() => handleSort('publishedAt')}>
                                            Published
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell align="center" sx={{ bgcolor: '#1A1A1A', width: 50 }}>Watch</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedVideos.map((v, i) => (
                                    <TableRow key={`${v.videoId}-${i}`} hover sx={{ cursor: 'pointer' }} onClick={() => openOnYouTube(v.videoId)}>
                                        <TableCell>{(page - 1) * ITEMS_PER_PAGE + i + 1}</TableCell>
                                        <TableCell>
                                            {v.thumbnail && (
                                                <Box component="img" src={v.thumbnail} sx={{ width: 60, height: 34, borderRadius: 1, objectFit: 'cover' }} />
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" sx={{ fontWeight: 500, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {v.title}
                                            </Typography>
                                        </TableCell>
                                        {channels.length > 1 && (
                                            <TableCell>
                                                <Chip label={v.channelTitle} size="small" variant="outlined"
                                                    sx={{ fontSize: 11, maxWidth: 120, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }} />
                                            </TableCell>
                                        )}
                                        <TableCell align="right" sx={{ fontWeight: 600 }}>{fmtNum(v.viewCount)}</TableCell>
                                        <TableCell align="right">{fmtNum(v.likeCount)}</TableCell>
                                        <TableCell align="right">{fmtNum(v.commentCount)}</TableCell>
                                        <TableCell align="right">
                                            <Chip label={fmtPercent(v.engagementRate)} size="small"
                                                sx={{
                                                    bgcolor: parseFloat(v.engagementRate) > 5 ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.05)',
                                                    color: parseFloat(v.engagementRate) > 5 ? '#4CAF50' : 'text.secondary',
                                                    fontWeight: 600, fontSize: 11,
                                                }} />
                                        </TableCell>
                                        <TableCell align="right">{fmtDuration(v.durationSeconds)}</TableCell>
                                        <TableCell align="right">
                                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{fmtDate(v.publishedAt)}</Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Tooltip title="Watch on YouTube">
                                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); openOnYouTube(v.videoId); }}
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
            )}

            {/* Grid View */}
            {viewMode === 'grid' && (
                <Grid container spacing={2}>
                    {paginatedVideos.map((v, i) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={`${v.videoId}-${i}`}>
                            <Card sx={{
                                cursor: 'pointer',
                                '&:hover': { transform: 'translateY(-4px)', transition: 'all 0.2s', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' },
                            }} onClick={() => openOnYouTube(v.videoId)}>
                                <Box sx={{ position: 'relative' }}>
                                    <Box component="img" src={v.thumbnail} sx={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                                    {/* Play overlay */}
                                    <Box sx={{
                                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        bgcolor: 'rgba(0,0,0,0)', transition: 'all 0.2s',
                                        '&:hover': { bgcolor: 'rgba(0,0,0,0.4)' },
                                    }}>
                                        <PlayCircleOutline sx={{
                                            fontSize: 48, color: '#fff', opacity: 0, transition: 'opacity 0.2s',
                                            '.MuiCard-root:hover &': { opacity: 1 }
                                        }} />
                                    </Box>
                                    {/* Duration badge */}
                                    {v.durationSeconds > 0 && (
                                        <Chip label={fmtDuration(v.durationSeconds)} size="small"
                                            sx={{ position: 'absolute', bottom: 6, right: 6, bgcolor: 'rgba(0,0,0,0.85)', color: '#fff', fontSize: 11, fontWeight: 600, height: 22 }} />
                                    )}
                                    {/* Views badge */}
                                    <Chip icon={<Visibility sx={{ fontSize: '14px !important', color: '#fff !important' }} />}
                                        label={fmtNum(v.viewCount)} size="small"
                                        sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 11, fontWeight: 600, height: 22 }} />
                                </Box>
                                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                                        {v.title}
                                    </Typography>
                                    {channels.length > 1 && (
                                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                                            {v.channelTitle}
                                        </Typography>
                                    )}
                                    <Box sx={{ display: 'flex', gap: 1.5, fontSize: 11, color: 'text.secondary', alignItems: 'center' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                            <ThumbUp sx={{ fontSize: 13 }} /> {fmtNum(v.likeCount)}
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                            <Comment sx={{ fontSize: 13 }} /> {fmtNum(v.commentCount)}
                                        </Box>
                                        <Box sx={{ ml: 'auto', fontSize: 11 }}>{timeAgo(v.publishedAt)}</Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Pagination */}
            {pageCount > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <Pagination count={pageCount} page={page} onChange={(_, p) => setPage(p)}
                        color="error" shape="rounded" size="large" />
                </Box>
            )}

            {/* Empty state */}
            {filteredVideos.length === 0 && !loading && (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                    <YouTube sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">No videos found</Typography>
                    <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
                        {accounts?.length === 0
                            ? 'Add a channel first to explore videos'
                            : 'Try adjusting your filters or search query'}
                    </Typography>
                </Box>
            )}
        </Box>
    );
}
