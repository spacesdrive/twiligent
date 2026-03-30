import React, { useState } from 'react';
import {
    Box, Typography, Grid, Card, CardContent, Button, TextField, Dialog,
    DialogTitle, DialogContent, DialogActions, IconButton, Avatar, Chip,
    LinearProgress, CircularProgress, InputAdornment, Tabs, Tab, Alert,
} from '@mui/material';
import {
    Add, Delete, Refresh, Search, YouTube, People, Visibility, VideoLibrary,
    Link as LinkIcon, CheckCircle, Instagram, Favorite, Photo, Key,
} from '@mui/icons-material';
import { api } from '../../services/api';
import { fmtNum, timeAgo } from '../../utils/formatters';

export default function AccountManager({ accounts, showToast, onRefresh }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogTab, setDialogTab] = useState(0); // 0 = YouTube, 1 = Instagram
    const [input, setInput] = useState('');
    const [igToken, setIgToken] = useState('');
    const [resolving, setResolving] = useState(false);
    const [resolved, setResolved] = useState(null);
    const [adding, setAdding] = useState(false);
    const [refreshingId, setRefreshingId] = useState(null);

    const handleResolve = async () => {
        if (!input.trim()) return;
        setResolving(true);
        setResolved(null);
        try {
            const res = await api.resolveChannel(input.trim());
            setResolved(res.data || res);
        } catch (err) {
            showToast('Could not resolve channel: ' + err.message, 'error');
        } finally {
            setResolving(false);
        }
    };

    const handleAdd = async () => {
        if (!input.trim()) return;
        setAdding(true);
        try {
            await api.addAccount(input.trim());
            showToast('Channel added successfully!', 'success');
            setDialogOpen(false);
            setInput('');
            setResolved(null);
            onRefresh();
        } catch (err) {
            showToast('Failed to add account: ' + err.message, 'error');
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.deleteAccount(id);
            showToast('Account removed', 'success');
            onRefresh();
        } catch (err) {
            showToast('Failed to delete: ' + err.message, 'error');
        }
    };

    const handleRefreshOne = async (id) => {
        setRefreshingId(id);
        try {
            await api.refreshAccount(id);
            showToast('Account refreshed', 'success');
            onRefresh();
        } catch (err) {
            showToast('Refresh failed: ' + err.message, 'error');
        } finally {
            setRefreshingId(null);
        }
    };

    const handleRefreshAll = async () => {
        setRefreshingId('all');
        try {
            await api.refreshAll();
            showToast('All accounts refreshed', 'success');
            onRefresh();
        } catch (err) {
            showToast('Refresh all failed: ' + err.message, 'error');
        } finally {
            setRefreshingId(null);
        }
    };

    const handleAddInstagram = async () => {
        if (!igToken.trim()) return;
        setAdding(true);
        try {
            await api.addInstagramAccount(igToken.trim());
            showToast('Instagram account added successfully!', 'success');
            setDialogOpen(false);
            setIgToken('');
            onRefresh();
        } catch (err) {
            showToast('Failed to add Instagram account: ' + err.message, 'error');
        } finally {
            setAdding(false);
        }
    };

    const closeDialog = () => {
        setDialogOpen(false);
        setResolved(null);
        setInput('');
        setIgToken('');
    };

    const ytAccounts = accounts.filter(a => a.platform !== 'instagram');
    const igAccounts = accounts.filter(a => a.platform === 'instagram');

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    Manage Accounts
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="outlined" startIcon={<Refresh />} onClick={handleRefreshAll}
                        disabled={refreshingId === 'all'} sx={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                        {refreshingId === 'all' ? 'Refreshing...' : 'Refresh All'}
                    </Button>
                    <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}
                        sx={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
                        Add Account
                    </Button>
                </Box>
            </Box>

            {accounts.length === 0 ? (
                <Card sx={{ p: 6, textAlign: 'center' }}>
                    <People sx={{ fontSize: 64, color: '#667eea', mb: 2 }} />
                    <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>No Accounts Added</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                        Add a YouTube channel or Instagram account to start tracking analytics.
                    </Typography>
                    <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}
                        sx={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
                        Add Your First Account
                    </Button>
                </Card>
            ) : (
                <>
                    {/* YouTube Accounts */}
                    {ytAccounts.length > 0 && (
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <YouTube sx={{ color: '#FF0000' }} /> YouTube Channels
                                <Chip label={ytAccounts.length} size="small" sx={{ fontSize: 12, height: 22, bgcolor: 'rgba(255,0,0,0.1)', color: '#FF4444' }} />
                            </Typography>
                            <Grid container spacing={2.5}>
                                {ytAccounts.map(acct => (
                                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={acct.id}>
                                        <Card sx={{ '&:hover': { transform: 'translateY(-2px)', transition: 'all 0.2s', borderColor: 'rgba(255,0,0,0.3)' } }}>
                                            <CardContent>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                                    <Avatar src={acct.thumbnail || acct.thumbnails?.default || acct.thumbnailUrl} sx={{ width: 56, height: 56, border: '2px solid rgba(255,0,0,0.2)' }}>
                                                        <YouTube />
                                                    </Avatar>
                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                        <Typography variant="subtitle1" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {acct.title || acct.channelId}
                                                        </Typography>
                                                        {acct.customUrl && (
                                                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{acct.customUrl}</Typography>
                                                        )}
                                                    </Box>
                                                </Box>
                                                <Grid container spacing={1} sx={{ mb: 2 }}>
                                                    <Grid size={4}>
                                                        <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'rgba(255,0,0,0.06)' }}>
                                                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Subscribers</Typography>
                                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{fmtNum(acct.subscriberCount)}</Typography>
                                                        </Box>
                                                    </Grid>
                                                    <Grid size={4}>
                                                        <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'rgba(62,166,255,0.06)' }}>
                                                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Views</Typography>
                                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{fmtNum(acct.viewCount)}</Typography>
                                                        </Box>
                                                    </Grid>
                                                    <Grid size={4}>
                                                        <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'rgba(76,175,80,0.06)' }}>
                                                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Videos</Typography>
                                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{fmtNum(acct.videoCount)}</Typography>
                                                        </Box>
                                                    </Grid>
                                                </Grid>
                                                {acct.lastUpdated && (
                                                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                                                        Last updated: {timeAgo(acct.lastUpdated)}
                                                    </Typography>
                                                )}
                                                <Box sx={{ display: 'flex', gap: 1 }}>
                                                    <Button size="small" startIcon={<Refresh />} onClick={() => handleRefreshOne(acct.id)}
                                                        disabled={refreshingId === acct.id} fullWidth variant="outlined"
                                                        sx={{ borderColor: 'rgba(255,255,255,0.1)', fontSize: 12 }}>
                                                        {refreshingId === acct.id ? 'Refreshing...' : 'Refresh'}
                                                    </Button>
                                                    <IconButton size="small" onClick={() => handleDelete(acct.id)}
                                                        sx={{ color: 'error.main', border: '1px solid rgba(255,0,0,0.2)', borderRadius: 2 }}>
                                                        <Delete fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    )}

                    {/* Instagram Accounts */}
                    {igAccounts.length > 0 && (
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Instagram sx={{ color: '#E1306C' }} /> Instagram Accounts
                                <Chip label={igAccounts.length} size="small" sx={{ fontSize: 12, height: 22, bgcolor: 'rgba(225,48,108,0.1)', color: '#E1306C' }} />
                            </Typography>
                            <Grid container spacing={2.5}>
                                {igAccounts.map(acct => (
                                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={acct.id}>
                                        <Card sx={{ '&:hover': { transform: 'translateY(-2px)', transition: 'all 0.2s', borderColor: 'rgba(225,48,108,0.3)' } }}>
                                            <CardContent>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                                    <Avatar src={acct.profilePictureUrl || acct.thumbnail} sx={{ width: 56, height: 56, border: '2px solid rgba(225,48,108,0.3)' }}>
                                                        <Instagram />
                                                    </Avatar>
                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                        <Typography variant="subtitle1" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {acct.title || acct.username || acct.igUsername}
                                                        </Typography>
                                                        {(acct.username || acct.igUsername) && (
                                                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>@{acct.username || acct.igUsername}</Typography>
                                                        )}
                                                    </Box>
                                                </Box>
                                                <Grid container spacing={1} sx={{ mb: 2 }}>
                                                    <Grid size={4}>
                                                        <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'rgba(225,48,108,0.06)' }}>
                                                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Followers</Typography>
                                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{fmtNum(acct.followersCount)}</Typography>
                                                        </Box>
                                                    </Grid>
                                                    <Grid size={4}>
                                                        <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'rgba(138,58,185,0.06)' }}>
                                                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Following</Typography>
                                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{fmtNum(acct.followsCount)}</Typography>
                                                        </Box>
                                                    </Grid>
                                                    <Grid size={4}>
                                                        <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'rgba(81,91,212,0.06)' }}>
                                                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Posts</Typography>
                                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{fmtNum(acct.mediaCount)}</Typography>
                                                        </Box>
                                                    </Grid>
                                                </Grid>
                                                {acct.lastUpdated && (
                                                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                                                        Last updated: {timeAgo(acct.lastUpdated)}
                                                    </Typography>
                                                )}
                                                <Box sx={{ display: 'flex', gap: 1 }}>
                                                    <Button size="small" startIcon={<Refresh />} onClick={() => handleRefreshOne(acct.id)}
                                                        disabled={refreshingId === acct.id} fullWidth variant="outlined"
                                                        sx={{ borderColor: 'rgba(255,255,255,0.1)', fontSize: 12 }}>
                                                        {refreshingId === acct.id ? 'Refreshing...' : 'Refresh'}
                                                    </Button>
                                                    <IconButton size="small" onClick={() => handleDelete(acct.id)}
                                                        sx={{ color: 'error.main', border: '1px solid rgba(255,0,0,0.2)', borderRadius: 2 }}>
                                                        <Delete fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    )}
                </>
            )}

            {/* Add Account Dialog */}
            <Dialog open={dialogOpen} onClose={closeDialog}
                maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#1A1A1A', backgroundImage: 'none' } }}>
                <DialogTitle sx={{ fontWeight: 700, pb: 0 }}>
                    Add Account
                </DialogTitle>
                <DialogContent>
                    <Tabs value={dialogTab} onChange={(_, v) => setDialogTab(v)} sx={{ mb: 2, mt: 1 }}
                        TabIndicatorProps={{ sx: { background: dialogTab === 0 ? '#FF0000' : 'linear-gradient(90deg, #F58529, #DD2A7B, #8134AF)' } }}>
                        <Tab icon={<YouTube sx={{ color: dialogTab === 0 ? '#FF0000' : 'text.secondary' }} />}
                            label="YouTube" iconPosition="start" sx={{ textTransform: 'none', fontWeight: 600 }} />
                        <Tab icon={<Instagram sx={{ color: dialogTab === 1 ? '#E1306C' : 'text.secondary' }} />}
                            label="Instagram" iconPosition="start" sx={{ textTransform: 'none', fontWeight: 600 }} />
                    </Tabs>

                    {dialogTab === 0 ? (
                        <>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                                Enter a YouTube channel URL, @handle, or channel ID.
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                <TextField fullWidth value={input} onChange={e => setInput(e.target.value)}
                                    placeholder="e.g. @MrBeast, https://youtube.com/@MrBeast, UCX6OQ3..."
                                    size="small" onKeyDown={e => e.key === 'Enter' && handleResolve()}
                                    slotProps={{
                                        input: {
                                            startAdornment: <InputAdornment position="start"><LinkIcon sx={{ color: 'text.secondary' }} /></InputAdornment>,
                                        }
                                    }} />
                                <Button variant="contained" onClick={handleResolve} disabled={resolving || !input.trim()}
                                    sx={{ background: 'linear-gradient(135deg, #FF0000, #FF4444)', minWidth: 100 }}>
                                    {resolving ? <CircularProgress size={20} /> : <Search />}
                                </Button>
                            </Box>
                            {resolving && <LinearProgress color="error" sx={{ mb: 2 }} />}
                            {resolved && (
                                <Card sx={{ bgcolor: 'rgba(76,175,80,0.05)', border: '1px solid rgba(76,175,80,0.2)' }}>
                                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, '&:last-child': { pb: 2 } }}>
                                        <Avatar src={resolved.thumbnails?.medium || resolved.thumbnails?.default} sx={{ width: 56, height: 56 }}>
                                            <YouTube />
                                        </Avatar>
                                        <Box sx={{ flex: 1 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{resolved.title}</Typography>
                                                <CheckCircle sx={{ fontSize: 18, color: '#4CAF50' }} />
                                            </Box>
                                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                {resolved.customUrl} {resolved.channelId && `• ${resolved.channelId}`}
                                            </Typography>
                                            {resolved.subscriberCount != null && (
                                                <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
                                                    <Chip label={`${fmtNum(resolved.subscriberCount)} subs`} size="small" sx={{ fontSize: 11, height: 22 }} />
                                                    <Chip label={`${fmtNum(resolved.videoCount)} videos`} size="small" sx={{ fontSize: 11, height: 22 }} />
                                                </Box>
                                            )}
                                        </Box>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    ) : (
                        <>
                            <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(81,91,212,0.08)', '& .MuiAlert-icon': { color: '#8134AF' } }}>
                                Paste your <b>Instagram Access Token</b> from the App Dashboard (Instagram &rarr; API setup &rarr; Generate Token).
                                Tokens from the dashboard are already long-lived (~60 days).
                            </Alert>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                                Your app needs the <b>instagram_business_basic</b> permission, and your Instagram account must be
                                a <b>Business</b> or <b>Creator</b> professional account.
                            </Typography>
                            <TextField fullWidth value={igToken} onChange={e => setIgToken(e.target.value)}
                                placeholder="Paste your Instagram access token here..."
                                size="small" multiline rows={3}
                                slotProps={{
                                    input: {
                                        startAdornment: <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1 }}><Key sx={{ color: 'text.secondary' }} /></InputAdornment>,
                                    }
                                }} />
                        </>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={closeDialog}>Cancel</Button>
                    {dialogTab === 0 ? (
                        <Button variant="contained" onClick={handleAdd} disabled={!input.trim() || adding}
                            sx={{ background: 'linear-gradient(135deg, #FF0000, #FF4444)' }}>
                            {adding ? <CircularProgress size={20} /> : 'Add Channel'}
                        </Button>
                    ) : (
                        <Button variant="contained" onClick={handleAddInstagram} disabled={!igToken.trim() || adding}
                            sx={{ background: 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)' }}>
                            {adding ? <CircularProgress size={20} /> : 'Add Instagram'}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </Box>
    );
}
