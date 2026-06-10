import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Grid, TextField, InputAdornment,
    Select, MenuItem, FormControl, InputLabel, Chip,
    LinearProgress, Avatar, Button, Pagination, Skeleton,
} from '@mui/material';
import {
    Search, Visibility, ThumbUp as ThumbUpIcon, Comment as CommentIcon,
    PlayCircleOutline, YouTube,
} from '@mui/icons-material';
import MainCard from '../../../components/MainCard';
import { useAppContext } from '../../../context/AppContext';
import { api } from '../../../services/api';
import { fmtNum, fmtDuration, timeAgo } from '../../../utils/formatters';
import { GREY } from '../../../themes/index';

const ITEMS_PER_PAGE = 24;

const PERFORMANCE_TIERS = [
    { label: 'All',               value: 'all' },
    { label: 'Viral (>1M)',       value: 'viral',  min: 1000000 },
    { label: 'High (100K–1M)',    value: 'high',   min: 100000, max: 1000000 },
    { label: 'Medium (10K–100K)', value: 'medium', min: 10000,  max: 100000 },
    { label: 'Low (<10K)',        value: 'low',    max: 10000 },
];

const SORT_OPTIONS = [
    { label: 'Most Viewed',      field: 'viewCount' },
    { label: 'Most Liked',       field: 'likeCount' },
    { label: 'Most Comments',    field: 'commentCount' },
    { label: 'Best Engagement',  field: 'engagementRate' },
    { label: 'Newest First',     field: 'publishedAt' },
];

function parseDurationToSeconds(iso) {
    if (!iso || iso === 'P0D') return 0;
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

export default function ShortsExplorer() {
    const { accounts, showToast } = useAppContext();
    const [shorts,          setShorts]          = useState([]);
    const [loading,         setLoading]         = useState(true);
    const [search,          setSearch]          = useState('');
    const [channelFilter,   setChannelFilter]   = useState('all');
    const [performanceTier, setPerformanceTier] = useState('all');
    const [sortField,       setSortField]       = useState('viewCount');
    const [page,            setPage]            = useState(1);
    const [channels,        setChannels]        = useState([]);

    useEffect(() => { loadAllShorts(); }, [accounts]);

    const loadAllShorts = async () => {
        setLoading(true);
        try {
            const allShorts = [];
            const channelList = [];
            for (const acct of (accounts || [])) {
                if (acct.platform === 'instagram') continue;
                try {
                    const res = await api.getVideos(acct.id);
                    const vids = res.videos || res.data?.videos || [];
                    const channelTitle = acct.title || acct.channelTitle || 'Unknown';
                    channelList.push({ id: acct.id, title: channelTitle, thumbnail: acct.thumbnails?.default || acct.thumbnailUrl || '' });
                    for (const v of vids) {
                        const dur = v.durationSeconds || parseDurationToSeconds(v.duration);
                        if (dur > 0 && dur <= 60) {
                            const views = v.viewCount || 0;
                            allShorts.push({
                                ...v,
                                thumbnail: v.thumbnail || v.thumbnails?.medium || v.thumbnails?.high || v.thumbnails?.default || '',
                                channelTitle,
                                channelId: acct.id,
                                durationSeconds: dur,
                                engagementRate: views > 0 ? (((v.likeCount || 0) + (v.commentCount || 0)) / views * 100).toFixed(2) : '0.00',
                            });
                        }
                    }
                } catch (e) { /* skip */ }
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
            if (tier?.min != null) result = result.filter(v => (v.viewCount || 0) >= tier.min);
            if (tier?.max != null) result = result.filter(v => (v.viewCount || 0) < tier.max);
        }
        result.sort((a, b) => {
            const aVal = sortField === 'publishedAt' ? new Date(a[sortField] || 0).getTime() : (parseFloat(a[sortField]) || 0);
            const bVal = sortField === 'publishedAt' ? new Date(b[sortField] || 0).getTime() : (parseFloat(b[sortField]) || 0);
            return bVal - aVal;
        });
        return result;
    }, [shorts, channelFilter, search, performanceTier, sortField]);

    const pageCount      = Math.ceil(filteredShorts.length / ITEMS_PER_PAGE);
    const paginatedShorts = filteredShorts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const stats = useMemo(() => ({
        total:      filteredShorts.length,
        totalViews: filteredShorts.reduce((s, v) => s + (v.viewCount || 0), 0),
        totalLikes: filteredShorts.reduce((s, v) => s + (v.likeCount || 0), 0),
        avgViews:   filteredShorts.length > 0 ? Math.round(filteredShorts.reduce((s, v) => s + (v.viewCount || 0), 0) / filteredShorts.length) : 0,
    }), [filteredShorts]);

    if (loading) {
        return (
            <Box>
                <Typography variant="h4" sx={{ mb: 3 }}>Shorts Explorer</Typography>
                <LinearProgress sx={{ mb: 3, borderRadius: 1 }} />
                <Grid container spacing={2}>
                    {[...Array(8)].map((_, i) => <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={i}><Skeleton variant="rounded" height={300} sx={{ borderRadius: 2 }} /></Grid>)}
                </Grid>
            </Box>
        );
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h4">Shorts Explorer</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                        {shorts.length} shorts across {channels.length} channels
                    </Typography>
                </Box>
                <Button variant="contained" onClick={loadAllShorts} size="small">Refresh</Button>
            </Box>

            {/* Summary */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                    { label: 'Shorts',       value: fmtNum(stats.total) },
                    { label: 'Total Views',  value: fmtNum(stats.totalViews) },
                    { label: 'Total Likes',  value: fmtNum(stats.totalLikes) },
                    { label: 'Avg Views',    value: fmtNum(stats.avgViews) },
                ].map((s, i) => (
                    <Grid key={i} size={{ xs: 6, sm: 3 }}>
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
                    <Grid size={{ xs: 12, sm: 3 }}>
                        <TextField fullWidth size="small" placeholder="Search shorts…"
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
                    <Grid size={{ xs: 12, sm: 3 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Sort By</InputLabel>
                            <Select value={sortField} label="Sort By" onChange={e => { setSortField(e.target.value); setPage(1); }}>
                                {SORT_OPTIONS.map(s => <MenuItem key={s.field} value={s.field}>{s.label}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                    Showing {paginatedShorts.length} of {filteredShorts.length} shorts
                </Typography>
            </MainCard>

            {/* Grid */}
            <Grid container spacing={2}>
                {paginatedShorts.map((v, i) => (
                    <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={`${v.videoId}-${i}`}>
                        <MainCard
                            content={false}
                            sx={{ cursor: 'pointer', overflow: 'hidden', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 6px 20px rgba(0,0,0,0.12)' } }}
                            onClick={() => window.open(`https://www.youtube.com/shorts/${v.videoId}`, '_blank', 'noopener')}
                        >
                            <Box sx={{ position: 'relative' }}>
                                <Box component="img" src={v.thumbnail}
                                    sx={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', display: 'block', bgcolor: GREY[200] }}
                                    onError={e => { e.target.style.display = 'none'; }}
                                />
                                <Chip icon={<Visibility sx={{ fontSize: '12px !important', color: '#fff !important' }} />}
                                    label={fmtNum(v.viewCount)} size="small"
                                    sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '0.68rem', fontWeight: 600, height: 20 }} />
                                <Chip label={fmtDuration(v.durationSeconds)} size="small"
                                    sx={{ position: 'absolute', bottom: 6, right: 6, bgcolor: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: '0.68rem', fontWeight: 600, height: 20 }} />
                            </Box>
                            <Box sx={{ p: 1.5 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.75rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                                    {v.title}
                                </Typography>
                                {channels.length > 1 && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{v.channelTitle}</Typography>
                                )}
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', color: 'text.secondary', fontSize: '0.7rem' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}><ThumbUpIcon sx={{ fontSize: 11 }} />{fmtNum(v.likeCount)}</Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}><CommentIcon sx={{ fontSize: 11 }} />{fmtNum(v.commentCount)}</Box>
                                    <Typography variant="caption" sx={{ ml: 'auto', fontSize: '0.65rem' }}>{timeAgo(v.publishedAt)}</Typography>
                                </Box>
                            </Box>
                        </MainCard>
                    </Grid>
                ))}
            </Grid>

            {filteredShorts.length === 0 && !loading && (
                <MainCard>
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                        <YouTube sx={{ fontSize: 56, color: GREY[300], mb: 2 }} />
                        <Typography variant="h5" color="text.secondary">No shorts found</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {accounts?.length === 0 ? 'Add a channel first' : 'Try adjusting your filters'}
                        </Typography>
                    </Box>
                </MainCard>
            )}

            {pageCount > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <Pagination count={pageCount} page={page} onChange={(_, p) => setPage(p)} shape="rounded" size="large" />
                </Box>
            )}
        </Box>
    );
}
