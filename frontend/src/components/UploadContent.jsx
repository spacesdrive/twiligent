import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, Button, TextField, Select,
    MenuItem, FormControl, InputLabel, Chip, LinearProgress, Avatar,
    Switch, FormControlLabel, CircularProgress, Alert, Stepper, Step,
    StepLabel, IconButton, Divider, Tooltip, InputAdornment,
} from '@mui/material';
import {
    CloudUpload, Instagram, Photo, Movie, ViewCarousel, AutoStories,
    Delete, CheckCircle, Error as ErrorIcon, Schedule, Send,
    Image as ImageIcon, VideoFile, Add, Close, Settings,
    PersonAdd, LocationOn, AlternateEmail, MusicNote, PhotoCamera,
    Timer, Science, CalendarMonth, AccessTime,
} from '@mui/icons-material';
import { api } from '../services/api';

const IG_GRADIENT = 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF, #515BD4)';

const CONTENT_TYPES = [
    { value: 'IMAGE', label: 'Photo Post', icon: <Photo />, color: '#F58529', accept: 'image/jpeg', desc: 'JPEG image, 4:5 to 1.91:1 ratio, max 8MB' },
    { value: 'REELS', label: 'Reel', icon: <Movie />, color: '#DD2A7B', accept: 'video/mp4,video/quicktime', desc: 'MP4/MOV, 9:16 ratio, 3s–15min, max 300MB' },
    { value: 'STORIES', label: 'Story', icon: <AutoStories />, color: '#8134AF', accept: 'image/jpeg,video/mp4,video/quicktime', desc: 'Image or video, 9:16, max 60s video' },
];

const PUBLISH_STEPS = ['Select Media', 'Configure', 'Upload & Publish'];

export default function UploadContent({ accounts, showToast }) {
    const [igAccounts, setIgAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [contentType, setContentType] = useState('');
    const [file, setFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [cloudConfig, setCloudConfig] = useState(null);

    // Settings
    const [caption, setCaption] = useState('');
    const [shareToFeed, setShareToFeed] = useState(true);
    const [coverFile, setCoverFile] = useState(null);
    const [coverPreview, setCoverPreview] = useState(null);
    const [audioName, setAudioName] = useState('');
    const [thumbOffset, setThumbOffset] = useState('');
    const [locationId, setLocationId] = useState('');
    const [collaborators, setCollaborators] = useState('');
    const [userTags, setUserTags] = useState('');
    const [altText, setAltText] = useState('');

    // Schedule state
    const [scheduleMode, setScheduleMode] = useState(false);
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [scheduledPosts, setScheduledPosts] = useState([]);
    const [showScheduled, setShowScheduled] = useState(false);
    const [loadingScheduled, setLoadingScheduled] = useState(false);

    // Publish state
    const [activeStep, setActiveStep] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [publishStatus, setPublishStatus] = useState(''); // '', 'uploading-cloudinary', 'creating-container', 'processing', 'publishing', 'done', 'error'
    const [statusMessage, setStatusMessage] = useState('');
    const [publishedMediaId, setPublishedMediaId] = useState(null);

    const fileInputRef = useRef(null);
    const coverInputRef = useRef(null);

    useEffect(() => {
        const ig = (accounts || []).filter(a => a.platform === 'instagram');
        setIgAccounts(ig);
        if (ig.length === 1) setSelectedAccount(ig[0].id);
        loadCloudinaryConfig();
        loadScheduledPosts();
    }, [accounts]);

    const loadScheduledPosts = async () => {
        try {
            const res = await api.getScheduledPosts();
            if (res.success) setScheduledPosts(res.posts || []);
        } catch { }
    };

    const loadCloudinaryConfig = async () => {
        try {
            const res = await api.getCloudinaryConfig();
            if (res.success) setCloudConfig(res);
        } catch { }
    };

    const handleFileSelect = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);
        if (f.type.startsWith('image/')) {
            setFilePreview(URL.createObjectURL(f));
        } else if (f.type.startsWith('video/')) {
            setFilePreview(URL.createObjectURL(f));
        }
    };

    const handleCoverSelect = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setCoverFile(f);
        setCoverPreview(URL.createObjectURL(f));
    };

    const clearFile = () => {
        setFile(null);
        setFilePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const clearCover = () => {
        setCoverFile(null);
        setCoverPreview(null);
        if (coverInputRef.current) coverInputRef.current.value = '';
    };

    const resetAll = () => {
        clearFile();
        clearCover();
        setCaption('');
        setShareToFeed(true);
        setAudioName('');
        setThumbOffset('');
        setLocationId('');
        setCollaborators('');
        setUserTags('');
        setAltText('');
        setContentType('');
        setActiveStep(0);
        setPublishStatus('');
        setStatusMessage('');
        setPublishedMediaId(null);
        setUploadProgress(0);
        setScheduleMode(false);
        setScheduleDate('');
        setScheduleTime('');
    };

    const uploadToCloudinary = async (fileToUpload) => {
        if (!cloudConfig) throw new Error('Cloudinary not configured. Go to Settings.');
        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('upload_preset', cloudConfig.uploadPreset);

        const resourceType = fileToUpload.type.startsWith('video/') ? 'video' : 'image';

        const xhr = new XMLHttpRequest();
        return new Promise((resolve, reject) => {
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    setUploadProgress(Math.round((e.loaded / e.total) * 100));
                }
            });
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const data = JSON.parse(xhr.responseText);
                    resolve(data.secure_url);
                } else {
                    try {
                        const err = JSON.parse(xhr.responseText);
                        reject(new Error(err.error?.message || 'Cloudinary upload failed'));
                    } catch {
                        reject(new Error('Cloudinary upload failed'));
                    }
                }
            });
            xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
            xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudConfig.cloudName}/${resourceType}/upload`);
            xhr.send(formData);
        });
    };

    const waitForContainer = async (containerId, accountId, maxAttempts = 30) => {
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(r => setTimeout(r, 3000));
            try {
                const status = await api.getIGContainerStatus(containerId, accountId);
                setStatusMessage(`Processing: ${status.statusCode || 'IN_PROGRESS'}...`);
                if (status.statusCode === 'FINISHED') return true;
                if (status.statusCode === 'ERROR') throw new Error('Container processing failed: ' + (status.status || 'Unknown error'));
                if (status.statusCode === 'EXPIRED') throw new Error('Container expired');
                if (status.statusCode === 'PUBLISHED') return true;
            } catch (err) {
                if (err.message.includes('processing failed') || err.message.includes('expired')) throw err;
            }
        }
        throw new Error('Timed out waiting for media processing');
    };

    const handlePublish = async () => {
        if (!selectedAccount || !file || !contentType) {
            showToast('Please select account, content type, and file', 'error');
            return;
        }
        if (!cloudConfig) {
            showToast('Cloudinary not configured. Please set it up in Settings.', 'error');
            return;
        }

        // If scheduling, upload to Cloudinary first then create scheduled post
        if (scheduleMode) {
            if (!scheduleDate || !scheduleTime) {
                showToast('Please set a schedule date and time', 'error');
                return;
            }
            const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
            const now = new Date();
            if (scheduledAt <= now) {
                showToast('Scheduled time must be in the future', 'error');
                return;
            }

            setUploading(true);
            setPublishStatus('uploading-cloudinary');
            setStatusMessage('Uploading file to CDN for scheduling...');
            setActiveStep(2);

            try {
                const mediaUrl = await uploadToCloudinary(file);
                let coverUrl = null;
                if (coverFile && contentType === 'REELS') {
                    setStatusMessage('Uploading cover image...');
                    coverUrl = await uploadToCloudinary(coverFile);
                }

                setPublishStatus('scheduling');
                setStatusMessage('Saving scheduled post...');

                const postData = {
                    accountId: selectedAccount,
                    platform: 'instagram',
                    mediaType: contentType,
                    mediaUrl,
                    caption: caption || '',
                    coverUrl: coverUrl || null,
                    shareToFeed: contentType === 'REELS' ? shareToFeed : true,
                    collaborators: collaborators ? collaborators.split(',').map(s => s.trim()).filter(Boolean) : [],
                    audioName: audioName || '',
                    thumbOffset: thumbOffset ? parseInt(thumbOffset) : null,
                    locationId: locationId || '',
                    userTags: userTags ? parseUserTags(userTags) : [],
                    altText: (contentType === 'IMAGE' && altText) ? altText : '',
                    scheduledAt: scheduledAt.toISOString(),
                };

                const res = await api.createScheduledPost(postData);
                if (!res.success) throw new Error(res.message || 'Failed to schedule');

                setPublishStatus('scheduled');
                setStatusMessage(`Scheduled for ${scheduledAt.toLocaleString()}`);
                showToast('Post scheduled successfully!', 'success');
                loadScheduledPosts();
            } catch (err) {
                setPublishStatus('error');
                setStatusMessage(err.message);
                showToast('Schedule failed: ' + err.message, 'error');
            } finally {
                setUploading(false);
            }
            return;
        }

        setUploading(true);
        setPublishStatus('uploading-cloudinary');
        setStatusMessage('Uploading file to CDN...');
        setActiveStep(2);

        try {
            // Step 1: Upload to Cloudinary
            const mediaUrl = await uploadToCloudinary(file);
            setStatusMessage('File uploaded to CDN successfully!');

            // Upload cover if provided
            let coverUrl = null;
            if (coverFile && contentType === 'REELS') {
                setStatusMessage('Uploading cover image...');
                coverUrl = await uploadToCloudinary(coverFile);
            }

            // Step 2: Create IG container
            setPublishStatus('creating-container');
            setStatusMessage('Creating Instagram media container...');

            const publishData = {
                mediaType: contentType,
                mediaUrl,
                caption: caption || undefined,
                coverUrl: coverUrl || undefined,
                shareToFeed: contentType === 'REELS' ? shareToFeed : undefined,
                collaborators: collaborators ? collaborators.split(',').map(s => s.trim()).filter(Boolean) : undefined,
                audioName: audioName || undefined,
                thumbOffset: thumbOffset ? parseInt(thumbOffset) : undefined,
                locationId: locationId || undefined,
                userTags: userTags ? parseUserTags(userTags) : undefined,
                altText: (contentType === 'IMAGE' && altText) ? altText : undefined,
            };

            const containerRes = await api.createIGContainer(selectedAccount, publishData);
            if (!containerRes.success || !containerRes.containerId) {
                throw new Error(containerRes.message || 'Failed to create container');
            }

            const containerId = containerRes.containerId;

            // Step 3: Wait for processing (videos need time)
            if (contentType === 'REELS' || contentType === 'STORIES') {
                setPublishStatus('processing');
                setStatusMessage('Instagram is processing the media...');
                await waitForContainer(containerId, selectedAccount);
            } else {
                // Images are usually ready immediately, but let's check once
                await new Promise(r => setTimeout(r, 2000));
            }

            // Step 4: Publish
            setPublishStatus('publishing');
            setStatusMessage('Publishing to Instagram...');

            const publishRes = await api.publishIGContainer(selectedAccount, containerId);
            if (!publishRes.success || !publishRes.mediaId) {
                throw new Error(publishRes.message || 'Failed to publish');
            }

            setPublishStatus('done');
            setPublishedMediaId(publishRes.mediaId);
            setStatusMessage('Published successfully!');
            showToast('Content published to Instagram!', 'success');

        } catch (err) {
            setPublishStatus('error');
            setStatusMessage(err.message);
            showToast('Publish failed: ' + err.message, 'error');
        } finally {
            setUploading(false);
        }
    };

    const parseUserTags = (str) => {
        // Format: "@user1, @user2" or "user1 0.5 0.5, user2 0.3 0.8"
        return str.split(',').map(s => {
            const parts = s.trim().replace(/^@/, '').split(/\s+/);
            return {
                username: parts[0],
                x: parts[1] ? parseFloat(parts[1]) : 0.5,
                y: parts[2] ? parseFloat(parts[2]) : 0.5,
            };
        }).filter(t => t.username);
    };

    const handleDeleteScheduled = async (id) => {
        try {
            await api.deleteScheduledPost(id);
            showToast('Scheduled post deleted', 'success');
            loadScheduledPosts();
        } catch (err) {
            showToast('Delete failed: ' + err.message, 'error');
        }
    };

    const canProceed = () => {
        if (activeStep === 0) return !!file && !!contentType && !!selectedAccount;
        if (activeStep === 1) return true;
        return false;
    };

    const selectedAcct = igAccounts.find(a => a.id === selectedAccount);
    const selectedType = CONTENT_TYPES.find(t => t.value === contentType);
    const isVideo = contentType === 'REELS' || (contentType === 'STORIES' && file?.type?.startsWith('video/'));

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    <CloudUpload sx={{ verticalAlign: 'middle', mr: 1.5, color: '#DD2A7B', fontSize: 36 }} />
                    Upload Content
                </Typography>
                {publishStatus === 'done' && (
                    <Button variant="contained" onClick={resetAll}
                        sx={{ background: IG_GRADIENT }}>
                        Upload Another
                    </Button>
                )}
            </Box>

            {/* No IG accounts */}
            {igAccounts.length === 0 && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    No Instagram accounts found. Add an account first in the Accounts section.
                </Alert>
            )}

            {/* No Cloudinary */}
            {!cloudConfig && (
                <Alert severity="info" sx={{ mb: 3 }}>
                    <strong>Cloudinary CDN required</strong> — Instagram API needs media at a public URL.
                    Configure Cloudinary in <strong>Settings</strong> to enable uploads.
                </Alert>
            )}

            {/* Stepper */}
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                {PUBLISH_STEPS.map((label) => (
                    <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                    </Step>
                ))}
            </Stepper>

            {/* STEP 0: Select Media */}
            {activeStep === 0 && (
                <Grid container spacing={3}>
                    {/* Platform & Account */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                                    <Instagram sx={{ verticalAlign: 'middle', mr: 1, color: '#DD2A7B' }} />
                                    Platform & Account
                                </Typography>

                                <Box sx={{ mb: 2.5 }}>
                                    <Chip icon={<Instagram />} label="Instagram"
                                        sx={{ background: IG_GRADIENT, color: '#fff', fontWeight: 600, fontSize: 14, height: 36, px: 1 }} />
                                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1 }}>
                                        YouTube uploads coming soon
                                    </Typography>
                                </Box>

                                <FormControl fullWidth size="small">
                                    <InputLabel>Select Account</InputLabel>
                                    <Select value={selectedAccount} label="Select Account"
                                        onChange={(e) => setSelectedAccount(e.target.value)}>
                                        {igAccounts.map(a => (
                                            <MenuItem key={a.id} value={a.id}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <Avatar src={a.profilePictureUrl || a.thumbnailUrl || a.thumbnail}
                                                        sx={{ width: 28, height: 28 }}>
                                                        <Instagram sx={{ fontSize: 16 }} />
                                                    </Avatar>
                                                    <Box>
                                                        <Typography sx={{ fontWeight: 500, fontSize: 14 }}>{a.title || a.username}</Typography>
                                                        {a.username && <Typography variant="caption" sx={{ color: 'text.secondary' }}>@{a.username}</Typography>}
                                                    </Box>
                                                </Box>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Content Type */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                                    Content Type
                                </Typography>
                                <Grid container spacing={1.5}>
                                    {CONTENT_TYPES.map(t => (
                                        <Grid size={{ xs: 4 }} key={t.value}>
                                            <Card
                                                onClick={() => { setContentType(t.value); clearFile(); }}
                                                sx={{
                                                    cursor: 'pointer', textAlign: 'center', p: 2,
                                                    border: contentType === t.value ? `2px solid ${t.color}` : '2px solid transparent',
                                                    bgcolor: contentType === t.value ? `${t.color}15` : 'transparent',
                                                    transition: 'all 0.2s',
                                                    '&:hover': { bgcolor: `${t.color}10` },
                                                }}>
                                                <Box sx={{ color: t.color, mb: 0.5 }}>{t.icon}</Box>
                                                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12 }}>{t.label}</Typography>
                                            </Card>
                                        </Grid>
                                    ))}
                                </Grid>
                                {selectedType && (
                                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1.5 }}>
                                        {selectedType.desc}
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* File Upload */}
                    <Grid size={12}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                                    Select File
                                </Typography>
                                {!file ? (
                                    <Box
                                        onClick={() => contentType && fileInputRef.current?.click()}
                                        sx={{
                                            border: '2px dashed rgba(255,255,255,0.2)', borderRadius: 3,
                                            p: 6, textAlign: 'center', cursor: contentType ? 'pointer' : 'not-allowed',
                                            transition: 'all 0.2s',
                                            opacity: contentType ? 1 : 0.5,
                                            '&:hover': contentType ? { borderColor: '#DD2A7B', bgcolor: 'rgba(221,42,123,0.05)' } : {},
                                        }}>
                                        <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                            {contentType ? 'Click to select file' : 'Choose a content type first'}
                                        </Typography>
                                        {selectedType && (
                                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                {selectedType.desc}
                                            </Typography>
                                        )}
                                    </Box>
                                ) : (
                                    <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
                                        <Box sx={{ width: 200, flexShrink: 0, borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                                            {file.type.startsWith('video/') ? (
                                                <video src={filePreview} controls muted
                                                    style={{ width: '100%', maxHeight: 280, objectFit: 'contain', background: '#000', borderRadius: 8 }} />
                                            ) : (
                                                <Box component="img" src={filePreview}
                                                    sx={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 2, bgcolor: '#111' }} />
                                            )}
                                            <IconButton onClick={clearFile} size="small"
                                                sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(0,0,0,0.7)', color: '#fff', '&:hover': { bgcolor: '#f44336' } }}>
                                                <Close fontSize="small" />
                                            </IconButton>
                                        </Box>
                                        <Box>
                                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{file.name}</Typography>
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type}
                                            </Typography>
                                            <Chip label={selectedType?.label} size="small"
                                                sx={{ mt: 1, bgcolor: `${selectedType?.color}22`, color: selectedType?.color }} />
                                        </Box>
                                    </Box>
                                )}
                                <input ref={fileInputRef} type="file" hidden
                                    accept={selectedType?.accept || '*'}
                                    onChange={handleFileSelect} />
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Next button */}
                    <Grid size={12}>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button variant="contained" disabled={!canProceed()}
                                onClick={() => setActiveStep(1)}
                                sx={{ background: IG_GRADIENT, px: 4 }}>
                                Next: Configure Settings
                            </Button>
                        </Box>
                    </Grid>
                </Grid>
            )}

            {/* STEP 1: Configure */}
            {activeStep === 1 && (
                <Grid container spacing={3}>
                    {/* Caption */}
                    <Grid size={{ xs: 12, md: 8 }}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                                    Caption & Details
                                </Typography>
                                <TextField fullWidth multiline rows={4} value={caption}
                                    onChange={e => setCaption(e.target.value)}
                                    placeholder="Write your caption... #hashtags @mentions"
                                    label="Caption" size="small" sx={{ mb: 2 }}
                                    helperText={`${caption.length}/2,200 characters`} />

                                {contentType === 'IMAGE' && (
                                    <TextField fullWidth value={altText}
                                        onChange={e => setAltText(e.target.value)}
                                        placeholder="Describe the image for accessibility"
                                        label="Alt Text" size="small" sx={{ mb: 2 }}
                                        slotProps={{ input: { startAdornment: <InputAdornment position="start"><ImageIcon sx={{ color: 'text.secondary', fontSize: 18 }} /></InputAdornment> } }} />
                                )}

                                <TextField fullWidth value={collaborators}
                                    onChange={e => setCollaborators(e.target.value)}
                                    placeholder="username1, username2 (comma-separated)"
                                    label="Collaborators" size="small" sx={{ mb: 2 }}
                                    slotProps={{ input: { startAdornment: <InputAdornment position="start"><PersonAdd sx={{ color: 'text.secondary', fontSize: 18 }} /></InputAdornment> } }} />

                                <TextField fullWidth value={userTags}
                                    onChange={e => setUserTags(e.target.value)}
                                    placeholder="@username1, @username2"
                                    label="Tag Users" size="small" sx={{ mb: 2 }}
                                    slotProps={{ input: { startAdornment: <InputAdornment position="start"><AlternateEmail sx={{ color: 'text.secondary', fontSize: 18 }} /></InputAdornment> } }} />

                                <TextField fullWidth value={locationId}
                                    onChange={e => setLocationId(e.target.value)}
                                    placeholder="Facebook Page ID for location"
                                    label="Location ID (optional)" size="small"
                                    slotProps={{ input: { startAdornment: <InputAdornment position="start"><LocationOn sx={{ color: 'text.secondary', fontSize: 18 }} /></InputAdornment> } }} />
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Reel-specific settings */}
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                                    {contentType === 'REELS' ? 'Reel Settings' : 'Post Settings'}
                                </Typography>

                                {contentType === 'REELS' && (
                                    <>
                                        <FormControlLabel
                                            control={<Switch checked={shareToFeed} onChange={(e) => setShareToFeed(e.target.checked)} />}
                                            label="Share to Feed"
                                            sx={{ mb: 2, display: 'block' }}
                                        />

                                        <TextField fullWidth value={audioName}
                                            onChange={e => setAudioName(e.target.value)}
                                            placeholder="Custom audio name"
                                            label="Audio Name" size="small" sx={{ mb: 2 }}
                                            slotProps={{ input: { startAdornment: <InputAdornment position="start"><MusicNote sx={{ color: 'text.secondary', fontSize: 18 }} /></InputAdornment> } }} />

                                        <TextField fullWidth value={thumbOffset}
                                            onChange={e => setThumbOffset(e.target.value)}
                                            placeholder="Milliseconds (e.g. 5000)"
                                            label="Thumbnail Offset (ms)" size="small" sx={{ mb: 2 }}
                                            type="number"
                                            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Timer sx={{ color: 'text.secondary', fontSize: 18 }} /></InputAdornment> } }} />

                                        <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>Cover Image (optional)</Typography>
                                        {!coverFile ? (
                                            <Button variant="outlined" size="small" startIcon={<PhotoCamera />}
                                                onClick={() => coverInputRef.current?.click()}
                                                sx={{ mb: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                                                Select Cover
                                            </Button>
                                        ) : (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                <Box component="img" src={coverPreview}
                                                    sx={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 1 }} />
                                                <Typography variant="caption" sx={{ flex: 1 }}>{coverFile.name}</Typography>
                                                <IconButton size="small" onClick={clearCover}><Close fontSize="small" /></IconButton>
                                            </Box>
                                        )}
                                        <input ref={coverInputRef} type="file" hidden accept="image/jpeg"
                                            onChange={handleCoverSelect} />
                                    </>
                                )}

                                {/* Preview info */}
                                <Divider sx={{ my: 2 }} />
                                <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>Summary</Typography>
                                <Box sx={{ fontSize: 12, color: 'text.secondary' }}>
                                    <Box>Account: <strong style={{ color: '#fff' }}>{selectedAcct?.title || selectedAcct?.username || '—'}</strong></Box>
                                    <Box>Type: <strong style={{ color: selectedType?.color }}>{selectedType?.label}</strong></Box>
                                    <Box>File: <strong style={{ color: '#fff' }}>{file?.name || '—'}</strong></Box>
                                    <Box>Size: <strong style={{ color: '#fff' }}>{file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : '—'}</strong></Box>
                                    {caption && <Box>Caption: <strong style={{ color: '#fff' }}>{caption.substring(0, 60)}{caption.length > 60 ? '...' : ''}</strong></Box>}
                                    {scheduleMode && scheduleDate && scheduleTime && (
                                        <Box>Schedule: <strong style={{ color: '#F58529' }}>{new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString()}</strong></Box>
                                    )}
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Schedule Option */}
                    <Grid size={12}>
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: scheduleMode ? 2 : 0 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Schedule sx={{ color: '#F58529' }} />
                                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                            Schedule for Later
                                        </Typography>
                                    </Box>
                                    <FormControlLabel
                                        control={<Switch checked={scheduleMode} onChange={e => setScheduleMode(e.target.checked)} />}
                                        label={scheduleMode ? 'Scheduled' : 'Publish Now'}
                                    />
                                </Box>
                                {scheduleMode && (
                                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                        <TextField
                                            type="date" value={scheduleDate}
                                            onChange={e => setScheduleDate(e.target.value)}
                                            label="Date" size="small"
                                            slotProps={{ inputLabel: { shrink: true }, input: { inputProps: { min: new Date().toISOString().split('T')[0] } } }}
                                            sx={{ minWidth: 180 }}
                                        />
                                        <TextField
                                            type="time" value={scheduleTime}
                                            onChange={e => setScheduleTime(e.target.value)}
                                            label="Time" size="small"
                                            slotProps={{ inputLabel: { shrink: true } }}
                                            sx={{ minWidth: 150 }}
                                        />
                                        {scheduleDate && scheduleTime && (
                                            <Chip
                                                icon={<CalendarMonth sx={{ fontSize: 16 }} />}
                                                label={new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString()}
                                                color="warning" variant="outlined"
                                                sx={{ alignSelf: 'center' }}
                                            />
                                        )}
                                    </Box>
                                )}
                                {scheduleMode && (
                                    <Alert severity="info" sx={{ mt: 2 }}>
                                        <strong>Cloud Scheduling.</strong> Your file is uploaded to Cloudinary now. If GitHub Actions
                                        is configured (Settings), posts publish from the cloud even when your PC is off.
                                        Otherwise, keep the server running for on-time publishing.
                                    </Alert>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Nav buttons */}
                    <Grid size={12}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Button variant="outlined" onClick={() => setActiveStep(0)}
                                sx={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                                Back
                            </Button>
                            <Box sx={{ display: 'flex', gap: 1.5 }}>
                                <Button variant="contained" onClick={handlePublish}
                                    startIcon={uploading ? <CircularProgress size={16} /> : (scheduleMode ? <Schedule /> : <Send />)}
                                    disabled={uploading || (scheduleMode && (!scheduleDate || !scheduleTime))}
                                    sx={{ background: scheduleMode ? 'linear-gradient(135deg, #F58529, #FF6B35)' : IG_GRADIENT, px: 4 }}>
                                    {scheduleMode ? 'Schedule Post' : 'Upload & Publish Now'}
                                </Button>
                            </Box>
                        </Box>
                    </Grid>
                </Grid>
            )}

            {/* STEP 2: Upload & Publish Progress */}
            {activeStep === 2 && (
                <Card>
                    <CardContent sx={{ textAlign: 'center', py: 6 }}>
                        {publishStatus === 'uploading-cloudinary' && (
                            <>
                                <CloudUpload sx={{ fontSize: 56, color: '#3448C5', mb: 2 }} />
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Uploading to CDN...</Typography>
                                <Box sx={{ maxWidth: 400, mx: 'auto', mb: 2 }}>
                                    <LinearProgress variant="determinate" value={uploadProgress}
                                        sx={{ height: 8, borderRadius: 4, '& .MuiLinearProgress-bar': { background: IG_GRADIENT } }} />
                                </Box>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>{uploadProgress}% uploaded</Typography>
                            </>
                        )}

                        {publishStatus === 'creating-container' && (
                            <>
                                <CircularProgress size={56} sx={{ color: '#DD2A7B', mb: 2 }} />
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Creating Instagram Container...</Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Sending media to Instagram API</Typography>
                            </>
                        )}

                        {publishStatus === 'processing' && (
                            <>
                                <CircularProgress size={56} sx={{ color: '#8134AF', mb: 2 }} />
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Processing Media...</Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>{statusMessage}</Typography>
                                <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 1 }}>
                                    This may take a minute for videos
                                </Typography>
                            </>
                        )}

                        {publishStatus === 'publishing' && (
                            <>
                                <CircularProgress size={56} sx={{ color: '#F58529', mb: 2 }} />
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Publishing...</Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Almost there!</Typography>
                            </>
                        )}

                        {publishStatus === 'done' && (
                            <>
                                <CheckCircle sx={{ fontSize: 64, color: '#4CAF50', mb: 2 }} />
                                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: '#4CAF50' }}>
                                    Published Successfully!
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                                    Your {selectedType?.label?.toLowerCase()} is now live on Instagram.
                                </Typography>
                                {publishedMediaId && (
                                    <Chip label={`Media ID: ${publishedMediaId}`} variant="outlined"
                                        sx={{ mb: 3, borderColor: 'rgba(255,255,255,0.15)' }} />
                                )}
                                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                                    <Button variant="contained" onClick={resetAll}
                                        sx={{ background: IG_GRADIENT }}>
                                        Upload Another
                                    </Button>
                                    <Button variant="outlined" onClick={() => {
                                        if (selectedAcct?.username) {
                                            window.open(`https://instagram.com/${selectedAcct.username}`, '_blank');
                                        }
                                    }}
                                        startIcon={<Instagram />}
                                        sx={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                                        View Profile
                                    </Button>
                                </Box>
                            </>
                        )}

                        {publishStatus === 'error' && (
                            <>
                                <ErrorIcon sx={{ fontSize: 64, color: '#f44336', mb: 2 }} />
                                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: '#f44336' }}>
                                    {scheduleMode ? 'Schedule Failed' : 'Publish Failed'}
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: 500, mx: 'auto' }}>
                                    {statusMessage}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                                    <Button variant="contained" onClick={() => { setActiveStep(1); setPublishStatus(''); }}
                                        sx={{ background: IG_GRADIENT }}>
                                        Try Again
                                    </Button>
                                    <Button variant="outlined" onClick={resetAll}
                                        sx={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                                        Start Over
                                    </Button>
                                </Box>
                            </>
                        )}

                        {publishStatus === 'scheduling' && (
                            <>
                                <CircularProgress size={56} sx={{ color: '#F58529', mb: 2 }} />
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Saving Schedule...</Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>{statusMessage}</Typography>
                            </>
                        )}

                        {publishStatus === 'scheduled' && (
                            <>
                                <Schedule sx={{ fontSize: 64, color: '#F58529', mb: 2 }} />
                                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: '#F58529' }}>
                                    Post Scheduled!
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                    Your {selectedType?.label?.toLowerCase()} has been scheduled.
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 600, mb: 3 }}>
                                    {statusMessage}
                                </Typography>
                                <Alert severity="info" sx={{ maxWidth: 500, mx: 'auto', mb: 3, textAlign: 'left' }}>
                                    Your post is synced and will auto-publish at the scheduled time.
                                    With <strong>GitHub Actions</strong> configured, it publishes even when your PC is off.
                                </Alert>
                                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                                    <Button variant="contained" onClick={resetAll}
                                        sx={{ background: 'linear-gradient(135deg, #F58529, #FF6B35)' }}>
                                        Schedule Another
                                    </Button>
                                    <Button variant="outlined" onClick={() => { setShowScheduled(true); resetAll(); }}
                                        startIcon={<CalendarMonth />}
                                        sx={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                                        View Scheduled
                                    </Button>
                                </Box>
                            </>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Scheduled Posts */}
            {scheduledPosts.length > 0 && (
                <Card sx={{ mt: 3 }}>
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                <CalendarMonth sx={{ verticalAlign: 'middle', mr: 1, color: '#F58529' }} />
                                Scheduled Posts ({scheduledPosts.filter(p => p.status === 'pending').length} pending)
                            </Typography>
                            <Button size="small" onClick={loadScheduledPosts} startIcon={<Schedule />}
                                sx={{ color: 'text.secondary' }}>Refresh</Button>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            {scheduledPosts.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)).map(post => {
                                const acct = igAccounts.find(a => a.id === post.accountId);
                                const typeInfo = CONTENT_TYPES.find(t => t.value === post.mediaType);
                                const isPast = new Date(post.scheduledAt) < new Date();
                                return (
                                    <Box key={post.id} sx={{
                                        display: 'flex', alignItems: 'center', gap: 2, p: 1.5,
                                        borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                    }}>
                                        <Box sx={{ color: typeInfo?.color || '#888', flexShrink: 0 }}>
                                            {typeInfo?.icon || <Photo />}
                                        </Box>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {post.caption || '(no caption)'}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                {acct?.username ? `@${acct.username}` : post.accountId} · {typeInfo?.label} · {new Date(post.scheduledAt).toLocaleString()}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            size="small"
                                            label={post.status === 'published' ? 'Published' : post.status === 'failed' ? 'Failed' : post.status === 'publishing' ? 'Publishing...' : 'Pending'}
                                            sx={{
                                                fontWeight: 600, fontSize: 11,
                                                bgcolor: post.status === 'published' ? '#4CAF5022' : post.status === 'failed' ? '#f4433622' : post.status === 'publishing' ? '#FF980022' : '#F5852922',
                                                color: post.status === 'published' ? '#4CAF50' : post.status === 'failed' ? '#f44336' : post.status === 'publishing' ? '#FF9800' : '#F58529',
                                            }}
                                        />
                                        {(post.status === 'scheduled' || post.status === 'pending') && (
                                            <IconButton size="small" onClick={() => handleDeleteScheduled(post.id)}
                                                sx={{ color: 'text.secondary', '&:hover': { color: '#f44336' } }}>
                                                <Delete fontSize="small" />
                                            </IconButton>
                                        )}
                                        {post.status === 'failed' && post.error && (
                                            <Tooltip title={post.error}>
                                                <ErrorIcon sx={{ color: '#f44336', fontSize: 18 }} />
                                            </Tooltip>
                                        )}
                                    </Box>
                                );
                            })}
                        </Box>
                    </CardContent>
                </Card>
            )}

            {/* API Info */}
            <Card sx={{ mt: 3 }}>
                <CardContent>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12 }}>
                        <strong>How it works:</strong> Files are uploaded to Cloudinary CDN first (Instagram requires public URLs),
                        then a media container is created via the Instagram API, processed by Instagram's servers, and published.
                        Rate limit: 100 posts per 24 hours per account.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                        <Chip label="JPEG Photos" size="small" variant="outlined" sx={{ borderColor: '#F5852922', color: '#F58529', fontSize: 11 }} />
                        <Chip label="MP4/MOV Reels" size="small" variant="outlined" sx={{ borderColor: '#DD2A7B22', color: '#DD2A7B', fontSize: 11 }} />
                        <Chip label="Stories" size="small" variant="outlined" sx={{ borderColor: '#8134AF22', color: '#8134AF', fontSize: 11 }} />
                        <Chip label="Max 300MB videos" size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.1)', fontSize: 11 }} />
                        <Chip label="Requires instagram_business_content_publish" size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.1)', fontSize: 11 }} />
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
}
