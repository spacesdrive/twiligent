import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Grid, Button, TextField,
    InputAdornment, IconButton, Chip, Divider, Alert, CircularProgress,
} from '@mui/material';
import {
    Key, Save, Visibility, VisibilityOff, CheckCircle,
    Refresh, Info, GitHub, Code, Instagram, Cloud, Sync,
} from '@mui/icons-material';
import MainCard from '../../components/MainCard';
import { useAppContext } from '../../context/AppContext';
import { api } from '../../services/api';
import { PRIMARY } from '../../themes/index';

export default function Settings() {
    const { showToast, refreshAll } = useAppContext();

    const [apiKey,            setApiKey]            = useState('');
    const [igAppId,           setIgAppId]           = useState('');
    const [igAppSecret,       setIgAppSecret]       = useState('');
    const [cloudinaryName,    setCloudinaryName]    = useState('');
    const [cloudinaryPreset,  setCloudinaryPreset]  = useState('');
    const [githubToken,       setGithubToken]       = useState('');
    const [githubRepo,        setGithubRepo]        = useState('');
    const [githubBranch,      setGithubBranch]      = useState('main');
    const [showKey,           setShowKey]           = useState(false);
    const [showIgSecret,      setShowIgSecret]      = useState(false);
    const [showGhToken,       setShowGhToken]       = useState(false);
    const [saving,            setSaving]            = useState(false);
    const [savingIg,          setSavingIg]          = useState(false);
    const [savingCloud,       setSavingCloud]       = useState(false);
    const [savingGh,          setSavingGh]          = useState(false);
    const [syncingGh,         setSyncingGh]         = useState(false);
    const [testing,           setTesting]           = useState(false);
    const [testResult,        setTestResult]        = useState(null);
    const [loading,           setLoading]           = useState(true);

    useEffect(() => { loadKeys(); }, []);

    const loadKeys = async () => {
        setLoading(true);
        try {
            const res = await api.getKeys();
            setApiKey(res.youtube || '');
            if (res.instagram) { setIgAppId(res.instagram.appId || ''); setIgAppSecret(res.instagram.appSecret || ''); }
            if (res.cloudinary) { setCloudinaryName(res.cloudinary.cloudName || ''); setCloudinaryPreset(res.cloudinary.uploadPreset || ''); }
            if (res.github) { setGithubToken(res.github.token || ''); setGithubRepo(res.github.repo || ''); setGithubBranch(res.github.branch || 'main'); }
        } catch (err) {
            showToast('Failed to load API keys', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try { await api.saveKey(apiKey); showToast('API key saved successfully', 'success'); }
        catch (err) { showToast('Failed to save API key: ' + err.message, 'error'); }
        finally { setSaving(false); }
    };

    const handleTest = async () => {
        setTesting(true); setTestResult(null);
        try {
            const res = await api.health();
            setTestResult({ success: res.status === 'ok', message: res.status === 'ok' ? 'API connection successful!' : 'Unexpected status.' });
        } catch (err) {
            setTestResult({ success: false, message: 'Connection failed: ' + err.message });
        } finally { setTesting(false); }
    };

    const handleSaveInstagram = async () => {
        setSavingIg(true);
        try { await api.saveKeys({ instagram: { appId: igAppId, appSecret: igAppSecret } }); showToast('Instagram credentials saved successfully', 'success'); }
        catch (err) { showToast('Failed to save Instagram credentials: ' + err.message, 'error'); }
        finally { setSavingIg(false); }
    };

    const handleSaveCloudinary = async () => {
        setSavingCloud(true);
        try { await api.saveKeys({ cloudinary: { cloudName: cloudinaryName, uploadPreset: cloudinaryPreset } }); showToast('Cloudinary settings saved successfully', 'success'); }
        catch (err) { showToast('Failed to save Cloudinary settings: ' + err.message, 'error'); }
        finally { setSavingCloud(false); }
    };

    const handleSaveGitHub = async () => {
        setSavingGh(true);
        try { await api.saveKeys({ github: { token: githubToken, repo: githubRepo, branch: githubBranch } }); showToast('GitHub Actions settings saved successfully', 'success'); }
        catch (err) { showToast('Failed to save GitHub settings: ' + err.message, 'error'); }
        finally { setSavingGh(false); }
    };

    const handleSyncGitHub = async () => {
        setSyncingGh(true);
        try { await api.syncToGitHub(); showToast('Scheduled posts synced to GitHub', 'success'); }
        catch (err) { showToast('Sync failed: ' + err.message, 'error'); }
        finally { setSyncingGh(false); }
    };

    const masked = (val, start = 8, end = 4) =>
        val ? val.substring(0, start) + '•'.repeat(Math.max(0, val.length - start - end)) + val.substring(val.length - end) : '';

    return (
        <Box>
            <Typography variant="h4" sx={{ mb: 3 }}>Settings</Typography>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 8 }}>

                    {/* YouTube API Key */}
                    <MainCard title="YouTube Data API Key" sx={{ mb: 3 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                            Required to fetch YouTube channel and video data. Get your key from the{' '}
                            <Box component="a" href="https://console.cloud.google.com/apis/credentials" target="_blank"
                                sx={{ color: PRIMARY.main, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                                Google Cloud Console
                            </Box>.
                        </Typography>
                        <TextField fullWidth value={showKey ? apiKey : masked(apiKey)}
                            onChange={e => setApiKey(e.target.value)}
                            placeholder="AIzaSy…" size="small"
                            onFocus={() => setShowKey(true)}
                            slotProps={{
                                input: {
                                    startAdornment: <InputAdornment position="start"><Key sx={{ color: 'text.secondary' }} /></InputAdornment>,
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton size="small" onClick={() => setShowKey(!showKey)}>
                                                {showKey ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }
                            }}
                            sx={{ mb: 2 }}
                        />
                        <Box sx={{ display: 'flex', gap: 1.5 }}>
                            <Button variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                                onClick={handleSave} disabled={saving || !apiKey.trim()}>
                                Save Key
                            </Button>
                            <Button variant="outlined" startIcon={testing ? <CircularProgress size={16} /> : <CheckCircle />}
                                onClick={handleTest} disabled={testing}>
                                Test Connection
                            </Button>
                        </Box>
                        {testResult && (
                            <Alert severity={testResult.success ? 'success' : 'error'} sx={{ mt: 2 }}>
                                {testResult.message}
                            </Alert>
                        )}
                    </MainCard>

                    {/* Instagram Credentials */}
                    <MainCard title="Instagram App Credentials" sx={{ mb: 3 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                            Optional — enables long-lived token exchange (~60 days). Get these from{' '}
                            <Box component="a" href="https://developers.facebook.com/apps/" target="_blank"
                                sx={{ color: '#E1306C', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                                App Dashboard → Instagram → API setup with Instagram login
                            </Box>.
                        </Typography>
                        <TextField fullWidth value={igAppId} onChange={e => setIgAppId(e.target.value)}
                            placeholder="Instagram App ID from App Dashboard" size="small" label="Instagram App ID"
                            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Code sx={{ color: 'text.secondary' }} /></InputAdornment> } }}
                            sx={{ mb: 2 }} />
                        <TextField fullWidth value={showIgSecret ? igAppSecret : masked(igAppSecret, 6)}
                            onChange={e => setIgAppSecret(e.target.value)}
                            placeholder="Instagram App Secret from App Dashboard" size="small" label="Instagram App Secret"
                            onFocus={() => setShowIgSecret(true)}
                            slotProps={{
                                input: {
                                    startAdornment: <InputAdornment position="start"><Key sx={{ color: 'text.secondary' }} /></InputAdornment>,
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton size="small" onClick={() => setShowIgSecret(!showIgSecret)}>
                                                {showIgSecret ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }
                            }}
                            sx={{ mb: 2 }} />
                        <Button variant="contained" startIcon={savingIg ? <CircularProgress size={16} color="inherit" /> : <Save />}
                            onClick={handleSaveInstagram} disabled={savingIg || (!igAppId.trim() && !igAppSecret.trim())}>
                            Save Instagram Credentials
                        </Button>
                        <Alert severity="info" sx={{ mt: 2 }}>
                            Only the <strong>Instagram App Secret</strong> is needed for token exchange. You can add accounts
                            without credentials — tokens from the App Dashboard are already long-lived (60 days).
                        </Alert>
                    </MainCard>

                    {/* Cloudinary */}
                    <MainCard title="Cloudinary CDN (for Instagram Uploads)" sx={{ mb: 3 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                            Instagram API requires media at a public URL. Cloudinary is used to host your files before publishing.
                            Get a free account at{' '}
                            <Box component="a" href="https://cloudinary.com/users/register_free" target="_blank"
                                sx={{ color: '#3448C5', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                                cloudinary.com
                            </Box>. Use an <strong>unsigned upload preset</strong>.
                        </Typography>
                        <TextField fullWidth value={cloudinaryName} onChange={e => setCloudinaryName(e.target.value)}
                            placeholder="e.g. my-cloud-name" size="small" label="Cloud Name"
                            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Cloud sx={{ color: 'text.secondary' }} /></InputAdornment> } }}
                            sx={{ mb: 2 }} />
                        <TextField fullWidth value={cloudinaryPreset} onChange={e => setCloudinaryPreset(e.target.value)}
                            placeholder="e.g. ml_default (unsigned preset)" size="small" label="Upload Preset (unsigned)"
                            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Code sx={{ color: 'text.secondary' }} /></InputAdornment> } }}
                            sx={{ mb: 2 }} />
                        <Button variant="contained" startIcon={savingCloud ? <CircularProgress size={16} color="inherit" /> : <Save />}
                            onClick={handleSaveCloudinary} disabled={savingCloud || !cloudinaryName.trim()}>
                            Save Cloudinary Settings
                        </Button>
                        <Alert severity="info" sx={{ mt: 2 }}>
                            Create an <strong>unsigned upload preset</strong> in Cloudinary → Settings → Upload → Upload presets → Add.
                        </Alert>
                    </MainCard>

                    {/* GitHub Actions */}
                    <MainCard title="GitHub Actions (Cloud Scheduling)" sx={{ mb: 3 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                            Publish scheduled posts from the cloud — even when your PC is off. Runs every 15 min via GitHub Actions (free).
                            Create a{' '}
                            <Box component="a" href="https://github.com/settings/tokens?type=beta" target="_blank"
                                sx={{ color: PRIMARY.main, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                                Fine-grained Personal Access Token
                            </Box>{' '}
                            with <strong>Contents: Read & Write</strong> permission.
                        </Typography>
                        <TextField fullWidth value={showGhToken ? githubToken : masked(githubToken)}
                            onChange={e => setGithubToken(e.target.value)}
                            placeholder="ghp_xxxxxxxxxxxx" size="small" label="GitHub Personal Access Token"
                            onFocus={() => setShowGhToken(true)}
                            slotProps={{
                                input: {
                                    startAdornment: <InputAdornment position="start"><Key sx={{ color: 'text.secondary' }} /></InputAdornment>,
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton size="small" onClick={() => setShowGhToken(!showGhToken)}>
                                                {showGhToken ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }
                            }}
                            sx={{ mb: 2 }} />
                        <TextField fullWidth value={githubRepo} onChange={e => setGithubRepo(e.target.value)}
                            placeholder="username/repo-name" size="small" label="Repository (owner/repo)"
                            slotProps={{ input: { startAdornment: <InputAdornment position="start"><GitHub sx={{ color: 'text.secondary' }} /></InputAdornment> } }}
                            sx={{ mb: 2 }} />
                        <TextField fullWidth value={githubBranch} onChange={e => setGithubBranch(e.target.value)}
                            placeholder="main" size="small" label="Branch"
                            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Code sx={{ color: 'text.secondary' }} /></InputAdornment> } }}
                            sx={{ mb: 2 }} />
                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                            <Button variant="contained" startIcon={savingGh ? <CircularProgress size={16} color="inherit" /> : <Save />}
                                onClick={handleSaveGitHub} disabled={savingGh || !githubToken.trim() || !githubRepo.trim()}>
                                Save GitHub Settings
                            </Button>
                            <Button variant="outlined" startIcon={syncingGh ? <CircularProgress size={16} /> : <Sync />}
                                onClick={handleSyncGitHub} disabled={syncingGh || !githubToken.trim() || !githubRepo.trim()}>
                                Sync Now
                            </Button>
                        </Box>
                        <Alert severity="info" sx={{ mt: 2 }}>
                            <strong>Setup steps:</strong><br />
                            1. Push this project to a GitHub repo<br />
                            2. Go to repo → Settings → Secrets → Actions → New Secret<br />
                            3. Add secret <code>ACCOUNTS_JSON</code> with the Base64 of your <code>accounts.json</code><br />
                            4. The workflow runs every 15 min automatically
                        </Alert>
                    </MainCard>

                    {/* How to get API keys */}
                    <MainCard title="How to Get a YouTube API Key">
                        <Box component="ol" sx={{ pl: 2, color: 'text.secondary', '& li': { mb: 1.5, lineHeight: 1.6 } }}>
                            <li>Go to the <Box component="a" href="https://console.cloud.google.com/" target="_blank" sx={{ color: PRIMARY.main }}>Google Cloud Console</Box></li>
                            <li>Create a new project or select an existing one</li>
                            <li>Enable the <strong>YouTube Data API v3</strong> from the API Library</li>
                            <li>Go to <strong>Credentials</strong> → <strong>Create Credentials</strong> → <strong>API Key</strong></li>
                            <li>Copy the API key and paste it above</li>
                            <li>Optional: Restrict the key to YouTube Data API v3 only for security</li>
                        </Box>
                        <Alert severity="info" sx={{ mt: 2 }}>
                            The free quota allows ~10,000 units/day. Fetching a channel uses ~5 units, video details ~3 units per batch.
                        </Alert>

                        <Divider sx={{ my: 3 }} />

                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                            How to Get Instagram Access
                        </Typography>
                        <Box component="ol" sx={{ pl: 2, color: 'text.secondary', '& li': { mb: 1.5, lineHeight: 1.6 } }}>
                            <li>Go to <Box component="a" href="https://developers.facebook.com/apps/" target="_blank" sx={{ color: '#E1306C' }}>Meta for Developers</Box> and create a new app (type: <strong>Business</strong>)</li>
                            <li>Add the <strong>Instagram</strong> product and set up <strong>API setup with Instagram business login</strong></li>
                            <li>Your account must be a <strong>Business</strong> or <strong>Creator</strong> professional account</li>
                            <li>Find your <strong>Instagram App ID</strong> and <strong>Instagram App Secret</strong> under Business login settings</li>
                            <li>Add your account as a <strong>Tester</strong> under App Roles → Instagram Testers</li>
                            <li>Click <strong>Generate Token</strong> next to your Instagram account to get a long-lived access token (60 days)</li>
                            <li>Required permission: <strong>instagram_business_basic</strong></li>
                            <li>Paste the access token in the <strong>Add Account → Instagram</strong> dialog</li>
                        </Box>
                        <Alert severity="warning" sx={{ mt: 2 }}>
                            In development mode, only test users / Instagram Testers can use the app.
                            Tokens from the App Dashboard are long-lived (~60 days).
                        </Alert>
                    </MainCard>

                </Grid>

                {/* Right column — Quick Actions + About */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <Box sx={{ position: 'sticky', top: 80 }}>
                        <MainCard title="Quick Actions" sx={{ mb: 2 }}>
                            <Button fullWidth variant="outlined" startIcon={<Refresh />} onClick={refreshAll} sx={{ mb: 1.5 }}>
                                Refresh All Accounts
                            </Button>
                            <Button fullWidth variant="outlined" startIcon={<CheckCircle />} onClick={handleTest}>
                                Test API Health
                            </Button>
                        </MainCard>

                        <MainCard title="About">
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.7 }}>
                                Social Media Analytics Dashboard — a comprehensive analytics tool for tracking YouTube and Instagram
                                performance with engagement metrics, growth tracking, and more.
                            </Typography>
                            <Divider sx={{ my: 2 }} />
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {[
                                    { label: 'React',              color: '#61DAFB' },
                                    { label: 'MUI v7',             color: '#007FFF' },
                                    { label: 'Recharts',           color: '#82ca9d' },
                                    { label: 'Node.js',            color: '#68A038' },
                                    { label: 'YouTube API v3',     color: '#FF4444' },
                                    { label: 'Instagram Graph API', color: '#E1306C' },
                                ].map(c => (
                                    <Chip key={c.label} label={c.label} size="small" variant="outlined"
                                        sx={{ borderColor: `${c.color}55`, color: c.color }} />
                                ))}
                            </Box>
                        </MainCard>
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
}
