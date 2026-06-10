import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Grid, TextField, InputAdornment,
    Select, MenuItem, FormControl, InputLabel, Chip, IconButton, Tooltip,
    LinearProgress, Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, Avatar, Button, ToggleButton, ToggleButtonGroup, Pagination,
    Skeleton, TableSortLabel,
} from '@mui/material';
import {
    Search, Visibility, ThumbUp, Comment,
    ViewList, ViewModule, PlayCircleOutline, YouTube,
} from '@mui/icons-material';
import MainCard from '../../../components/MainCard';
import StatCard from '../../../components/ui/StatCard';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, fmtDate, fmtDuration, fmtPercent, timeAgo } from '../../../utils/formatters';
import { PRIMARY, GREY } from '../../../themes/index';

const ITEMS_PER_PAGE = 25;

function parseDurationToSeconds(iso) {
    if (!iso || iso === 'P0D') return 0;
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

const PERFORMANCE_TIERS = [
    { label: 'All',             value: 'all' },
    { label: 'Viral (>1M)',     value: 'viral',  min: 1000000 },
    { label: 'High (100K–1M)', value: 'high',   min: 100000, max: 1000000 },
    { label: 'Medium (10K–100K)', value: 'medium', min: 10000, max: 100000 },
    { label: 'Low (<10K)',      value: 'low',    max: 10000 },
];

export default function VideoExplorer() {
    const { accounts, showToast } = useAppContext();
    const [videos,          setVideos]          = useState([]);
    const [loading,         setLoading]         = useState(true);
    const [search,          setSearch]          = useState('');
    const [channelFilter,   setChannelFilter]   = useState('all');
    const [performanceTier, setPerformanceTier] = useState('all');
    const [sortField,       setSortField]       = useState('viewCount');
    const [sortOrder,       setSortOrder]       = useState('desc');
    const [viewMode,        setViewMode]        = useState('table');
    const [page,            setPage]            = useState(1);
    const [channels,        setChannels]        = useState([]);

    useEffect(() => { loadAllVideos(); }, [accounts]);

    const loadAllVideos = async () => {
        setLoading(true);
        try {
            const allVids = [];
            const channelList = [];
            for (const acct of (accounts || [])) {
                if (acct.platform === 'instagram') continue;
                try {
                    const res = await api.getVideos(acct.id);
                    const vids = res.videos || res.data?.videos || [];
                    const channelTitle = acct.title || acct.channelTitle || 'Unknown';
                    channelList.push({ id: acct.id, title: channelTitle, thumbnail: acct.thumbnails?.default || acct.thumbnailUrl || '' });
                    allVids.push(...vids.map(v => ({
                        ...v,
                        thumbnail: v.thumbnail || v.thumbnails?.medium || v.thumbnails?.high || v.thumbnails?.default || '',
                        channelTitle,
                        channelId: acct.id,
                        engagementRate: (v.viewCount || 0) > 0 ? (((v.likeCount || 0) + (v.commentCount || 0)) / v.viewCount * 100).toFixed(2) : '0.00',
                        durationSeconds: v.durationSeconds || parseDurationToSeconds(v.duration),
                    })));
                } catch (e) { /* skip failed channels */ }
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
        if (channelFilter !== 'all')   result = result.filter(v => v.channelId === channelFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(v => v.title?.toLowerCase().includes(q) || (v.tags || []).some(t => t.toLowerCase().includes(q)));
        }
        if (performanceTier !== 'all') {
            const tier = PERFORMANCE_TIERS.find(t => t.value === performanceTier);
            if (tier?.min != null) result = result.filter(v => (v.viewCount || 0) >= tier.min);
            if (tier?.max != null) result = result.filter(v => (v.viewCount || 0) < tier.max);
        }
        result.sort((a, b) => {
            const aVal = a[sortField] ?? 0, bVal = b[sortField] ?? 0;
            if (typeof aVal === 'string') return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });
        return result;
    }, [videos, channelFilter, search, performanceTier, sortField, sortOrder]);

    const pageCount      = Math.ceil(filteredVideos.length / ITEMS_PER_PAGE);
    const paginatedVideos = filteredVideos.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const handleSort = (field) => {
        if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortOrder('desc'); }
    };

    const stats = useMemo(() => ({
        total:         filteredVideos.length,
        totalViews:    filteredVideos.reduce((s, v) => s + (v.viewCount || 0), 0),
        totalLikes:    filteredVideos.reduce((s, v) => s + (v.likeCount || 0), 0),
        totalComments: filteredVideos.reduce((s, v) => s + (v.commentCount || 0), 0),
        avgViews:      filteredVideos.length > 0 ? Math.round(filteredVideos.reduce((s, v) => s + (v.viewCount || 0), 0) / filteredVideos.length) : 0,
    }), [filteredVideos]);

    if (loading) {
        return (
            <Box>
                <Typography variant="h4" sx={{ mb: 3 }}>Video Explorer</Typography>
                <LinearProgress sx={{ mb: 3, borderRadius: 1 }} />
                <Grid container spacing={2.5}>
                    {[...Array(6)].map((_, i) => <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}><Skeleton variant="rounded" height={180} sx={{ borderRadius: 2 }} /></Grid>)}
                </Grid>
            </Box>
        );
    }

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h4">Video Explorer</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                        {videos.length} total videos across {channels.length} channels
                    </Typography>
                </Box>
                <Button variant="contained" onClick={loadAllVideos} size="small">Refresh</Button>
            </Box>

            {/* Summary */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                    { label: 'Videos',          value: fmtNum(stats.total),         gradient: 'blue'   },
                    { label: 'Total Views',      value: fmtNum(stats.totalViews),    gradient: 'red'    },
                    { label: 'Total Likes',      value: fmtNum(stats.totalLikes),    gradient: 'green'  },
                    { label: 'Total Comments',   value: fmtNum(stats.totalComments), gradient: 'orange' },
                    { label: 'Avg Views',        value: fmtNum(stats.avgViews),      gradient: 'purple' },
                ].map((s, i) => (
                    <Grid key={i} size={{ xs: 6, sm: 4, md: 2.4 }}>
                        <MainCard sx={{ textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{s.label}</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>{s.value}</Typography>
                        </MainCard>
                    </Grid>
                ))}
            </Grid>

            {/* Filters */}
            <MainCard sx={{ mb: 2.5 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField fullWidth size="small" placeholder="Search by title or tag…"
                            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary', fontSize: 18 }} /></InputAdornment> } }}
                        />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Channel</InputLabel>
                            <Select value={channelFilter} label="Channel" onChange={e => { setChannelFilter(e.target.value); setPage(1); }}>
                                <MenuItem value="all">All Channels ({channels.length})</MenuItem>
                                {channels.map(c => (
                                    <MenuItem key={c.id} value={c.id}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {c.thumbnail && <Avatar src={c.thumbnail} sx={{ width: 18, height: 18 }} />}
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
                            <Select value={performanceTier} label="Performance" onChange={e => { setPerformanceTier(e.target.value); setPage(1); }}>
                                {PERFORMANCE_TIERS.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
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
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                    Showing {paginatedVideos.length} of {filteredVideos.length} videos
                </Typography>
            </MainCard>

            {/* Table */}
            {viewMode === 'table' && (
                <MainCard content={false}>
                    <TableContainer sx={{ maxHeight: 680 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ width: 40 }}>#</TableCell>
                                    <TableCell sx={{ width: 70 }} />
                                    <TableCell><TableSortLabel active={sortField === 'title'} direction={sortField === 'title' ? sortOrder : 'asc'} onClick={() => handleSort('title')}>Video</TableSortLabel></TableCell>
                                    {channels.length > 1 && <TableCell>Channel</TableCell>}
                                    <TableCell align="right"><TableSortLabel active={sortField === 'viewCount'} direction={sortField === 'viewCount' ? sortOrder : 'desc'} onClick={() => handleSort('viewCount')}>Views</TableSortLabel></TableCell>
                                    <TableCell align="right"><TableSortLabel active={sortField === 'likeCount'} direction={sortField === 'likeCount' ? sortOrder : 'desc'} onClick={() => handleSort('likeCount')}>Likes</TableSortLabel></TableCell>
                                    <TableCell align="right"><TableSortLabel active={sortField === 'commentCount'} direction={sortField === 'commentCount' ? sortOrder : 'desc'} onClick={() => handleSort('commentCount')}>Comments</TableSortLabel></TableCell>
                                    <TableCell align="right"><TableSortLabel active={sortField === 'engagementRate'} direction={sortField === 'engagementRate' ? sortOrder : 'desc'} onClick={() => handleSort('engagementRate')}>Engagement</TableSortLabel></TableCell>
                                    <TableCell align="right"><TableSortLabel active={sortField === 'durationSeconds'} direction={sortField === 'durationSeconds' ? sortOrder : 'desc'} onClick={() => handleSort('durationSeconds')}>Duration</TableSortLabel></TableCell>
                                    <TableCell align="right"><TableSortLabel active={sortField === 'publishedAt'} direction={sortField === 'publishedAt' ? sortOrder : 'desc'} onClick={() => handleSort('publishedAt')}>Published</TableSortLabel></TableCell>
                                    <TableCell align="center" sx={{ width: 52 }} />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedVideos.map((v, i) => (
                                    <TableRow key={`${v.videoId}-${i}`} hover sx={{ cursor: 'pointer' }} onClick={() => window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank', 'noopener')}>
                                        <TableCell><Typography variant="body2" color="text.secondary">{(page - 1) * ITEMS_PER_PAGE + i + 1}</Typography></TableCell>
                                        <TableCell>{v.thumbnail && <Box component="img" src={v.thumbnail} sx={{ width: 60, height: 34, borderRadius: 1, objectFit: 'cover', display: 'block' }} />}</TableCell>
                                        <TableCell><Typography variant="body2" sx={{ fontWeight: 500, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</Typography></TableCell>
                                        {channels.length > 1 && <TableCell><Chip label={v.channelTitle} size="small" variant="outlined" sx={{ fontSize: '0.7rem', maxWidth: 120 }} /></TableCell>}
                                        <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 600 }}>{fmtNum(v.viewCount)}</Typography></TableCell>
                                        <TableCell align="right"><Typography variant="body2">{fmtNum(v.likeCount)}</Typography></TableCell>
                                        <TableCell align="right"><Typography variant="body2">{fmtNum(v.commentCount)}</Typography></TableCell>
                                        <TableCell align="right">
                                            <Chip label={fmtPercent(v.engagementRate)} size="small"
                                                sx={{ bgcolor: parseFloat(v.engagementRate) > 5 ? '#f6ffed' : GREY[100], color: parseFloat(v.engagementRate) > 5 ? '#389e0d' : 'text.secondary', fontWeight: 600, fontSize: '0.68rem', height: 20 }} />
                                        </TableCell>
                                        <TableCell align="right"><Typography variant="body2">{fmtDuration(v.durationSeconds)}</Typography></TableCell>
                                        <TableCell align="right"><Typography variant="caption" color="text.secondary">{fmtDate(v.publishedAt)}</Typography></TableCell>
                                        <TableCell align="center">
                                            <Tooltip title="Watch on YouTube">
                                                <IconButton size="small" onClick={e => { e.stopPropagation(); window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank', 'noopener'); }}
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
            )}

            {/* Grid */}
            {viewMode === 'grid' && (
                <Grid container spacing={2}>
                    {paginatedVideos.map((v, i) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={`${v.videoId}-${i}`}>
                            <MainCard content={false} sx={{ cursor: 'pointer', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 6px 20px rgba(0,0,0,0.12)' } }}
                                onClick={() => window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank', 'noopener')}>
                                <Box sx={{ position: 'relative' }}>
                                    <Box component="img" src={v.thumbnail} sx={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                                    {v.durationSeconds > 0 && (
                                        <Chip label={fmtDuration(v.durationSeconds)} size="small"
                                            sx={{ position: 'absolute', bottom: 6, right: 6, bgcolor: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: '0.68rem', fontWeight: 600, height: 20 }} />
                                    )}
                                    <Chip icon={<Visibility sx={{ fontSize: '12px !important', color: '#fff !important' }} />} label={fmtNum(v.viewCount)} size="small"
                                        sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '0.68rem', fontWeight: 600, height: 20 }} />
                                </Box>
                                <Box sx={{ p: 1.5 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                                        {v.title}
                                    </Typography>
                                    {channels.length > 1 && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{v.channelTitle}</Typography>}
                                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', color: 'text.secondary' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, fontSize: '0.75rem' }}><ThumbUp sx={{ fontSize: 12 }} />{fmtNum(v.likeCount)}</Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, fontSize: '0.75rem' }}><Comment sx={{ fontSize: 12 }} />{fmtNum(v.commentCount)}</Box>
                                        <Typography variant="caption" sx={{ ml: 'auto' }}>{timeAgo(v.publishedAt)}</Typography>
                                    </Box>
                                </Box>
                            </MainCard>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Empty state */}
            {filteredVideos.length === 0 && !loading && (
                <MainCard>
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                        <YouTube sx={{ fontSize: 56, color: GREY[300], mb: 2 }} />
                        <Typography variant="h5" color="text.secondary">No videos found</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {accounts?.length === 0 ? 'Add a channel first to explore videos' : 'Try adjusting your filters'}
                        </Typography>
                    </Box>
                </MainCard>
            )}

            {/* Pagination */}
            {pageCount > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <Pagination count={pageCount} page={page} onChange={(_, p) => setPage(p)} shape="rounded" size="large" />
                </Box>
            )}
        </Box>
    );
}
