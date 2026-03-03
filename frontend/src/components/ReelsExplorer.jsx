import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, TextField, InputAdornment,
    Select, MenuItem, FormControl, InputLabel, Chip, LinearProgress,
    Avatar, Button, Pagination, Skeleton,
} from '@mui/material';
import {
    Search, Visibility, FavoriteBorder, ChatBubbleOutline, PlayCircleOutline,
    Instagram, MovieFilter, Photo, Collections, ViewCarousel,
} from '@mui/icons-material';
import { api } from '../services/api';
import { fmtNum, fmtDate, timeAgo } from '../utils/formatters';

const ITEMS_PER_PAGE = 24;

const MEDIA_TYPE_FILTER = [
    { label: 'All Types', value: 'all' },
    { label: 'Reels', value: 'REEL' },
    { label: 'Videos', value: 'VIDEO' },
    { label: 'Photos', value: 'IMAGE' },
    { label: 'Carousels', value: 'CAROUSEL_ALBUM' },
];

const MEDIA_TYPE_META = {
    REEL: { label: 'Reel', color: '#E1306C', icon: <MovieFilter sx={{ fontSize: '13px !important', color: '#fff !important' }} /> },
    VIDEO: { label: 'Video', color: '#833AB4', icon: <PlayCircleOutline sx={{ fontSize: '13px !important', color: '#fff !important' }} /> },
    IMAGE: { label: 'Photo', color: '#F77737', icon: <Photo sx={{ fontSize: '13px !important', color: '#fff !important' }} /> },
    CAROUSEL_ALBUM: { label: 'Carousel', color: '#405DE6', icon: <ViewCarousel sx={{ fontSize: '13px !important', color: '#fff !important' }} /> },
};

const PERFORMANCE_TIERS = [
    { label: 'All', value: 'all' },
    { label: 'Viral (>100K)', value: 'viral', min: 100000 },
    { label: 'High (10K–100K)', value: 'high', min: 10000, max: 100000 },
    { label: 'Medium (1K–10K)', value: 'medium', min: 1000, max: 10000 },
    { label: 'Low (<1K)', value: 'low', max: 1000 },
];

const SORT_OPTIONS = [
    { label: 'Most Liked', field: 'likeCount' },
    { label: 'Most Comments', field: 'commentsCount' },
    { label: 'Best Engagement', field: 'engagementRate' },
    { label: 'Newest First', field: 'timestamp' },
];

export default function ReelsExplorer({ accounts, showToast }) {
    const [media, setMedia] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [accountFilter, setAccountFilter] = useState('all');
    const [mediaTypeFilter, setMediaTypeFilter] = useState('all');
    const [performanceTier, setPerformanceTier] = useState('all');
    const [sortField, setSortField] = useState('likeCount');
    const [page, setPage] = useState(1);
    const [igAccounts, setIgAccounts] = useState([]);

    useEffect(() => {
        loadAllMedia();
    }, [accounts]);

    const loadAllMedia = async () => {
        setLoading(true);
        try {
            const allMedia = [];
            const acctList = [];
            const igAccts = (accounts || []).filter(a => a.platform === 'instagram');
            for (const acct of igAccts) {
                try {
                    const res = await api.getIGMedia(acct.id);
                    const items = res.media || [];
                    const acctName = acct.title || acct.username || acct.name || 'Unknown';
                    acctList.push({
                        id: acct.id,
                        title: acctName,
                        thumbnail: acct.profilePictureUrl || acct.thumbnailUrl || '',
                    });
                    for (const m of items) {
                        const likes = m.likeCount || 0;
                        const comments = m.commentsCount || 0;
                        const total = likes + comments;
                        allMedia.push({
                            ...m,
                            accountName: acctName,
                            accountId: acct.id,
                            accountThumbnail: acct.profilePictureUrl || acct.thumbnailUrl || '',
                            engagementRate: total > 0 ? total : 0,
                        });
                    }
                } catch (e) {
                    console.warn(`Failed to load media for IG account ${acct.id}:`, e.message);
                }
            }
            setMedia(allMedia);
            setIgAccounts(acctList);
        } catch (err) {
            showToast('Failed to load media: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const filteredMedia = useMemo(() => {
        let result = [...media];

        if (accountFilter !== 'all') result = result.filter(r => r.accountId === accountFilter);

        if (mediaTypeFilter !== 'all') result = result.filter(r => r.mediaType === mediaTypeFilter);

        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(r => r.caption?.toLowerCase().includes(q));
        }

        if (performanceTier !== 'all') {
            const tier = PERFORMANCE_TIERS.find(t => t.value === performanceTier);
            if (tier) {
                if (tier.min != null) result = result.filter(r => (r.likeCount || 0) >= tier.min);
                if (tier.max != null) result = result.filter(r => (r.likeCount || 0) < tier.max);
            }
        }

        result.sort((a, b) => {
            const aVal = sortField === 'timestamp' ? new Date(a[sortField] || 0).getTime() : (parseFloat(a[sortField]) || 0);
            const bVal = sortField === 'timestamp' ? new Date(b[sortField] || 0).getTime() : (parseFloat(b[sortField]) || 0);
            return bVal - aVal;
        });

        return result;
    }, [media, accountFilter, mediaTypeFilter, search, performanceTier, sortField]);

    const pageCount = Math.ceil(filteredMedia.length / ITEMS_PER_PAGE);
    const paginatedMedia = filteredMedia.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const stats = useMemo(() => {
        const total = filteredMedia.length;
        const totalLikes = filteredMedia.reduce((s, r) => s + (r.likeCount || 0), 0);
        const totalComments = filteredMedia.reduce((s, r) => s + (r.commentsCount || 0), 0);
        const avgLikes = total > 0 ? Math.round(totalLikes / total) : 0;
        const reels = filteredMedia.filter(m => m.mediaType === 'REEL' || m.mediaType === 'VIDEO').length;
        const photos = filteredMedia.filter(m => m.mediaType === 'IMAGE').length;
        const carousels = filteredMedia.filter(m => m.mediaType === 'CAROUSEL_ALBUM').length;
        return { total, totalLikes, totalComments, avgLikes, reels, photos, carousels };
    }, [filteredMedia]);

    const openOnInstagram = (permalink) => {
        if (permalink) window.open(permalink, '_blank', 'noopener');
    };

    if (loading) {
        return (
            <Box>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
                    <Instagram sx={{ verticalAlign: 'middle', mr: 1, color: '#E1306C', fontSize: 36 }} />
                    IG Content Explorer
                </Typography>
                <LinearProgress sx={{ mb: 3, '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #833AB4, #E1306C, #F77737)' } }} />
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
                    <Instagram sx={{ verticalAlign: 'middle', mr: 1, color: '#E1306C', fontSize: 36 }} />
                    IG Content Explorer
                </Typography>
                <Button variant="contained" onClick={loadAllMedia}
                    sx={{ background: 'linear-gradient(135deg, #833AB4, #E1306C, #F77737)' }}>
                    Refresh All
                </Button>
            </Box>

            {/* Summary Stats */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 6, sm: 2 }}>
                    <Card sx={{ textAlign: 'center', p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">Total Posts</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>{fmtNum(stats.total)}</Typography>
                    </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}>
                    <Card sx={{ textAlign: 'center', p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">Reels</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#E1306C' }}>{fmtNum(stats.reels)}</Typography>
                    </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}>
                    <Card sx={{ textAlign: 'center', p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">Photos</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#F77737' }}>{fmtNum(stats.photos)}</Typography>
                    </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}>
                    <Card sx={{ textAlign: 'center', p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">Total Likes</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#E1306C' }}>{fmtNum(stats.totalLikes)}</Typography>
                    </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}>
                    <Card sx={{ textAlign: 'center', p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">Total Comments</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#833AB4' }}>{fmtNum(stats.totalComments)}</Typography>
                    </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}>
                    <Card sx={{ textAlign: 'center', p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">Avg Likes</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#F77737' }}>{fmtNum(stats.avgLikes)}</Typography>
                    </Card>
                </Grid>
            </Grid>

            {/* Filters */}
            <Card sx={{ mb: 3, p: 2 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12, sm: 2.4 }}>
                        <TextField fullWidth size="small" placeholder="Search posts..."
                            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary' }} /></InputAdornment> } }}
                        />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 2.4 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Media Type</InputLabel>
                            <Select value={mediaTypeFilter} label="Media Type"
                                onChange={(e) => { setMediaTypeFilter(e.target.value); setPage(1); }}>
                                {MEDIA_TYPE_FILTER.map(t => (
                                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 2.4 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Account</InputLabel>
                            <Select value={accountFilter} label="Account"
                                onChange={(e) => { setAccountFilter(e.target.value); setPage(1); }}>
                                <MenuItem value="all">All Accounts ({igAccounts.length})</MenuItem>
                                {igAccounts.map(a => (
                                    <MenuItem key={a.id} value={a.id}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {a.thumbnail && <Avatar src={a.thumbnail} sx={{ width: 20, height: 20 }} />}
                                            {a.title}
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 2.4 }}>
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
                    <Grid size={{ xs: 6, sm: 2.4 }}>
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
                        Showing {paginatedMedia.length} of {filteredMedia.length} posts
                        {mediaTypeFilter !== 'all' && ` • Type: ${MEDIA_TYPE_FILTER.find(t => t.value === mediaTypeFilter)?.label}`}
                        {accountFilter !== 'all' && ` • Account: ${igAccounts.find(a => a.id === accountFilter)?.title}`}
                        {performanceTier !== 'all' && ` • ${PERFORMANCE_TIERS.find(t => t.value === performanceTier)?.label}`}
                    </Typography>
                </Box>
            </Card>

            {/* Media Grid */}
            <Grid container spacing={2}>
                {paginatedMedia.map((r, i) => {
                    const isVideo = r.mediaType === 'REEL' || r.mediaType === 'VIDEO';
                    const typeMeta = MEDIA_TYPE_META[r.mediaType] || MEDIA_TYPE_META.IMAGE;
                    return (
                        <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={`${r.id}-${i}`}>
                            <Card sx={{
                                cursor: 'pointer', borderRadius: 3, overflow: 'hidden',
                                '&:hover': { transform: 'translateY(-4px)', transition: 'all 0.2s', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' },
                            }} onClick={() => openOnInstagram(r.permalink)}>
                                <Box sx={{ position: 'relative' }}>
                                    <Box component="img" src={r.thumbnailUrl || r.mediaUrl}
                                        sx={{ width: '100%', aspectRatio: isVideo ? '9/16' : '1/1', objectFit: 'cover', display: 'block', bgcolor: '#222' }}
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                    {/* Play overlay for videos/reels */}
                                    {isVideo && (
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
                                    )}
                                    {/* Likes badge */}
                                    <Chip icon={<FavoriteBorder sx={{ fontSize: '13px !important', color: '#fff !important' }} />}
                                        label={fmtNum(r.likeCount)} size="small"
                                        sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 11, fontWeight: 600, height: 22 }} />
                                    {/* Media type badge */}
                                    <Chip icon={typeMeta.icon}
                                        label={typeMeta.label} size="small"
                                        sx={{ position: 'absolute', bottom: 6, right: 6, bgcolor: `${typeMeta.color}dd`, color: '#fff', fontSize: 11, fontWeight: 600, height: 22 }} />
                                </Box>
                                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                    <Typography variant="body2" sx={{
                                        fontWeight: 600, mb: 0.5, fontSize: 12,
                                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4,
                                    }}>
                                        {r.caption || 'No caption'}
                                    </Typography>
                                    {igAccounts.length > 1 && (
                                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontSize: 11 }}>
                                            {r.accountName}
                                        </Typography>
                                    )}
                                    <Box sx={{ display: 'flex', gap: 1, fontSize: 11, color: 'text.secondary', alignItems: 'center' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                            <FavoriteBorder sx={{ fontSize: 12 }} /> {fmtNum(r.likeCount)}
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                            <ChatBubbleOutline sx={{ fontSize: 12 }} /> {fmtNum(r.commentsCount)}
                                        </Box>
                                        <Box sx={{ ml: 'auto', fontSize: 10 }}>{timeAgo(r.timestamp)}</Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    );
                })}
            </Grid>

            {/* Pagination */}
            {pageCount > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <Pagination count={pageCount} page={page} onChange={(_, p) => setPage(p)}
                        sx={{ '& .Mui-selected': { background: 'linear-gradient(135deg, #833AB4, #E1306C) !important', color: '#fff' } }}
                        shape="rounded" size="large" />
                </Box>
            )}

            {/* Empty state */}
            {filteredMedia.length === 0 && !loading && (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                    <Instagram sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">No posts found</Typography>
                    <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
                        {(accounts || []).filter(a => a.platform === 'instagram').length === 0
                            ? 'Add an Instagram account first to explore content'
                            : 'Try adjusting your filters or search query'}
                    </Typography>
                </Box>
            )}
        </Box>
    );
}
