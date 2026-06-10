import React, { useState } from 'react';
import {
    Box, Typography, Grid, Button, TextField, Dialog,
    DialogTitle, DialogContent, DialogActions, IconButton, Avatar, Chip,
    LinearProgress, CircularProgress, InputAdornment, Tabs, Tab, Alert,
} from '@mui/material';
import {
    Add, Delete, Refresh, Search, YouTube, People, Visibility, VideoLibrary,
    Link as LinkIcon, CheckCircle, Instagram, Key,
} from '@mui/icons-material';
import MainCard from '../../components/MainCard';
import { useAppContext } from '../../context/AppContext';
import { api } from '../../services/api';
import { fmtNum, timeAgo } from '../../utils/formatters';
import { PRIMARY, GREY } from '../../themes/index';

export default function AccountManager() {
    const { accounts, showToast, loadAccounts } = useAppContext();
    const [dialogOpen,   setDialogOpen]   = useState(false);
    const [dialogTab,    setDialogTab]    = useState(0);
    const [input,        setInput]        = useState('');
    const [igToken,      setIgToken]      = useState('');
    const [resolving,    setResolving]    = useState(false);
    const [resolved,     setResolved]     = useState(null);
    const [adding,       setAdding]       = useState(false);
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
            showToast('Channel added successfully!');
            closeDialog();
            loadAccounts();
        } catch (err) {
            showToast('Failed to add account: ' + err.message, 'error');
        } finally {
            setAdding(false);
        }
    };

    const handleAddInstagram = async () => {
        if (!igToken.trim()) return;
        setAdding(true);
        try {
            await api.addInstagramAccount(igToken.trim());
            showToast('Instagram account added successfully!');
            closeDialog();
            loadAccounts();
        } catch (err) {
            showToast('Failed to add Instagram account: ' + err.message, 'error');
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.deleteAccount(id);
            showToast('Account removed');
            loadAccounts();
        } catch (err) {
            showToast('Failed to delete: ' + err.message, 'error');
        }
    };

    const handleRefreshOne = async (id) => {
        setRefreshingId(id);
        try {
            await api.refreshAccount(id);
            showToast('Account refreshed');
            loadAccounts();
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
            showToast('All accounts refreshed');
            loadAccounts();
        } catch (err) {
            showToast('Refresh all failed: ' + err.message, 'error');
        } finally {
            setRefreshingId(null);
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
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h4">Manage Accounts</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                        {ytAccounts.length} YouTube channels · {igAccounts.length} Instagram accounts
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="outlined"
                        startIcon={<Refresh />}
                        onClick={handleRefreshAll}
                        disabled={refreshingId === 'all'}
                        size="small"
                    >
                        {refreshingId === 'all' ? 'Refreshing…' : 'Refresh All'}
                    </Button>
                    <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)} size="small">
                        Add Account
                    </Button>
                </Box>
            </Box>

            {accounts.length === 0 ? (
                <MainCard>
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                        <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: PRIMARY.lighter, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                            <People sx={{ fontSize: 32, color: PRIMARY.main }} />
                        </Box>
                        <Typography variant="h5" sx={{ mb: 1 }}>No Accounts Added</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 360, mx: 'auto' }}>
                            Add a YouTube channel or Instagram account to start tracking analytics.
                        </Typography>
                        <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
                            Add Your First Account
                        </Button>
                    </Box>
                </MainCard>
            ) : (
                <>
                    {/* YouTube */}
                    {ytAccounts.length > 0 && (
                        <Box sx={{ mb: 4 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                <YouTube sx={{ color: '#ff4d4f', fontSize: 22 }} />
                                <Typography variant="h5">YouTube Channels</Typography>
                                <Chip label={ytAccounts.length} size="small" sx={{ bgcolor: '#fff1f0', color: '#ff4d4f', fontWeight: 600, fontSize: '0.72rem', height: 20 }} />
                            </Box>
                            <Grid container spacing={2.5}>
                                {ytAccounts.map(acct => (
                                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={acct.id}>
                                        <MainCard sx={{ transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.1)' } }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                                <Avatar src={acct.thumbnail || acct.thumbnails?.default || acct.thumbnailUrl} sx={{ width: 48, height: 48, bgcolor: '#fff1f0' }}>
                                                    <YouTube sx={{ color: '#ff4d4f' }} />
                                                </Avatar>
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600 }}>{acct.title || acct.channelId}</Typography>
                                                    {acct.customUrl && <Typography variant="caption" color="text.secondary">{acct.customUrl}</Typography>}
                                                </Box>
                                            </Box>
                                            <Grid container spacing={1} sx={{ mb: 2 }}>
                                                {[
                                                    { label: 'Subscribers', value: fmtNum(acct.subscriberCount), bg: '#fff1f0' },
                                                    { label: 'Views',       value: fmtNum(acct.viewCount),       bg: '#e6f4ff' },
                                                    { label: 'Videos',      value: fmtNum(acct.videoCount),      bg: '#f6ffed' },
                                                ].map(m => (
                                                    <Grid size={4} key={m.label}>
                                                        <Box sx={{ textAlign: 'center', p: 1, borderRadius: 1.5, bgcolor: m.bg }}>
                                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>{m.label}</Typography>
                                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{m.value}</Typography>
                                                        </Box>
                                                    </Grid>
                                                ))}
                                            </Grid>
                                            {acct.lastUpdated && (
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                                                    Updated {timeAgo(acct.lastUpdated)}
                                                </Typography>
                                            )}
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                <Button size="small" variant="outlined" startIcon={<Refresh />} fullWidth
                                                    onClick={() => handleRefreshOne(acct.id)} disabled={refreshingId === acct.id}>
                                                    {refreshingId === acct.id ? 'Refreshing…' : 'Refresh'}
                                                </Button>
                                                <IconButton size="small" onClick={() => handleDelete(acct.id)}
                                                    sx={{ color: 'error.main', border: `1px solid`, borderColor: 'error.light', borderRadius: 1.5, px: 1 }}>
                                                    <Delete sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            </Box>
                                        </MainCard>
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    )}

                    {/* Instagram */}
                    {igAccounts.length > 0 && (
                        <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                <Instagram sx={{ color: '#E1306C', fontSize: 22 }} />
                                <Typography variant="h5">Instagram Accounts</Typography>
                                <Chip label={igAccounts.length} size="small" sx={{ bgcolor: '#fff0f6', color: '#c41d7f', fontWeight: 600, fontSize: '0.72rem', height: 20 }} />
                            </Box>
                            <Grid container spacing={2.5}>
                                {igAccounts.map(acct => (
                                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={acct.id}>
                                        <MainCard sx={{ transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.1)' } }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                                <Avatar src={acct.profilePictureUrl || acct.thumbnail} sx={{ width: 48, height: 48, bgcolor: '#fff0f6' }}>
                                                    <Instagram sx={{ color: '#E1306C' }} />
                                                </Avatar>
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600 }}>{acct.title || acct.username}</Typography>
                                                    {(acct.username || acct.igUsername) && (
                                                        <Typography variant="caption" color="text.secondary">@{acct.username || acct.igUsername}</Typography>
                                                    )}
                                                </Box>
                                            </Box>
                                            <Grid container spacing={1} sx={{ mb: 2 }}>
                                                {[
                                                    { label: 'Followers',  value: fmtNum(acct.followersCount), bg: '#fff0f6' },
                                                    { label: 'Following',  value: fmtNum(acct.followsCount),   bg: '#f9f0ff' },
                                                    { label: 'Posts',      value: fmtNum(acct.mediaCount),     bg: '#f6ffed' },
                                                ].map(m => (
                                                    <Grid size={4} key={m.label}>
                                                        <Box sx={{ textAlign: 'center', p: 1, borderRadius: 1.5, bgcolor: m.bg }}>
                                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>{m.label}</Typography>
                                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{m.value}</Typography>
                                                        </Box>
                                                    </Grid>
                                                ))}
                                            </Grid>
                                            {acct.lastUpdated && (
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                                                    Updated {timeAgo(acct.lastUpdated)}
                                                </Typography>
                                            )}
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                <Button size="small" variant="outlined" startIcon={<Refresh />} fullWidth
                                                    onClick={() => handleRefreshOne(acct.id)} disabled={refreshingId === acct.id}>
                                                    {refreshingId === acct.id ? 'Refreshing…' : 'Refresh'}
                                                </Button>
                                                <IconButton size="small" onClick={() => handleDelete(acct.id)}
                                                    sx={{ color: 'error.main', border: '1px solid', borderColor: 'error.light', borderRadius: 1.5, px: 1 }}>
                                                    <Delete sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            </Box>
                                        </MainCard>
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    )}
                </>
            )}

            {/* Add Account Dialog */}
            <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Add Account</DialogTitle>
                <DialogContent>
                    <Tabs value={dialogTab} onChange={(_, v) => setDialogTab(v)} sx={{ mb: 2, mt: 0.5 }}>
                        <Tab icon={<YouTube sx={{ fontSize: 18 }} />} label="YouTube" iconPosition="start" />
                        <Tab icon={<Instagram sx={{ fontSize: 18 }} />} label="Instagram" iconPosition="start" />
                    </Tabs>

                    {dialogTab === 0 ? (
                        <>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Enter a YouTube channel URL, @handle, or channel ID.
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                <TextField fullWidth value={input} onChange={e => setInput(e.target.value)}
                                    placeholder="e.g. @MrBeast, https://youtube.com/@MrBeast, UCX6…"
                                    size="small" onKeyDown={e => e.key === 'Enter' && handleResolve()}
                                    slotProps={{ input: { startAdornment: <InputAdornment position="start"><LinkIcon sx={{ color: 'text.secondary', fontSize: 18 }} /></InputAdornment> } }} />
                                <Button variant="contained" onClick={handleResolve} disabled={resolving || !input.trim()} sx={{ minWidth: 90 }}>
                                    {resolving ? <CircularProgress size={18} color="inherit" /> : <Search />}
                                </Button>
                            </Box>
                            {resolving && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
                            {resolved && (
                                <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#f6ffed', border: '1px solid #b7eb8f', display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Avatar src={resolved.thumbnails?.medium || resolved.thumbnails?.default} sx={{ width: 48, height: 48, bgcolor: '#d9f7be' }}>
                                        <YouTube sx={{ color: '#52c41a' }} />
                                    </Avatar>
                                    <Box sx={{ flex: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{resolved.title}</Typography>
                                            <CheckCircle sx={{ fontSize: 16, color: '#52c41a' }} />
                                        </Box>
                                        <Typography variant="caption" color="text.secondary">{resolved.customUrl}</Typography>
                                        {resolved.subscriberCount != null && (
                                            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                                                <Chip label={`${fmtNum(resolved.subscriberCount)} subs`} size="small" sx={{ fontSize: '0.7rem', height: 20 }} />
                                                <Chip label={`${fmtNum(resolved.videoCount)} videos`}    size="small" sx={{ fontSize: '0.7rem', height: 20 }} />
                                            </Box>
                                        )}
                                    </Box>
                                </Box>
                            )}
                        </>
                    ) : (
                        <>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Paste your <b>Instagram Access Token</b> from the App Dashboard. Your account must be a <b>Business</b> or <b>Creator</b> account.
                            </Alert>
                            <TextField fullWidth value={igToken} onChange={e => setIgToken(e.target.value)}
                                placeholder="Paste your Instagram access token here…"
                                size="small" multiline rows={3}
                                slotProps={{ input: { startAdornment: <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1 }}><Key sx={{ color: 'text.secondary', fontSize: 18 }} /></InputAdornment> } }} />
                        </>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={closeDialog} color="inherit">Cancel</Button>
                    {dialogTab === 0 ? (
                        <Button variant="contained" onClick={handleAdd} disabled={!input.trim() || adding}>
                            {adding ? <CircularProgress size={18} color="inherit" /> : 'Add Channel'}
                        </Button>
                    ) : (
                        <Button variant="contained" onClick={handleAddInstagram} disabled={!igToken.trim() || adding}
                            sx={{ bgcolor: '#c41d7f', '&:hover': { bgcolor: '#9e1068' } }}>
                            {adding ? <CircularProgress size={18} color="inherit" /> : 'Add Instagram'}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </Box>
    );
}
