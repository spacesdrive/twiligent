import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Upload, Camera, Image as ImageIcon, Film, BookOpen, Trash2,
  CheckCircle2, AlertCircle, Calendar, Send, X, Plus, Copy, Square,
  UserPlus, MapPin, AtSign, Music, Clock, FolderUp,
  ExternalLink, Pencil, Trash,
} from 'lucide-react';
import MainCard from '../../components/MainCard';
import { useAppContext } from '../../context/AppContext';
import { api } from '../../services/api';
import { cn } from '@/lib/utils';

const BULK_INTERVAL_OPTIONS = [
  { value: 720,   label: 'Every 12 Hours' },
  { value: 1440,  label: 'Once a Day' },
  { value: 2880,  label: 'Every 2 Days' },
  { value: 4320,  label: 'Every 3 Days' },
  { value: 10080, label: 'Once a Week' },
];

const CONTENT_TYPES = [
  { value: 'IMAGE', label: 'Photo',    icon: ImageIcon, color: '#F58529', accept: 'image/jpeg', desc: 'JPEG, 4:5 to 1.91:1, max 8MB' },
  { value: 'REELS', label: 'Reel',     icon: Film,      color: '#DD2A7B', accept: 'video/mp4,video/quicktime', desc: 'MP4/MOV 9:16, 3s-15min, max 300MB' },
  { value: 'STORIES', label: 'Story',  icon: BookOpen,  color: '#8134AF', accept: 'image/jpeg,video/mp4,video/quicktime', desc: 'Image or video, 9:16, max 60s' },
];

const PUBLISH_STEPS = ['Select Media', 'Configure', 'Upload & Publish'];

const STATUS_CHIP_MAP = {
  published:  { label: 'Published',   cls: 'bg-green-50 border-green-200 text-green-700' },
  failed:     { label: 'Failed',      cls: 'bg-red-50 border-red-200 text-red-700' },
  publishing: { label: 'Publishing…', cls: 'bg-orange-50 border-orange-200 text-orange-700' },
  pending:    { label: 'Pending',     cls: 'bg-amber-50 border-amber-200 text-amber-700' },
};

const BULK_STATUS_MAP = {
  pending:    { label: 'Pending',      cls: 'bg-muted text-muted-foreground' },
  uploading:  { label: 'Uploading…',  cls: 'bg-blue-50 border-blue-200 text-blue-700' },
  creating:   { label: 'Creating…',   cls: 'bg-pink-50 border-pink-200 text-pink-700' },
  processing: { label: 'Processing…', cls: 'bg-purple-50 border-purple-200 text-purple-700' },
  publishing: { label: 'Publishing…', cls: 'bg-orange-50 border-orange-200 text-orange-700' },
  scheduling: { label: 'Scheduling…', cls: 'bg-orange-50 border-orange-200 text-orange-700' },
  done:       { label: 'Published',   cls: 'bg-green-50 border-green-200 text-green-700' },
  scheduled:  { label: 'Scheduled',   cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  error:      { label: 'Failed',      cls: 'bg-red-50 border-red-200 text-red-700' },
};

function StatusBadge({ status }) {
  const s = STATUS_CHIP_MAP[status] || STATUS_CHIP_MAP.pending;
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', s.cls)}>{s.label}</span>;
}

function BulkStatusBadge({ status }) {
  const s = BULK_STATUS_MAP[status] || BULK_STATUS_MAP.pending;
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', s.cls)}>{s.label}</span>;
}

export default function UploadContent() {
  const { accounts, showToast } = useAppContext();
  const [igAccounts, setIgAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [contentType, setContentType] = useState('');
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [cloudConfig, setCloudConfig] = useState(null);

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

  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');

  const [editingPostId, setEditingPostId] = useState(null);
  const [editCaption, setEditCaption] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const [activeStep, setActiveStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [publishStatus, setPublishStatus] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [publishedMediaId, setPublishedMediaId] = useState(null);

  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const bulkFileInputRef = useRef(null);
  const bulkIdCounter = useRef(0);
  const bulkCancelRef = useRef(false);

  const [uploadMode, setUploadMode] = useState('single');
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkAccount, setBulkAccount] = useState('');
  const [bulkContentType, setBulkContentType] = useState('REELS');
  const [bulkSharedCaption, setBulkSharedCaption] = useState('');
  const [bulkCollaborators, setBulkCollaborators] = useState('');
  const [bulkUserTags, setBulkUserTags] = useState('');
  const [bulkLocationId, setBulkLocationId] = useState('');
  const [bulkShareToFeed, setBulkShareToFeed] = useState(true);
  const [bulkScheduleMode, setBulkScheduleMode] = useState(false);
  const [bulkStartDate, setBulkStartDate] = useState('');
  const [bulkStartTime, setBulkStartTime] = useState('');
  const [bulkInterval, setBulkInterval] = useState(1440);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkCancelled, setBulkCancelled] = useState(false);

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
    setFilePreview(URL.createObjectURL(f));
  };

  const handleCoverSelect = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  };

  const clearFile = () => { setFile(null); setFilePreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; };
  const clearCover = () => { setCoverFile(null); setCoverPreview(null); if (coverInputRef.current) coverInputRef.current.value = ''; };

  const resetAll = () => {
    clearFile(); clearCover();
    setCaption(''); setShareToFeed(true); setAudioName(''); setThumbOffset('');
    setLocationId(''); setCollaborators(''); setUserTags(''); setAltText('');
    setContentType(''); setActiveStep(0); setPublishStatus(''); setStatusMessage('');
    setPublishedMediaId(null); setUploadProgress(0); setScheduleMode(false);
    setScheduleDate(''); setScheduleTime('');
  };

  const uploadToCloudinary = async (fileToUpload) => {
    if (!cloudConfig) throw new Error('Cloudinary not configured. Go to Settings.');
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('upload_preset', cloudConfig.uploadPreset);
    const resourceType = fileToUpload.type.startsWith('video/') ? 'video' : 'image';
    const xhr = new XMLHttpRequest();
    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener('progress', e => { if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100)); });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) { resolve(JSON.parse(xhr.responseText).secure_url); }
        else { try { reject(new Error(JSON.parse(xhr.responseText).error?.message || 'Upload failed')); } catch { reject(new Error('Upload failed')); } }
      });
      xhr.addEventListener('error', () => reject(new Error('Network error')));
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudConfig.cloudName}/${resourceType}/upload`);
      xhr.send(formData);
    });
  };

  const waitForContainer = async (containerId, accountId, maxAttempts = 30) => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const status = await api.getIGContainerStatus(containerId, accountId);
        setStatusMessage(`Processing: ${status.statusCode || 'IN_PROGRESS'}…`);
        if (status.statusCode === 'FINISHED' || status.statusCode === 'PUBLISHED') return true;
        if (status.statusCode === 'ERROR') throw new Error('Container processing failed: ' + (status.status || 'Unknown'));
        if (status.statusCode === 'EXPIRED') throw new Error('Container expired');
      } catch (err) { if (err.message.includes('processing failed') || err.message.includes('expired')) throw err; }
    }
    throw new Error('Timed out waiting for media processing');
  };

  const parseUserTags = (str) => str.split(',').map(s => {
    const parts = s.trim().replace(/^@/, '').split(/\s+/);
    return { username: parts[0], x: parts[1] ? parseFloat(parts[1]) : 0.5, y: parts[2] ? parseFloat(parts[2]) : 0.5 };
  }).filter(t => t.username);

  const handlePublish = async () => {
    if (!selectedAccount || !file || !contentType) { showToast('Select account, content type, and file', 'error'); return; }
    if (!cloudConfig) { showToast('Cloudinary not configured', 'error'); return; }
    if (scheduleMode) {
      if (!scheduleDate || !scheduleTime) { showToast('Set schedule date and time', 'error'); return; }
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
      if (scheduledAt <= new Date()) { showToast('Scheduled time must be in the future', 'error'); return; }
      setUploading(true); setPublishStatus('uploading-cloudinary'); setActiveStep(2);
      try {
        const mediaUrl = await uploadToCloudinary(file);
        let coverUrl = null;
        if (coverFile && contentType === 'REELS') { setStatusMessage('Uploading cover…'); coverUrl = await uploadToCloudinary(coverFile); }
        setPublishStatus('scheduling'); setStatusMessage('Saving scheduled post…');
        const res = await api.createScheduledPost({
          accountId: selectedAccount, platform: 'instagram', mediaType: contentType, mediaUrl, caption: caption || '',
          coverUrl: coverUrl || null, shareToFeed: contentType === 'REELS' ? shareToFeed : true,
          collaborators: collaborators ? collaborators.split(',').map(s => s.trim()).filter(Boolean) : [],
          audioName: audioName || '', thumbOffset: thumbOffset ? parseInt(thumbOffset) : null,
          locationId: locationId || '', userTags: userTags ? parseUserTags(userTags) : [],
          altText: (contentType === 'IMAGE' && altText) ? altText : '', scheduledAt: scheduledAt.toISOString(),
        });
        if (!res.success) throw new Error(res.message || 'Failed to schedule');
        setPublishStatus('scheduled'); setStatusMessage(`Scheduled for ${scheduledAt.toLocaleString()}`);
        showToast('Post scheduled!'); loadScheduledPosts();
      } catch (err) { setPublishStatus('error'); setStatusMessage(err.message); showToast('Schedule failed: ' + err.message, 'error'); }
      finally { setUploading(false); }
      return;
    }

    setUploading(true); setPublishStatus('uploading-cloudinary'); setStatusMessage('Uploading to CDN…'); setActiveStep(2);
    try {
      const mediaUrl = await uploadToCloudinary(file);
      let coverUrl = null;
      if (coverFile && contentType === 'REELS') { setStatusMessage('Uploading cover…'); coverUrl = await uploadToCloudinary(coverFile); }
      setPublishStatus('creating-container'); setStatusMessage('Creating Instagram container…');
      const containerRes = await api.createIGContainer(selectedAccount, {
        mediaType: contentType, mediaUrl, caption: caption || undefined, coverUrl: coverUrl || undefined,
        shareToFeed: contentType === 'REELS' ? shareToFeed : undefined,
        collaborators: collaborators ? collaborators.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        audioName: audioName || undefined, thumbOffset: thumbOffset ? parseInt(thumbOffset) : undefined,
        locationId: locationId || undefined, userTags: userTags ? parseUserTags(userTags) : undefined,
        altText: (contentType === 'IMAGE' && altText) ? altText : undefined,
      });
      if (!containerRes.success || !containerRes.containerId) throw new Error(containerRes.message || 'Failed to create container');
      if (contentType === 'REELS' || contentType === 'STORIES') { setPublishStatus('processing'); setStatusMessage('Instagram is processing…'); await waitForContainer(containerRes.containerId, selectedAccount); }
      else { await new Promise(r => setTimeout(r, 2000)); }
      setPublishStatus('publishing'); setStatusMessage('Publishing to Instagram…');
      const publishRes = await api.publishIGContainer(selectedAccount, containerRes.containerId);
      if (!publishRes.success || !publishRes.mediaId) throw new Error(publishRes.message || 'Publish failed');
      setPublishStatus('done'); setPublishedMediaId(publishRes.mediaId); setStatusMessage('Published successfully!');
      showToast('Content published to Instagram!');
    } catch (err) { setPublishStatus('error'); setStatusMessage(err.message); showToast('Publish failed: ' + err.message, 'error'); }
    finally { setUploading(false); }
  };

  // Bulk upload
  const handleBulkFilesSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newItems = files.map(f => ({ id: ++bulkIdCounter.current, file: f, preview: URL.createObjectURL(f), caption: '', status: 'pending', progress: 0, error: null, mediaId: null }));
    setBulkFiles(prev => {
      const updated = [...prev, ...newItems];
      if (prev.length === 0) { setBulkScheduleMode(true); setBulkInterval(1440); setBulkStartTime('08:00'); const t = new Date(); t.setDate(t.getDate() + 1); setBulkStartDate(t.toISOString().split('T')[0]); }
      return updated;
    });
    if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
  };

  const removeBulkFile = (id) => {
    setBulkFiles(prev => { const item = prev.find(f => f.id === id); if (item?.preview) URL.revokeObjectURL(item.preview); return prev.filter(f => f.id !== id); });
  };

  const updateBulkFileCaption = (id, cap) => setBulkFiles(prev => prev.map(f => f.id === id ? { ...f, caption: cap } : f));

  const applySharedCaption = () => { if (!bulkSharedCaption) return; setBulkFiles(prev => prev.map(f => f.status === 'pending' ? { ...f, caption: bulkSharedCaption } : f)); };

  const clearBulkFiles = () => { bulkFiles.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); }); setBulkFiles([]); setBulkProcessing(false); setBulkCancelled(false); bulkCancelRef.current = false; };

  const handleBulkProcess = async () => {
    if (!bulkAccount || bulkFiles.length === 0 || !bulkContentType) { showToast('Select account, type, and files', 'error'); return; }
    if (!cloudConfig) { showToast('Cloudinary not configured', 'error'); return; }
    if (bulkScheduleMode && (!bulkStartDate || !bulkStartTime)) { showToast('Set start date and time', 'error'); return; }
    const baseTime = bulkScheduleMode ? new Date(`${bulkStartDate}T${bulkStartTime}`) : null;
    if (baseTime && baseTime <= new Date()) { showToast('Start time must be in the future', 'error'); return; }
    setBulkProcessing(true); setBulkCancelled(false); bulkCancelRef.current = false;
    const pendingFiles = bulkFiles.filter(f => f.status === 'pending');
    let scheduleOffset = 0, successCount = 0, failCount = 0;
    for (let i = 0; i < pendingFiles.length; i++) {
      if (bulkCancelRef.current) break;
      const item = pendingFiles[i];
      try {
        setBulkFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading', progress: 0 } : f));
        const xhr = new XMLHttpRequest();
        const formData = new FormData(); formData.append('file', item.file); formData.append('upload_preset', cloudConfig.uploadPreset);
        const rtype = item.file.type.startsWith('video/') ? 'video' : 'image';
        const mediaUrl = await new Promise((resolve, reject) => {
          xhr.upload.addEventListener('progress', e => { if (e.lengthComputable) setBulkFiles(prev => prev.map(f => f.id === item.id ? { ...f, progress: Math.round(e.loaded / e.total * 100) } : f)); });
          xhr.addEventListener('load', () => { if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText).secure_url); else reject(new Error('Upload failed')); });
          xhr.addEventListener('error', () => reject(new Error('Network error')));
          xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudConfig.cloudName}/${rtype}/upload`); xhr.send(formData);
        });
        if (bulkCancelRef.current) break;
        if (bulkScheduleMode) {
          setBulkFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'scheduling', progress: 100 } : f));
          const scheduledAt = new Date(baseTime.getTime() + scheduleOffset * bulkInterval * 60000);
          const res = await api.createScheduledPost({ accountId: bulkAccount, platform: 'instagram', mediaType: bulkContentType, mediaUrl, caption: item.caption || '', coverUrl: null, shareToFeed: bulkContentType === 'REELS' ? bulkShareToFeed : true, collaborators: bulkCollaborators ? bulkCollaborators.split(',').map(s => s.trim()).filter(Boolean) : [], audioName: '', thumbOffset: null, locationId: bulkLocationId || '', userTags: bulkUserTags ? parseUserTags(bulkUserTags) : [], altText: '', scheduledAt: scheduledAt.toISOString() });
          if (!res.success) throw new Error(res.message || 'Failed to schedule');
          setBulkFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'scheduled', progress: 100 } : f));
          scheduleOffset++; successCount++;
        } else {
          setBulkFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'creating', progress: 100 } : f));
          const containerRes = await api.createIGContainer(bulkAccount, { mediaType: bulkContentType, mediaUrl, caption: item.caption || undefined, shareToFeed: bulkContentType === 'REELS' ? bulkShareToFeed : undefined, collaborators: bulkCollaborators ? bulkCollaborators.split(',').map(s => s.trim()).filter(Boolean) : undefined, locationId: bulkLocationId || undefined, userTags: bulkUserTags ? parseUserTags(bulkUserTags) : undefined });
          if (!containerRes.success || !containerRes.containerId) throw new Error(containerRes.message || 'Container creation failed');
          if (bulkCancelRef.current) break;
          if (bulkContentType === 'REELS' || bulkContentType === 'STORIES') {
            setBulkFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'processing' } : f));
            for (let j = 0; j < 30; j++) { await new Promise(r => setTimeout(r, 3000)); const s = await api.getIGContainerStatus(containerRes.containerId, bulkAccount); if (s.statusCode === 'FINISHED' || s.statusCode === 'PUBLISHED') break; if (s.statusCode === 'ERROR') throw new Error('Processing failed'); if (s.statusCode === 'EXPIRED') throw new Error('Container expired'); }
          } else { await new Promise(r => setTimeout(r, 2000)); }
          if (bulkCancelRef.current) break;
          setBulkFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'publishing' } : f));
          const publishRes = await api.publishIGContainer(bulkAccount, containerRes.containerId);
          if (!publishRes.success || !publishRes.mediaId) throw new Error(publishRes.message || 'Publish failed');
          setBulkFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'done', mediaId: publishRes.mediaId } : f));
          successCount++;
        }
      } catch (err) { setBulkFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error', error: err.message } : f)); failCount++; }
      if (i < pendingFiles.length - 1 && !bulkCancelRef.current) await new Promise(r => setTimeout(r, 2000));
    }
    setBulkProcessing(false);
    if (bulkCancelRef.current) { showToast('Bulk upload cancelled', 'warning'); }
    else { showToast(`Bulk complete: ${successCount} succeeded, ${failCount} failed`, successCount > 0 ? 'success' : 'error'); if (bulkScheduleMode) loadScheduledPosts(); }
  };

  const handleDeleteScheduled = async (id) => {
    try { await api.deleteScheduledPost(id); showToast('Post removed'); setConfirmDeleteId(null); loadScheduledPosts(); }
    catch (err) { showToast('Delete failed: ' + err.message, 'error'); setConfirmDeleteId(null); }
  };

  const handleDeleteAll = async () => {
    try { const res = await api.deleteAllScheduledPosts(); showToast(`Deleted ${res.deleted} post(s)`); setConfirmDeleteAll(false); loadScheduledPosts(); }
    catch (err) { showToast('Delete all failed: ' + err.message, 'error'); setConfirmDeleteAll(false); }
  };

  const startEditPost = (post) => {
    setEditingPostId(post.id); setEditCaption(post.caption || '');
    const dt = new Date(post.scheduledAt);
    setEditDate(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`);
    setEditTime(`${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`);
  };
  const cancelEdit = () => { setEditingPostId(null); setEditCaption(''); setEditDate(''); setEditTime(''); };

  const handleSaveEdit = async () => {
    if (!editingPostId || !editDate || !editTime) { showToast('Set date and time', 'error'); return; }
    const scheduledAt = new Date(`${editDate}T${editTime}`);
    if (scheduledAt <= new Date()) { showToast('Scheduled time must be in the future', 'error'); return; }
    setSavingEdit(true);
    try {
      const res = await api.updateScheduledPost(editingPostId, { caption: editCaption, scheduledAt: scheduledAt.toISOString() });
      if (!res.success) throw new Error(res.message || 'Update failed');
      showToast('Post updated & synced'); cancelEdit(); loadScheduledPosts();
    } catch (err) { showToast('Update failed: ' + err.message, 'error'); }
    finally { setSavingEdit(false); }
  };

  const canProceed = () => { if (activeStep === 0) return !!file && !!contentType && !!selectedAccount; return true; };
  const selectedAcct = igAccounts.find(a => a.id === selectedAccount);
  const selectedType = CONTENT_TYPES.find(t => t.value === contentType);

  const bulkStats = {
    total: bulkFiles.length,
    pending: bulkFiles.filter(f => f.status === 'pending').length,
    done: bulkFiles.filter(f => f.status === 'done').length,
    scheduled: bulkFiles.filter(f => f.status === 'scheduled').length,
    errors: bulkFiles.filter(f => f.status === 'error').length,
    active: bulkFiles.filter(f => ['uploading','creating','processing','publishing','scheduling'].includes(f.status)).length,
  };

  const fmtLocalDate = (iso) => iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-';

  const sPostsCounts = {
    all: scheduledPosts.length,
    pending: scheduledPosts.filter(p => p.status === 'pending').length,
    publishing: scheduledPosts.filter(p => p.status === 'publishing').length,
    published: scheduledPosts.filter(p => p.status === 'published').length,
    failed: scheduledPosts.filter(p => p.status === 'failed').length,
  };
  const filteredScheduled = scheduledPosts.filter(p => statusFilter === 'all' || p.status === statusFilter).sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Upload className="h-7 w-7 text-pink-500" />
          <h1 className="text-2xl font-bold tracking-tight">Upload Content</h1>
        </div>
        {publishStatus === 'done' && uploadMode === 'single' && (
          <Button size="sm" onClick={resetAll} style={{ background: 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)' }} className="text-white">Upload Another</Button>
        )}
      </div>

      {igAccounts.length === 0 && (
        <Alert><AlertDescription>No Instagram accounts found. Add an account in the Accounts section first.</AlertDescription></Alert>
      )}
      {!cloudConfig && (
        <Alert><AlertDescription><strong>Cloudinary CDN required</strong> - Configure it in <strong>Settings</strong> to enable uploads.</AlertDescription></Alert>
      )}

      {/* Mode Tabs */}
      <Tabs value={uploadMode} onValueChange={setUploadMode}>
        <TabsList>
          <TabsTrigger value="single" className="gap-2"><Upload className="h-4 w-4" />Single Upload</TabsTrigger>
          <TabsTrigger value="bulk" className="gap-2">
            <FolderUp className="h-4 w-4" />
            Bulk Upload
            {bulkFiles.length > 0 && <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{bulkFiles.length}</span>}
          </TabsTrigger>
        </TabsList>

        {/* ===== SINGLE UPLOAD ===== */}
        <TabsContent value="single" className="mt-4">
          {/* Stepper */}
          <div className="flex items-center gap-2 mb-6">
            {PUBLISH_STEPS.map((label, i) => (
              <React.Fragment key={label}>
                <div className={cn('flex items-center gap-2 text-sm font-medium', i === activeStep ? 'text-foreground' : i < activeStep ? 'text-primary' : 'text-muted-foreground')}>
                  <span className={cn('h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2', i === activeStep ? 'border-primary bg-primary text-primary-foreground' : i < activeStep ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30')}>{i + 1}</span>
                  <span className="hidden sm:block">{label}</span>
                </div>
                {i < PUBLISH_STEPS.length - 1 && <div className={cn('flex-1 h-0.5 rounded', i < activeStep ? 'bg-primary' : 'bg-border')} />}
              </React.Fragment>
            ))}
          </div>

          {/* Step 0: Select Media */}
          {activeStep === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Platform & Account */}
                <MainCard title="Platform & Account">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF, #515BD4)' }}>
                        <Camera className="h-3 w-3" /> Instagram
                      </span>
                      <span className="text-xs text-muted-foreground">YouTube coming soon</span>
                    </div>
                    <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                      <SelectTrigger>
                        {selectedAcct ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="size-5 shrink-0"><AvatarImage src={selectedAcct.profilePictureUrl || selectedAcct.thumbnailUrl} /><AvatarFallback className="text-[9px] bg-gradient-to-br from-pink-500 to-purple-600 text-white">{(selectedAcct.title || selectedAcct.username || '?')[0].toUpperCase()}</AvatarFallback></Avatar>
                            <span className="text-sm truncate">{selectedAcct.title || selectedAcct.username}</span>
                            {selectedAcct.username && <span className="text-xs text-muted-foreground shrink-0">@{selectedAcct.username}</span>}
                          </div>
                        ) : (
                          <SelectValue placeholder="Select account…" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {igAccounts.map(a => (
                            <SelectItem key={a.id} value={a.id}>
                              <div className="flex items-center gap-2">
                                <Avatar className="size-5 shrink-0"><AvatarImage src={a.profilePictureUrl || a.thumbnailUrl} /><AvatarFallback className="text-[9px] bg-gradient-to-br from-pink-500 to-purple-600 text-white">{(a.title || a.username || '?')[0].toUpperCase()}</AvatarFallback></Avatar>
                                <span className="text-sm font-medium truncate">{a.title || a.username}</span>
                                {a.username && <span className="text-xs text-muted-foreground shrink-0">@{a.username}</span>}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </MainCard>

                {/* Content Type */}
                <MainCard title="Content Type">
                  <div className="grid grid-cols-3 gap-2">
                    {CONTENT_TYPES.map(t => {
                      const Icon = t.icon;
                      return (
                        <button key={t.value} onClick={() => { setContentType(t.value); clearFile(); }}
                          className={cn('flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 cursor-pointer transition-all text-center', contentType === t.value ? 'border-current' : 'border-border hover:border-muted-foreground/50')}
                          style={{ borderColor: contentType === t.value ? t.color : undefined, background: contentType === t.value ? `${t.color}15` : undefined }}>
                          <Icon className="h-5 w-5" style={{ color: t.color }} />
                          <span className="text-xs font-semibold">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedType && <p className="text-xs text-muted-foreground mt-2">{selectedType.desc}</p>}
                </MainCard>
              </div>

              {/* File Upload */}
              <MainCard title="Select File">
                {!file ? (
                  <button onClick={() => contentType && fileInputRef.current?.click()}
                    className={cn('w-full border-2 border-dashed rounded-xl p-10 text-center transition-all', contentType ? 'cursor-pointer hover:border-pink-500 hover:bg-pink-500/5 border-border' : 'cursor-not-allowed border-border opacity-50')}>
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="font-medium">{contentType ? 'Click to select file' : 'Choose a content type first'}</p>
                    {selectedType && <p className="text-xs text-muted-foreground mt-1">{selectedType.desc}</p>}
                  </button>
                ) : (
                  <div className="flex gap-4 items-start">
                    <div className="relative w-48 flex-shrink-0 rounded-lg overflow-hidden">
                      {file.type.startsWith('video/') ? (
                        <video src={filePreview} controls muted className="w-full max-h-64 object-contain bg-black rounded-lg" />
                      ) : (
                        <img src={filePreview} className="w-full max-h-64 object-contain rounded-lg bg-muted" alt="" />
                      )}
                      <button onClick={clearFile} className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-500 transition-colors"><X className="h-3 w-3" /></button>
                    </div>
                    <div>
                      <p className="font-semibold">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB · {file.type}</p>
                      <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-semibold border" style={{ borderColor: `${selectedType?.color}50`, color: selectedType?.color, background: `${selectedType?.color}15` }}>{selectedType?.label}</span>
                    </div>
                  </div>
                )}
                <input ref={fileInputRef} type="file" hidden accept={selectedType?.accept || '*'} onChange={handleFileSelect} />
              </MainCard>

              <div className="flex justify-end">
                <Button disabled={!canProceed()} onClick={() => setActiveStep(1)} style={{ background: 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)' }} className="text-white px-6">Next: Configure Settings</Button>
              </div>
            </div>
          )}

          {/* Step 1: Configure */}
          {activeStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Caption & Details */}
                <div className="md:col-span-2">
                  <MainCard title="Caption & Details">
                    <div className="space-y-3">
                      <div>
                        <Textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Write your caption… #hashtags @mentions" rows={4} />
                        <p className="text-xs text-muted-foreground mt-1">{caption.length}/2,200 characters</p>
                      </div>
                      {contentType === 'IMAGE' && (
                        <div className="relative"><ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={altText} onChange={e => setAltText(e.target.value)} placeholder="Alt text for accessibility" /></div>
                      )}
                      <div className="relative"><UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={collaborators} onChange={e => setCollaborators(e.target.value)} placeholder="Collaborators (username1, username2)" /></div>
                      <div className="relative"><AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={userTags} onChange={e => setUserTags(e.target.value)} placeholder="Tag users (@username1, @username2)" /></div>
                      <div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={locationId} onChange={e => setLocationId(e.target.value)} placeholder="Location ID (Facebook Page ID)" /></div>
                    </div>
                  </MainCard>
                </div>

                {/* Settings & Summary */}
                <MainCard title={contentType === 'REELS' ? 'Reel Settings' : 'Post Settings'}>
                  <div className="space-y-3">
                    {contentType === 'REELS' && (
                      <>
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Share to Feed</Label>
                          <Switch checked={shareToFeed} onCheckedChange={setShareToFeed} />
                        </div>
                        <div className="relative"><Music className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={audioName} onChange={e => setAudioName(e.target.value)} placeholder="Audio name (optional)" /></div>
                        <div className="relative"><Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9 " type="number" value={thumbOffset} onChange={e => setThumbOffset(e.target.value)} placeholder="Thumbnail offset (ms)" /></div>
                        <div>
                          <Label className="text-sm font-medium mb-1.5 block">Cover Image (optional)</Label>
                          {!coverFile ? (
                            <Button variant="outline" size="sm" onClick={() => coverInputRef.current?.click()} className="gap-2"><Camera className="h-3.5 w-3.5" />Select Cover</Button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <img src={coverPreview} className="h-10 w-10 rounded object-cover" alt="" />
                              <span className="text-xs flex-1 truncate">{coverFile.name}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearCover}><X className="h-3 w-3" /></Button>
                            </div>
                          )}
                          <input ref={coverInputRef} type="file" hidden accept="image/jpeg" onChange={handleCoverSelect} />
                        </div>
                      </>
                    )}
                    <Separator />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Account: <strong className="text-foreground">{selectedAcct?.title || selectedAcct?.username || '-'}</strong></p>
                      <p>Type: <strong style={{ color: selectedType?.color }}>{selectedType?.label}</strong></p>
                      <p>File: <strong className="text-foreground">{file?.name || '-'}</strong></p>
                      <p>Size: <strong className="text-foreground">{file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : '-'}</strong></p>
                      {scheduleMode && scheduleDate && scheduleTime && <p>Schedule: <strong className="text-amber-600">{new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString()}</strong></p>}
                    </div>
                  </div>
                </MainCard>
              </div>

              {/* Schedule */}
              <MainCard>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2"><Calendar className="h-5 w-5 text-amber-500" /><h3 className="font-semibold">Schedule for Later</h3></div>
                  <div className="flex items-center gap-2"><Label className="text-sm">{scheduleMode ? 'Scheduled' : 'Publish Now'}</Label><Switch checked={scheduleMode} onCheckedChange={setScheduleMode} /></div>
                </div>
                {scheduleMode && (
                  <div className="space-y-3">
                    <div className="flex gap-3 flex-wrap">
                      <Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-44" />
                      <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-36" />
                      {scheduleDate && scheduleTime && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700">
                          <Calendar className="h-3 w-3" />{new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <Alert><AlertDescription><strong>Cloud Scheduling.</strong> Your file is uploaded to Cloudinary now. With <strong>GitHub Actions</strong> configured, posts publish even when your PC is off.</AlertDescription></Alert>
                  </div>
                )}
              </MainCard>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setActiveStep(0)}>Back</Button>
                <Button onClick={handlePublish} disabled={uploading || (scheduleMode && (!scheduleDate || !scheduleTime))}
                  style={{ background: scheduleMode ? 'linear-gradient(135deg, #F58529, #FF6B35)' : 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)' }} className="text-white gap-2 px-6">
                  {uploading ? <Spinner /> : (scheduleMode ? <Calendar data-icon="inline-start" /> : <Send data-icon="inline-start" />)}
                  {scheduleMode ? 'Schedule Post' : 'Upload & Publish Now'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Progress */}
          {activeStep === 2 && (
            <MainCard>
              <div className="flex flex-col items-center text-center py-8 gap-3">
                {publishStatus === 'uploading-cloudinary' && (
                  <>
                    <Upload className="h-14 w-14 text-blue-500" />
                    <h3 className="text-lg font-bold">Uploading to CDN…</h3>
                    <div className="w-72"><Progress value={uploadProgress} className="h-2" /></div>
                    <p className="text-sm text-muted-foreground">{uploadProgress}% uploaded</p>
                  </>
                )}
                {(publishStatus === 'creating-container' || publishStatus === 'publishing' || publishStatus === 'scheduling') && (
                  <>
                    <Spinner className="size-12" />
                    <h3 className="text-lg font-bold">{publishStatus === 'creating-container' ? 'Creating Instagram Container…' : publishStatus === 'scheduling' ? 'Saving Schedule…' : 'Publishing…'}</h3>
                    <p className="text-sm text-muted-foreground">{statusMessage}</p>
                  </>
                )}
                {publishStatus === 'processing' && (
                  <>
                    <Spinner className="size-12" />
                    <h3 className="text-lg font-bold">Processing Media…</h3>
                    <p className="text-sm text-muted-foreground">{statusMessage}</p>
                    <p className="text-xs text-muted-foreground">This may take a minute for videos</p>
                  </>
                )}
                {publishStatus === 'done' && (
                  <>
                    <CheckCircle2 className="h-16 w-16 text-green-500" />
                    <h3 className="text-xl font-bold text-green-600">Published Successfully!</h3>
                    <p className="text-sm text-muted-foreground">Your {selectedType?.label?.toLowerCase()} is now live on Instagram.</p>
                    {publishedMediaId && <Badge variant="outline">Media ID: {publishedMediaId}</Badge>}
                    <div className="flex gap-2 mt-2">
                      <Button onClick={resetAll} style={{ background: 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)' }} className="text-white">Upload Another</Button>
                      {selectedAcct?.username && <Button variant="outline" onClick={() => window.open(`https://instagram.com/${selectedAcct.username}`, '_blank')} className="gap-2"><Camera className="h-4 w-4" />View Profile</Button>}
                    </div>
                  </>
                )}
                {publishStatus === 'scheduled' && (
                  <>
                    <Calendar className="h-16 w-16 text-amber-500" />
                    <h3 className="text-xl font-bold text-amber-600">Post Scheduled!</h3>
                    <p className="text-sm text-muted-foreground">Your {selectedType?.label?.toLowerCase()} has been scheduled.</p>
                    <p className="font-semibold">{statusMessage}</p>
                    <Alert className="max-w-sm text-left"><AlertDescription>Your post is synced and will auto-publish at the scheduled time. With <strong>GitHub Actions</strong> it publishes even when your PC is off.</AlertDescription></Alert>
                    <div className="flex gap-2 mt-2">
                      <Button onClick={resetAll} style={{ background: 'linear-gradient(135deg, #F58529, #FF6B35)' }} className="text-white">Schedule Another</Button>
                    </div>
                  </>
                )}
                {publishStatus === 'error' && (
                  <>
                    <AlertCircle className="h-16 w-16 text-red-500" />
                    <h3 className="text-xl font-bold text-red-600">{scheduleMode ? 'Schedule Failed' : 'Publish Failed'}</h3>
                    <p className="text-sm text-muted-foreground max-w-md">{statusMessage}</p>
                    <div className="flex gap-2 mt-2">
                      <Button onClick={() => { setActiveStep(1); setPublishStatus(''); }} style={{ background: 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)' }} className="text-white">Try Again</Button>
                      <Button variant="outline" onClick={resetAll}>Start Over</Button>
                    </div>
                  </>
                )}
              </div>
            </MainCard>
          )}
        </TabsContent>

        {/* ===== BULK UPLOAD ===== */}
        <TabsContent value="bulk" className="mt-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Account & Type */}
              <MainCard title="Account & Type">
                <div className="space-y-3">
                  {(() => {
                    const bulkAcct = igAccounts.find(a => a.id === bulkAccount);
                    return (
                      <Select value={bulkAccount} onValueChange={setBulkAccount} disabled={bulkProcessing}>
                        <SelectTrigger>
                          {bulkAcct ? (
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar className="size-5 shrink-0"><AvatarImage src={bulkAcct.profilePictureUrl || bulkAcct.thumbnailUrl} /><AvatarFallback className="text-[9px] bg-gradient-to-br from-pink-500 to-purple-600 text-white">{(bulkAcct.title || bulkAcct.username || '?')[0].toUpperCase()}</AvatarFallback></Avatar>
                              <span className="text-sm truncate">{bulkAcct.title || bulkAcct.username}</span>
                              {bulkAcct.username && <span className="text-xs text-muted-foreground shrink-0">@{bulkAcct.username}</span>}
                            </div>
                          ) : (
                            <SelectValue placeholder="Select account…" />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {igAccounts.map(a => (
                              <SelectItem key={a.id} value={a.id}>
                                <div className="flex items-center gap-2">
                                  <Avatar className="size-5 shrink-0"><AvatarImage src={a.profilePictureUrl || a.thumbnailUrl} /><AvatarFallback className="text-[9px] bg-gradient-to-br from-pink-500 to-purple-600 text-white">{(a.title || a.username || '?')[0].toUpperCase()}</AvatarFallback></Avatar>
                                  <span className="text-sm font-medium truncate">{a.title || a.username}</span>
                                  {a.username && <span className="text-xs text-muted-foreground shrink-0">@{a.username}</span>}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    );
                  })()}
                  <div className="grid grid-cols-3 gap-2">
                    {CONTENT_TYPES.map(t => {
                      const Icon = t.icon;
                      return (
                        <button key={t.value} onClick={() => !bulkProcessing && setBulkContentType(t.value)}
                          className={cn('flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-all text-center', bulkProcessing && 'opacity-50 cursor-not-allowed', bulkContentType === t.value ? 'border-current' : 'border-border hover:border-muted-foreground/50')}
                          style={{ borderColor: bulkContentType === t.value ? t.color : undefined, background: bulkContentType === t.value ? `${t.color}15` : undefined }}>
                          <Icon className="h-4 w-4" style={{ color: t.color }} />
                          <span className="text-[11px] font-semibold">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </MainCard>

              {/* Shared Settings */}
              <MainCard title="Shared Settings">
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Textarea value={bulkSharedCaption} onChange={e => setBulkSharedCaption(e.target.value)} placeholder="Shared caption for all files…" rows={2} disabled={bulkProcessing} className="flex-1" />
                    <Tooltip>
                      <TooltipTrigger render={<Button variant="outline" size="icon" onClick={applySharedCaption} disabled={!bulkSharedCaption || bulkProcessing} />}>
                        <Copy />
                      </TooltipTrigger>
                      <TooltipContent>Apply to all pending</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="relative"><UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={bulkCollaborators} onChange={e => setBulkCollaborators(e.target.value)} placeholder="Collaborators (all posts)" disabled={bulkProcessing} /></div>
                  <div className="relative"><AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={bulkUserTags} onChange={e => setBulkUserTags(e.target.value)} placeholder="Tag users (all posts)" disabled={bulkProcessing} /></div>
                  {bulkContentType === 'REELS' && (
                    <div className="flex items-center justify-between"><Label className="text-sm">Share Reels to Feed</Label><Switch checked={bulkShareToFeed} onCheckedChange={setBulkShareToFeed} disabled={bulkProcessing} /></div>
                  )}
                </div>
              </MainCard>
            </div>

            {/* File Picker */}
            <MainCard>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><FolderUp className="h-5 w-5 text-pink-500" /><h3 className="font-semibold">Files ({bulkFiles.length})</h3></div>
                <div className="flex gap-2">
                  {bulkFiles.length > 0 && !bulkProcessing && (
                    <Button size="sm" variant="outline" onClick={clearBulkFiles} className="gap-1.5 text-red-500 border-red-200 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" />Clear All</Button>
                  )}
                  <Button size="sm" onClick={() => bulkFileInputRef.current?.click()} disabled={bulkProcessing} style={{ background: 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)' }} className="text-white gap-1.5"><Plus className="h-3.5 w-3.5" />Add Files</Button>
                </div>
              </div>
              <input ref={bulkFileInputRef} type="file" hidden multiple accept={CONTENT_TYPES.find(t => t.value === bulkContentType)?.accept || '*'} onChange={handleBulkFilesSelect} />

              {bulkFiles.length === 0 ? (
                <button onClick={() => bulkFileInputRef.current?.click()} className="w-full border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-pink-500 hover:bg-pink-500/5 transition-all">
                  <FolderUp className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="font-medium">Click to select multiple files</p>
                  <p className="text-xs text-muted-foreground mt-1">Select multiple videos or images at once</p>
                </button>
              ) : (
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {bulkFiles.map((item, idx) => {
                    const isActive = ['uploading','creating','processing','publishing','scheduling'].includes(item.status);
                    return (
                      <div key={item.id} className={cn('flex items-start gap-3 p-3 rounded-lg border transition-all', isActive ? 'bg-card/50' : 'bg-muted/20 border-border')}>
                        <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-muted relative">
                          {item.file.type.startsWith('video/') ? <video src={item.preview} muted className="w-full h-full object-cover" /> : <img src={item.preview} className="w-full h-full object-cover" alt="" />}
                          <span className="absolute top-0.5 left-0.5 bg-black/70 text-white text-[9px] font-bold px-1 rounded">#{idx + 1}</span>
                          {item.status === 'uploading' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40"><div className="h-full bg-gradient-to-r from-orange-500 to-pink-500 transition-all" style={{ width: `${item.progress}%` }} /></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold truncate">{item.file.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{(item.file.size / (1024 * 1024)).toFixed(1)} MB</span>
                          </div>
                          {item.status === 'pending' ? (
                            <Textarea value={item.caption} onChange={e => updateBulkFileCaption(item.id, e.target.value)} placeholder={`Caption for file #${idx + 1}…`} rows={1} className="text-xs" />
                          ) : (
                            <p className="text-xs text-muted-foreground">{item.caption || '(no caption)'}</p>
                          )}
                          {item.status === 'uploading' && <Progress value={item.progress} className="h-1 mt-1" />}
                          {item.error && <p className="text-xs text-red-500 mt-0.5">{item.error}</p>}
                          {item.mediaId && <p className="text-xs text-green-600 mt-0.5">Media ID: {item.mediaId}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isActive && <Spinner />}
                          <BulkStatusBadge status={item.status} />
                          {item.status === 'pending' && !bulkProcessing && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500" onClick={() => removeBulkFile(item.id)}><X className="h-3 w-3" /></Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </MainCard>

            {/* Bulk Schedule */}
            <MainCard>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><Calendar className="h-5 w-5 text-amber-500" /><h3 className="font-semibold">Bulk Schedule</h3></div>
                <div className="flex items-center gap-2"><Label className="text-sm">{bulkScheduleMode ? 'Schedule All' : 'Publish All Now'}</Label><Switch checked={bulkScheduleMode} onCheckedChange={setBulkScheduleMode} disabled={bulkProcessing} /></div>
              </div>
              {bulkScheduleMode && (
                <div className="space-y-3">
                  <div className="flex gap-3 flex-wrap">
                    <Input type="date" value={bulkStartDate} onChange={e => setBulkStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-44" disabled={bulkProcessing} />
                    <Input type="time" value={bulkStartTime} onChange={e => setBulkStartTime(e.target.value)} className="w-36" disabled={bulkProcessing} />
                    <Select value={String(bulkInterval)} onValueChange={v => setBulkInterval(Number(v))} disabled={bulkProcessing}>
                      <SelectTrigger className="w-48">
                        <span className="flex flex-1 text-left text-sm">
                          {BULK_INTERVAL_OPTIONS.find(o => o.value === bulkInterval)?.label}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {BULK_INTERVAL_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  {bulkStartDate && bulkStartTime && bulkStats.pending > 0 && (
                    <Alert><AlertDescription>
                      <strong>Schedule Preview:</strong> {bulkStats.pending} files starting at <strong>{new Date(`${bulkStartDate}T${bulkStartTime}`).toLocaleString()}</strong>,
                      spaced <strong>{bulkInterval >= 1440 ? `${bulkInterval / 1440} day${bulkInterval > 1440 ? 's' : ''}` : `${bulkInterval / 60} hr${bulkInterval > 60 ? 's' : ''}`}</strong> apart.
                      Last post at <strong>{new Date(new Date(`${bulkStartDate}T${bulkStartTime}`).getTime() + (bulkStats.pending - 1) * bulkInterval * 60000).toLocaleString()}</strong>.
                    </AlertDescription></Alert>
                  )}
                </div>
              )}
              {!bulkScheduleMode && bulkStats.pending > 0 && (
                <Alert className="mt-2"><AlertDescription><strong>Immediate publish:</strong> {bulkStats.pending} files will be uploaded and published one-by-one. Rate limit: 100 posts/24hr.</AlertDescription></Alert>
              )}
            </MainCard>

            {/* Progress summary */}
            {(bulkProcessing || bulkStats.done > 0 || bulkStats.scheduled > 0 || bulkStats.errors > 0) && (
              <MainCard title={bulkProcessing ? 'Processing…' : 'Results'}>
                <div className="flex gap-2 flex-wrap mb-3">
                  <Badge variant="outline">{bulkStats.total} Total</Badge>
                  {bulkStats.done > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 border border-green-200 text-green-700"><CheckCircle2 className="h-3 w-3" />{bulkStats.done} Published</span>}
                  {bulkStats.scheduled > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700"><Calendar className="h-3 w-3" />{bulkStats.scheduled} Scheduled</span>}
                  {bulkStats.errors > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 border border-red-200 text-red-700"><AlertCircle className="h-3 w-3" />{bulkStats.errors} Failed</span>}
                  {bulkStats.pending > 0 && <Badge variant="secondary">{bulkStats.pending} Pending</Badge>}
                </div>
                {bulkProcessing && <Progress value={((bulkStats.done + bulkStats.scheduled + bulkStats.errors) / bulkStats.total) * 100} className="h-2" />}
              </MainCard>
            )}

            <div className="flex justify-end">
              {bulkProcessing ? (
                <Button variant="destructive" onClick={() => { bulkCancelRef.current = true; setBulkCancelled(true); }} className="gap-2 px-6"><Square className="h-4 w-4" />Cancel</Button>
              ) : (
                <Button onClick={handleBulkProcess} disabled={bulkStats.pending === 0 || !bulkAccount || !bulkContentType}
                  style={{ background: bulkScheduleMode ? 'linear-gradient(135deg, #F58529, #FF6B35)' : 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)' }} className="text-white gap-2 px-6">
                  {bulkScheduleMode ? <Calendar className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  {bulkScheduleMode ? `Schedule ${bulkStats.pending} Posts` : `Publish ${bulkStats.pending} Posts Now`}
                </Button>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Scheduled Posts Table */}
      {scheduledPosts.length > 0 && (
        <MainCard content={false}>
          <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2"><Calendar className="h-5 w-5 text-amber-500" /><h3 className="font-bold">Scheduled Posts</h3></div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={loadScheduledPosts} className="gap-1.5 text-muted-foreground"><Calendar className="h-3.5 w-3.5" />Refresh</Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmDeleteAll(true)} className="gap-1.5 text-red-500 border-red-200 hover:bg-red-50"><Trash className="h-3.5 w-3.5" />Delete All</Button>
            </div>
          </div>
          <Separator />
          <div className="px-5 py-3 flex gap-2 flex-wrap">
            {[
              { label: 'Total', value: sPostsCounts.all, color: 'default', filter: 'all' },
              { label: 'Pending', value: sPostsCounts.pending, cls: 'bg-amber-50 border-amber-200 text-amber-700', filter: 'pending' },
              { label: 'Publishing', value: sPostsCounts.publishing, cls: 'bg-orange-50 border-orange-200 text-orange-700', filter: 'publishing' },
              { label: 'Published', value: sPostsCounts.published, cls: 'bg-green-50 border-green-200 text-green-700', filter: 'published' },
              { label: 'Failed', value: sPostsCounts.failed, cls: 'bg-red-50 border-red-200 text-red-700', filter: 'failed' },
            ].map(s => (
              <button key={s.filter} onClick={() => setStatusFilter(s.filter)}
                className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border cursor-pointer transition-all', statusFilter === s.filter ? (s.cls || 'bg-muted text-foreground border-border') : 'bg-muted/30 text-muted-foreground border-transparent hover:border-border')}>
                {s.label}: {s.value}
              </button>
            ))}
          </div>
          <Separator />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="min-w-48">Caption</TableHead>
                <TableHead className="min-w-40">Scheduled At</TableHead>
                <TableHead className="min-w-40">Published At</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="min-w-40">Error</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredScheduled.map((post, idx) => {
                const acct = igAccounts.find(a => a.id === post.accountId);
                const typeInfo = CONTENT_TYPES.find(t => t.value === post.mediaType);
                const Icon = typeInfo?.icon || ImageIcon;
                const isEditing = editingPostId === post.id;
                const canEdit = post.status === 'pending' || post.status === 'scheduled';
                const isPastDue = post.status === 'pending' && new Date(post.scheduledAt) < new Date();
                return (
                  <React.Fragment key={post.id}>
                    <TableRow className={isEditing ? 'bg-amber-50/50' : ''}>
                      <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-6 w-6"><AvatarImage src={acct?.profilePictureUrl} /><AvatarFallback className="text-[9px] bg-gradient-to-br from-pink-500 to-purple-600 text-white">{(acct?.username || '?')[0].toUpperCase()}</AvatarFallback></Avatar>
                          <span className="text-xs font-semibold whitespace-nowrap">{acct?.username ? `@${acct.username}` : post.accountId}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" style={{ color: typeInfo?.color || '#888' }}>
                          <Icon className="h-3.5 w-3.5" />
                          <span className="text-xs font-semibold">{typeInfo?.label || post.mediaType}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger render={<p className="text-xs max-w-48 truncate cursor-default text-muted-foreground" />}>
                            {post.caption || '(no caption)'}
                          </TooltipTrigger>
                          <TooltipContent>{post.caption || '(no caption)'}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <span className={cn('text-xs whitespace-nowrap', isPastDue ? 'text-orange-500' : 'text-muted-foreground')}>{fmtLocalDate(post.scheduledAt)}</span>
                        {isPastDue && <p className="text-[10px] text-orange-500">overdue</p>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className={cn('text-xs whitespace-nowrap', post.publishedAt ? 'text-green-600' : 'text-muted-foreground')}>{fmtLocalDate(post.publishedAt)}</span>
                          {post.publishedMediaId && <Tooltip><TooltipTrigger><ExternalLink className="h-3 w-3 text-green-500/50" /></TooltipTrigger><TooltipContent>Media ID: {post.publishedMediaId}</TooltipContent></Tooltip>}
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={post.status} /></TableCell>
                      <TableCell>
                        {post.error ? (
                          <Tooltip><TooltipTrigger render={<p className="text-xs max-w-40 truncate text-red-500 cursor-help" />}>{post.error}</TooltipTrigger><TooltipContent>{post.error}</TooltipContent></Tooltip>
                        ) : <span className="text-muted-foreground text-xs">-</span>}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {canEdit && !isEditing && <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-amber-500" onClick={() => startEditPost(post)} />}><Pencil /></TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip>}
                        {isEditing && <Button variant="ghost" size="icon" className="size-7 text-amber-500" onClick={cancelEdit}><X /></Button>}
                        {post.status !== 'publishing' && <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-red-500" onClick={() => post.status === 'published' ? setConfirmDeleteId(post.id) : handleDeleteScheduled(post.id)} />}><Trash2 /></TooltipTrigger><TooltipContent>{post.status === 'published' ? 'Remove from records' : 'Delete'}</TooltipContent></Tooltip>}
                      </TableCell>
                    </TableRow>
                    {isEditing && (
                      <TableRow>
                        <TableCell colSpan={9} className="p-0">
                          <div className="p-4 bg-amber-50/30 border-t border-amber-200/50 space-y-3">
                            <Textarea value={editCaption} onChange={e => setEditCaption(e.target.value)} label="Caption" rows={3} />
                            <p className="text-xs text-muted-foreground">{editCaption.length}/2,200 characters</p>
                            <div className="flex gap-3 flex-wrap">
                              <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-44" />
                              <Input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} className="w-36" />
                              {editDate && editTime && <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700"><Calendar className="h-3 w-3" />{new Date(`${editDate}T${editTime}`).toLocaleString()}</span>}
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                              <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit} className="gap-1.5" style={{ background: 'linear-gradient(135deg, #F58529, #FF6B35)' }}>
                                {savingEdit ? <Spinner /> : <CheckCircle2 data-icon="inline-start" />}
                                {savingEdit ? 'Saving…' : 'Save & Sync'}
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredScheduled.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No posts with status "{statusFilter}"</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </MainCard>
      )}

      {/* API Info */}
      <MainCard>
        <p className="text-xs text-muted-foreground"><strong>How it works:</strong> Files are uploaded to Cloudinary CDN first (Instagram needs public URLs), then a media container is created, processed, and published. Rate limit: 100 posts/24hr per account.</p>
        <div className="flex gap-2 mt-3 flex-wrap">
          {[{ label: 'JPEG Photos', color: '#F58529' }, { label: 'MP4/MOV Reels', color: '#DD2A7B' }, { label: 'Stories', color: '#8134AF' }, { label: 'Max 300MB videos', color: undefined }, { label: 'instagram_business_content_publish required', color: undefined }].map(c => (
            <span key={c.label} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border" style={{ borderColor: c.color ? `${c.color}40` : undefined, color: c.color }}>{c.label}</span>
          ))}
        </div>
      </MainCard>

      {/* Delete All confirmation */}
      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all scheduled posts?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes every post from your records (pending, published, and failed) and syncs to GitHub.
              Posts already <strong>published to Instagram remain live</strong> - only local records are deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteAll}>
              <Trash data-icon="inline-start" />Delete All & Sync
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm remove published post */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={v => !v && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove published post?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the entry from your records and syncs to GitHub.
              The post will <strong>remain live on Instagram</strong> - only local records are removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => handleDeleteScheduled(confirmDeleteId)}>
              Remove Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
