import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Grid, Card, CardContent, Button, TextField,
    InputAdornment, IconButton, Chip, Divider, Alert, CircularProgress,
} from '@mui/material';
import {
    Key, Save, Visibility, VisibilityOff, CheckCircle, Error as ErrorIcon,
    Refresh, Info, GitHub, Code, Instagram, Cloud, Sync, Schedule,
} from '@mui/icons-material';
import { api } from '../../services/api';

export default function Settings({ showToast, onRefresh }) {
    const [apiKey, setApiKey] = useState('');
    const [igAppId, setIgAppId] = useState('');
    const [igAppSecret, setIgAppSecret] = useState('');
    const [cloudinaryName, setCloudinaryName] = useState('');
    const [cloudinaryPreset, setCloudinaryPreset] = useState('');
    const [githubToken, setGithubToken] = useState('');
    const [githubRepo, setGithubRepo] = useState('');
    const [githubBranch, setGithubBranch] = useState('main');
    const [showGhToken, setShowGhToken] = useState(false);
    const [savingGh, setSavingGh] = useState(false);
    const [syncingGh, setSyncingGh] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [showIgSecret, setShowIgSecret] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savingIg, setSavingIg] = useState(false);
    const [savingCloud, setSavingCloud] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadKeys();
    }, []);

    const loadKeys = async () => {
        setLoading(true);
        try {
            const res = await api.getKeys();
            setApiKey(res.youtube || '');
            if (res.instagram) {
                setIgAppId(res.instagram.appId || '');
                setIgAppSecret(res.instagram.appSecret || '');
            }
            if (res.cloudinary) {
                setCloudinaryName(res.cloudinary.cloudName || '');
                setCloudinaryPreset(res.cloudinary.uploadPreset || '');
            }
            if (res.github) {
                setGithubToken(res.github.token || '');
                setGithubRepo(res.github.repo || '');
                setGithubBranch(res.github.branch || 'main');
            }
        } catch (err) {
            showToast('Failed to load API keys', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.saveKey(apiKey);
            showToast('API key saved successfully', 'success');
        } catch (err) {
            showToast('Failed to save API key: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const res = await api.health();
            if (res.status === 'ok') {
                setTestResult({ success: true, message: 'API connection successful!' });
            } else {
                setTestResult({ success: false, message: 'API health check returned unexpected status.' });
            }
        } catch (err) {
            setTestResult({ success: false, message: 'Connection failed: ' + err.message });
        } finally {
            setTesting(false);
        }
    };

    const handleRefreshAll = async () => {
        try {
            await api.refreshAll();
            showToast('All accounts refreshed successfully', 'success');
            onRefresh();
        } catch (err) {
            showToast('Refresh failed: ' + err.message, 'error');
        }
    };

    const handleSaveInstagram = async () => {
        setSavingIg(true);
        try {
            await api.saveKeys({ instagram: { appId: igAppId, appSecret: igAppSecret } });
            showToast('Instagram credentials saved successfully', 'success');
        } catch (err) {
            showToast('Failed to save Instagram credentials: ' + err.message, 'error');
        } finally {
            setSavingIg(false);
        }
    };

    const handleSaveCloudinary = async () => {
        setSavingCloud(true);
        try {
            await api.saveKeys({ cloudinary: { cloudName: cloudinaryName, uploadPreset: cloudinaryPreset } });
            showToast('Cloudinary settings saved successfully', 'success');
        } catch (err) {
            showToast('Failed to save Cloudinary settings: ' + err.message, 'error');
        } finally {
            setSavingCloud(false);
        }
    };

    const handleSaveGitHub = async () => {
        setSavingGh(true);
        try {
            await api.saveKeys({ github: { token: githubToken, repo: githubRepo, branch: githubBranch } });
            showToast('GitHub Actions settings saved successfully', 'success');
        } catch (err) {
            showToast('Failed to save GitHub settings: ' + err.message, 'error');
        } finally {
            setSavingGh(false);
        }
    };

    const handleSyncGitHub = async () => {
        setSyncingGh(true);
        try {
            await api.syncToGitHub();
            showToast('Scheduled posts synced to GitHub', 'success');
        } catch (err) {
            showToast('Sync failed: ' + err.message, 'error');
        } finally {
            setSyncingGh(false);
        }
    };

    const maskedKey = apiKey ? apiKey.substring(0, 8) + '•'.repeat(Math.max(0, apiKey.length - 12)) + apiKey.substring(apiKey.length - 4) : '';
    const maskedIgSecret = igAppSecret ? igAppSecret.substring(0, 6) + '•'.repeat(Math.max(0, igAppSecret.length - 10)) + igAppSecret.substring(igAppSecret.length - 4) : '';
    const maskedGhToken = githubToken ? 'ghp_' + '•'.repeat(Math.max(0, githubToken.length - 8)) + githubToken.substring(githubToken.length - 4) : '';

    return (
        <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
                Settings
            </Typography>

            <Grid container spacing={3}>
                {/* Left Column — all settings cards */}
                <Grid size={{ xs: 12, md: 8 }}>

                    {/* API Key Configuration */}
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                <Key sx={{ verticalAlign: 'middle', mr: 1, color: '#FF9800' }} />
                                YouTube Data API Key
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                                Required to fetch YouTube channel and video data. Get your key from the{' '}
                                <Box component="a" href="https://console.cloud.google.com/apis/credentials" target="_blank"
                                    sx={{ color: '#3EA6FF', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                                    Google Cloud Console
                                </Box>.
                            </Typography>

                            <TextField fullWidth value={showKey ? apiKey : maskedKey}
                                onChange={e => setApiKey(e.target.value)}
                                placeholder="AIzaSy..." size="small"
                                onFocus={() => setShowKey(true)}
                                type={showKey ? 'text' : 'text'}
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
                                sx={{ mb: 2 }} />

                            <Box sx={{ display: 'flex', gap: 1.5 }}>
                                <Button variant="contained" startIcon={saving ? <CircularProgress size={16} /> : <Save />}
                                    onClick={handleSave} disabled={saving || !apiKey.trim()}
                                    sx={{ background: 'linear-gradient(135deg, #FF0000, #FF4444)' }}>
                                    Save Key
                                </Button>
                                <Button variant="outlined" startIcon={testing ? <CircularProgress size={16} /> : <CheckCircle />}
                                    onClick={handleTest} disabled={testing}
                                    sx={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                                    Test Connection
                                </Button>
                            </Box>

                            {testResult && (
                                <Alert severity={testResult.success ? 'success' : 'error'} sx={{ mt: 2 }}>
                                    {testResult.message}
                                </Alert>
                            )}
                        </CardContent>
                    </Card>

                    {/* Instagram Credentials */}
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                <Instagram sx={{ verticalAlign: 'middle', mr: 1, color: '#E1306C' }} />
                                Instagram App Credentials
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                                Optional — enables long-lived token exchange (~60 days). Get these from{' '}
                                <Box component="a" href="https://developers.facebook.com/apps/" target="_blank"
                                    sx={{ color: '#E1306C', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                                    App Dashboard → Instagram → API setup with Instagram login
                                </Box>.
                            </Typography>

                            <TextField fullWidth value={igAppId}
                                onChange={e => setIgAppId(e.target.value)}
                                placeholder="Instagram App ID from App Dashboard" size="small" label="Instagram App ID"
                                slotProps={{
                                    input: {
                                        startAdornment: <InputAdornment position="start"><Code sx={{ color: 'text.secondary' }} /></InputAdornment>,
                                    }
                                }}
                                sx={{ mb: 2 }} />

                            <TextField fullWidth value={showIgSecret ? igAppSecret : maskedIgSecret}
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

                            <Button variant="contained" startIcon={savingIg ? <CircularProgress size={16} /> : <Save />}
                                onClick={handleSaveInstagram} disabled={savingIg || (!igAppId.trim() && !igAppSecret.trim())}
                                sx={{ background: 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)' }}>
                                Save Instagram Credentials
                            </Button>

                            <Alert severity="info" sx={{ mt: 2 }}>
                                Only the <strong>Instagram App Secret</strong> is needed for token exchange. You can add accounts
                                without credentials — tokens from the App Dashboard are already long-lived (60 days).
                            </Alert>
                        </CardContent>
                    </Card>

                    {/* Cloudinary CDN Settings */}
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                <Cloud sx={{ verticalAlign: 'middle', mr: 1, color: '#3448C5' }} />
                                Cloudinary CDN (for Instagram Uploads)
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                                Instagram API requires media at a public URL. Cloudinary is used to host your files before publishing.
                                Get a free account at{' '}
                                <Box component="a" href="https://cloudinary.com/users/register_free" target="_blank"
                                    sx={{ color: '#3448C5', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                                    cloudinary.com
                                </Box>. Use an <strong>unsigned upload preset</strong>.
                            </Typography>

                            <TextField fullWidth value={cloudinaryName}
                                onChange={e => setCloudinaryName(e.target.value)}
                                placeholder="e.g. my-cloud-name" size="small" label="Cloud Name"
                                slotProps={{
                                    input: {
                                        startAdornment: <InputAdornment position="start"><Cloud sx={{ color: 'text.secondary' }} /></InputAdornment>,
                                    }
                                }}
                                sx={{ mb: 2 }} />

                            <TextField fullWidth value={cloudinaryPreset}
                                onChange={e => setCloudinaryPreset(e.target.value)}
                                placeholder="e.g. ml_default (unsigned preset)" size="small" label="Upload Preset (unsigned)"
                                slotProps={{
                                    input: {
                                        startAdornment: <InputAdornment position="start"><Code sx={{ color: 'text.secondary' }} /></InputAdornment>,
                                    }
                                }}
                                sx={{ mb: 2 }} />

                            <Button variant="contained" startIcon={savingCloud ? <CircularProgress size={16} /> : <Save />}
                                onClick={handleSaveCloudinary} disabled={savingCloud || !cloudinaryName.trim()}
                                sx={{ background: 'linear-gradient(135deg, #3448C5, #0C6DD7)' }}>
                                Save Cloudinary Settings
                            </Button>

                            <Alert severity="info" sx={{ mt: 2 }}>
                                Create an <strong>unsigned upload preset</strong> in Cloudinary → Settings → Upload → Upload presets → Add.
                                This allows direct browser uploads without exposing API secrets.
                            </Alert>
                        </CardContent>
                    </Card>

                    {/* GitHub Actions — Cloud Scheduling */}
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                <GitHub sx={{ verticalAlign: 'middle', mr: 1 }} />
                                GitHub Actions (Cloud Scheduling)
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                                Publish scheduled posts from the cloud — even when your PC is off. Runs every 15 min via GitHub Actions (free).
                                Create a{' '}
                                <Box component="a" href="https://github.com/settings/tokens?type=beta" target="_blank"
                                    sx={{ color: '#fff', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                                    Fine-grained Personal Access Token
                                </Box>{' '}
                                with <strong>Contents: Read & Write</strong> permission.
                            </Typography>

                            <TextField fullWidth value={showGhToken ? githubToken : maskedGhToken}
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

                            <TextField fullWidth value={githubRepo}
                                onChange={e => setGithubRepo(e.target.value)}
                                placeholder="username/repo-name" size="small" label="Repository (owner/repo)"
                                slotProps={{
                                    input: {
                                        startAdornment: <InputAdornment position="start"><GitHub sx={{ color: 'text.secondary' }} /></InputAdornment>,
                                    }
                                }}
                                sx={{ mb: 2 }} />

                            <TextField fullWidth value={githubBranch}
                                onChange={e => setGithubBranch(e.target.value)}
                                placeholder="main" size="small" label="Branch"
                                slotProps={{
                                    input: {
                                        startAdornment: <InputAdornment position="start"><Code sx={{ color: 'text.secondary' }} /></InputAdornment>,
                                    }
                                }}
                                sx={{ mb: 2 }} />

                            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                                <Button variant="contained" startIcon={savingGh ? <CircularProgress size={16} /> : <Save />}
                                    onClick={handleSaveGitHub} disabled={savingGh || !githubToken.trim() || !githubRepo.trim()}
                                    sx={{ background: 'linear-gradient(135deg, #333, #555)' }}>
                                    Save GitHub Settings
                                </Button>
                                <Button variant="outlined" startIcon={syncingGh ? <CircularProgress size={16} /> : <Sync />}
                                    onClick={handleSyncGitHub} disabled={syncingGh || !githubToken.trim() || !githubRepo.trim()}
                                    sx={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                                    Sync Now
                                </Button>
                            </Box>

                            <Alert severity="info" sx={{ mt: 2 }}>
                                <strong>Setup steps:</strong><br />
                                1. Push this project to a GitHub repo<br />
                                2. Go to repo → Settings → Secrets → Actions → New Secret<br />
                                3. Add secret <code>ACCOUNTS_JSON</code> with the Base64 of your <code>accounts.json</code><br />
                                &nbsp;&nbsp;&nbsp;PowerShell: <code>[Convert]::ToBase64String([IO.File]::ReadAllBytes("backend\data\accounts.json"))</code><br />
                                4. The workflow runs every 15 min automatically
                            </Alert>
                        </CardContent>
                    </Card>

                    {/* How to get API Keys */}
                    <Card>
                        <CardContent>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                                <Info sx={{ verticalAlign: 'middle', mr: 1, color: '#3EA6FF' }} />
                                How to Get a YouTube API Key
                            </Typography>
                            <Box component="ol" sx={{ pl: 2, color: 'text.secondary', '& li': { mb: 1.5, lineHeight: 1.6 } }}>
                                <li>Go to the <Box component="a" href="https://console.cloud.google.com/" target="_blank" sx={{ color: '#3EA6FF' }}>Google Cloud Console</Box></li>
                                <li>Create a new project or select an existing one</li>
                                <li>Enable the <strong style={{ color: '#fff' }}>YouTube Data API v3</strong> from the API Library</li>
                                <li>Go to <strong style={{ color: '#fff' }}>Credentials</strong> → <strong style={{ color: '#fff' }}>Create Credentials</strong> → <strong style={{ color: '#fff' }}>API Key</strong></li>
                                <li>Copy the API key and paste it above</li>
                                <li>Optional: Restrict the key to YouTube Data API v3 only for security</li>
                            </Box>
                            <Alert severity="info" sx={{ mt: 2 }}>
                                The free quota allows ~10,000 units/day. Fetching a channel uses ~5 units, video details ~3 units per batch.
                            </Alert>

                            <Divider sx={{ my: 3 }} />

                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                                <Instagram sx={{ verticalAlign: 'middle', mr: 1, color: '#E1306C' }} />
                                How to Get Instagram Access
                            </Typography>
                            <Box component="ol" sx={{ pl: 2, color: 'text.secondary', '& li': { mb: 1.5, lineHeight: 1.6 } }}>
                                <li>Go to <Box component="a" href="https://developers.facebook.com/apps/" target="_blank" sx={{ color: '#E1306C' }}>Meta for Developers</Box> and create a new app (type: <strong style={{ color: '#fff' }}>Business</strong>)</li>
                                <li>In the app dashboard, add the <strong style={{ color: '#fff' }}>Instagram</strong> product and set up <strong style={{ color: '#fff' }}>API setup with Instagram business login</strong></li>
                                <li>Your Instagram account must be a <strong style={{ color: '#fff' }}>Business</strong> or <strong style={{ color: '#fff' }}>Creator</strong> professional account (no Facebook Page link needed)</li>
                                <li>In the Instagram API setup section, find your <strong style={{ color: '#fff' }}>Instagram App ID</strong> and <strong style={{ color: '#fff' }}>Instagram App Secret</strong> under Business login settings</li>
                                <li>Add your Instagram account as a <strong style={{ color: '#fff' }}>Tester</strong> under App Roles → Instagram Testers, then accept the invite</li>
                                <li>Click <strong style={{ color: '#fff' }}>Generate Token</strong> next to your Instagram account to get a long-lived access token (60 days)</li>
                                <li>Required permission: <strong style={{ color: '#fff' }}>instagram_business_basic</strong></li>
                                <li>Paste the access token in the <strong style={{ color: '#fff' }}>Add Account → Instagram</strong> dialog</li>
                            </Box>
                            <Alert severity="warning" sx={{ mt: 2 }}>
                                In development mode, only test users / Instagram Testers can use the app.
                                Tokens from the App Dashboard are long-lived (~60 days). Tokens from the Business Login
                                flow are short-lived (1 hour) and need the App Secret for exchange.
                            </Alert>
                        </CardContent>
                    </Card>

                </Grid>

                {/* Right Column — Quick Actions + About (sticky at top) */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <Box sx={{ position: 'sticky', top: 24 }}>
                        <Card sx={{ mb: 2 }}>
                            <CardContent>
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                                    <Refresh sx={{ verticalAlign: 'middle', mr: 1, color: '#4CAF50' }} />
                                    Quick Actions
                                </Typography>
                                <Button fullWidth variant="outlined" startIcon={<Refresh />} onClick={handleRefreshAll}
                                    sx={{ borderColor: 'rgba(255,255,255,0.15)', mb: 1.5 }}>
                                    Refresh All Accounts
                                </Button>
                                <Button fullWidth variant="outlined" startIcon={<CheckCircle />} onClick={handleTest}
                                    sx={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                                    Test API Health
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent>
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>About</Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, lineHeight: 1.7 }}>
                                    Social Media Analytics Dashboard — a comprehensive analytics tool for tracking YouTube and Instagram
                                    performance with engagement metrics, growth tracking, and more.
                                </Typography>
                                <Divider sx={{ my: 2 }} />
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    <Chip label="React" size="small" variant="outlined" sx={{ borderColor: 'rgba(97,219,251,0.3)', color: '#61DAFB' }} />
                                    <Chip label="MUI v7" size="small" variant="outlined" sx={{ borderColor: 'rgba(0,127,255,0.3)', color: '#007FFF' }} />
                                    <Chip label="Recharts" size="small" variant="outlined" sx={{ borderColor: 'rgba(130,202,157,0.3)', color: '#82ca9d' }} />
                                    <Chip label="Node.js" size="small" variant="outlined" sx={{ borderColor: 'rgba(104,159,56,0.3)', color: '#68A038' }} />
                                    <Chip label="YouTube API v3" size="small" variant="outlined" sx={{ borderColor: 'rgba(255,0,0,0.3)', color: '#FF4444' }} />
                                    <Chip label="Instagram Graph API" size="small" variant="outlined" sx={{ borderColor: 'rgba(225,48,108,0.3)', color: '#E1306C' }} />
                                </Box>
                            </CardContent>
                        </Card>
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
}
