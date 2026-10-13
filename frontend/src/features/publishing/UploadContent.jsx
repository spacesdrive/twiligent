import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload, Image as ImageIcon, Film, BookOpen, Trash2, CheckCircle2, AlertCircle, Calendar, Send, X, Plus,
  Copy, Square, UserPlus, MapPin, AtSign, Music, Clock, FolderUp, ExternalLink, Pencil, RefreshCw, Info, Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import PageHeader from '@/components/PageHeader';
import SurfaceBox from '@/components/SurfaceBox';
import DetailPanel, { FieldRow } from '@/components/DetailPanel';
import FilterChips from '@/components/FilterChips';
import ConfirmDialog from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/StateViews';
import { AccountAvatar } from '@/components/platform';
import { InstagramIcon } from '@/components/brand/platform-icons';
import { useAppContext } from '../../context/AppContext';
import { api } from '../../services/api';
import { cn } from '@/lib/utils';

const BULK_INTERVAL_OPTIONS = [
  { value: 720,   label: 'Every 12 hours' },
  { value: 1440,  label: 'Once a day' },
  { value: 2880,  label: 'Every 2 days' },
  { value: 4320,  label: 'Every 3 days' },
  { value: 10080, label: 'Once a week' },
];

const CONTENT_TYPES = [
  { value: 'IMAGE',   label: 'Photo', icon: ImageIcon, accept: 'image/jpeg', desc: 'JPEG, 4:5 to 1.91:1, up to 8MB' },
  { value: 'REELS',   label: 'Reel',  icon: Film,      accept: 'video/mp4,video/quicktime', desc: 'MP4 or MOV, 9:16, 3 seconds to 15 minutes, up to 300MB' },
  { value: 'STORIES', label: 'Story', icon: BookOpen,  accept: 'image/jpeg,video/mp4,video/quicktime', desc: 'Image or video, 9:16, up to 60 seconds' },
];

const POST_STATUS = {
  published:  { label: 'Published',  variant: 'success' },
  failed:     { label: 'Failed',     variant: 'destructive' },
  publishing: { label: 'Publishing', variant: 'info' },
  pending:    { label: 'Pending',    variant: 'warning' },
};

const BULK_STATUS = {
  pending:    { label: 'Pending',    variant: 'secondary' },
  uploading:  { label: 'Uploading',  variant: 'info' },
  creating:   { label: 'Creating',   variant: 'info' },
  processing: { label: 'Processing', variant: 'info' },
  publishing: { label: 'Publishing', variant: 'info' },
  scheduling: { label: 'Scheduling', variant: 'info' },
  done:       { label: 'Published',  variant: 'success' },
  scheduled:  { label: 'Scheduled',  variant: 'warning' },
  error:      { label: 'Failed',     variant: 'destructive' },
};

const ACTIVE_BULK = ['uploading', 'creating', 'processing', 'publishing', 'scheduling'];
const CAPTION_LIMIT = 2200;

function StatusBadge({ status, map }) {
  const s = map[status] || Object.values(map)[0];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function IconInput({ icon, ...props }) {
  const Icon = icon;
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 stroke-[1.75] text-ink-faint" />
      <Input className="pl-9" {...props} />
    </div>
  );
}

function AccountSelect({ accounts, value, onChange, disabled }) {
  const selected = accounts.find(a => a.id === value);
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-(--control-h-lg) w-full" aria-label="Instagram account">
        {selected ? (
          <span className="flex min-w-0 items-center gap-2">
            <AccountAvatar account={selected} size="xs" />
            <span className="truncate text-sm">{selected.title || selected.username}</span>
            {selected.username && <span className="shrink-0 text-caption text-ink-faint">@{selected.username}</span>}
          </span>
        ) : (
          <SelectValue placeholder="Choose an account" />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {accounts.map(a => (
            <SelectItem key={a.id} value={a.id}>
              <span className="flex items-center gap-2">
                <AccountAvatar account={a} size="xs" />
                <span className="truncate text-sm font-medium">{a.title || a.username}</span>
                {a.username && <span className="shrink-0 text-caption text-ink-faint">@{a.username}</span>}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function TypePicker({ value, onChange, disabled }) {
  return (
    <div role="radiogroup" aria-label="Content type" className="grid grid-cols-3 gap-2">
      {CONTENT_TYPES.map(t => {
        const Icon = t.icon;
        const active = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(t.value)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-field border px-2 py-3 text-center transition-colors duration-(--duration-fast)',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50',
              active ? 'border-brand bg-brand-soft/50 text-brand-text' : 'border-line-control text-ink-muted hover:bg-surface-hover hover:text-ink',
            )}
          >
            <Icon className="size-5 stroke-[1.75]" />
            <span className="text-small font-semibold">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ScheduleToggle({ scheduled, onChange, disabled, nowLabel = 'Publish now', laterLabel = 'Schedule' }) {
  return (
    <Tabs value={scheduled ? 'later' : 'now'} onValueChange={v => onChange(v === 'later')}>
      <TabsList variant="segmented" className="w-full">
        <TabsTrigger value="now" disabled={disabled}><Send />{nowLabel}</TabsTrigger>
        <TabsTrigger value="later" disabled={disabled}><Calendar />{laterLabel}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function SummaryRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 text-small">
      <span className="text-ink-faint">{label}</span>
      <span className="min-w-0 truncate font-medium text-ink">{children}</span>
    </div>
  );
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

  const [pendingDelete, setPendingDelete] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    } catch {
      // The schedule list is secondary; publishing still works without it
    }
  };

  const loadCloudinaryConfig = async () => {
    try {
      const res = await api.getCloudinaryConfig();
      if (res.success) setCloudConfig(res);
    } catch {
      // A missing config is shown as an alert on the page
    }
  };

  const handleFileSelect = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setFilePreview(URL.createObjectURL(f));
  };

  const handleCoverSelect = e => {
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

  const uploadToCloudinary = async fileToUpload => {
    if (!cloudConfig) throw new Error('Cloudinary is not set up on the server. Check Settings.');
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
      xhr.addEventListener('error', () => reject(new Error('The upload lost its network connection. Check your connection and try again.')));
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudConfig.cloudName}/${resourceType}/upload`);
      xhr.send(formData);
    });
  };

  const waitForContainer = async (containerId, accountId, maxAttempts = 30) => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const status = await api.getIGContainerStatus(containerId, accountId);
        setStatusMessage(`Instagram status: ${status.statusCode || 'IN_PROGRESS'}`);
        if (status.statusCode === 'FINISHED' || status.statusCode === 'PUBLISHED') return true;
        if (status.statusCode === 'ERROR') throw new Error('Container processing failed: ' + (status.status || 'Unknown'));
        if (status.statusCode === 'EXPIRED') throw new Error('Container expired');
      } catch (err) { if (err.message.includes('processing failed') || err.message.includes('expired')) throw err; }
    }
    throw new Error('Instagram took too long to process the media. Try again in a few minutes.');
  };

  const parseUserTags = str => str.split(',').map(s => {
    const parts = s.trim().replace(/^@/, '').split(/\s+/);
    return { username: parts[0], x: parts[1] ? parseFloat(parts[1]) : 0.5, y: parts[2] ? parseFloat(parts[2]) : 0.5 };
  }).filter(t => t.username);

  const handlePublish = async () => {
    if (!selectedAccount || !file || !contentType) { showToast('Choose an account, a content type and a file before publishing.', 'error'); return; }
    if (!cloudConfig) { showToast('Cloudinary is not set up on the server. Check Settings.', 'error'); return; }
    if (scheduleMode) {
      if (!scheduleDate || !scheduleTime) { showToast('Set a date and time for the scheduled post.', 'error'); return; }
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
      if (scheduledAt <= new Date()) { showToast('Pick a time in the future.', 'error'); return; }
      setUploading(true); setPublishStatus('uploading-cloudinary'); setActiveStep(2);
      try {
        const mediaUrl = await uploadToCloudinary(file);
        let coverUrl = null;
        if (coverFile && contentType === 'REELS') { setStatusMessage('Uploading cover'); coverUrl = await uploadToCloudinary(coverFile); }
        setPublishStatus('scheduling'); setStatusMessage('Saving the scheduled post');
        const res = await api.createScheduledPost({
          accountId: selectedAccount, platform: 'instagram', mediaType: contentType, mediaUrl, caption: caption || '',
          coverUrl: coverUrl || null, shareToFeed: contentType === 'REELS' ? shareToFeed : true,
          collaborators: collaborators ? collaborators.split(',').map(s => s.trim()).filter(Boolean) : [],
          audioName: audioName || '', thumbOffset: thumbOffset ? parseInt(thumbOffset, 10) : null,
          locationId: locationId || '', userTags: userTags ? parseUserTags(userTags) : [],
          altText: (contentType === 'IMAGE' && altText) ? altText : '', scheduledAt: scheduledAt.toISOString(),
        });
        if (!res.success) throw new Error(res.message || 'Failed to schedule');
        setPublishStatus('scheduled'); setStatusMessage(`Scheduled for ${scheduledAt.toLocaleString()}`);
        showToast('Post scheduled'); loadScheduledPosts();
      } catch (err) { setPublishStatus('error'); setStatusMessage(err.message); showToast(`Scheduling failed. ${err.message}`, 'error'); }
      finally { setUploading(false); }
      return;
    }

    setUploading(true); setPublishStatus('uploading-cloudinary'); setStatusMessage('Uploading media'); setActiveStep(2);
    try {
      const mediaUrl = await uploadToCloudinary(file);
      let coverUrl = null;
      if (coverFile && contentType === 'REELS') { setStatusMessage('Uploading cover'); coverUrl = await uploadToCloudinary(coverFile); }
      setPublishStatus('creating-container'); setStatusMessage('Creating the Instagram media container');
      const containerRes = await api.createIGContainer(selectedAccount, {
        mediaType: contentType, mediaUrl, caption: caption || undefined, coverUrl: coverUrl || undefined,
        shareToFeed: contentType === 'REELS' ? shareToFeed : undefined,
        collaborators: collaborators ? collaborators.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        audioName: audioName || undefined, thumbOffset: thumbOffset ? parseInt(thumbOffset, 10) : undefined,
        locationId: locationId || undefined, userTags: userTags ? parseUserTags(userTags) : undefined,
        altText: (contentType === 'IMAGE' && altText) ? altText : undefined,
      });
      if (!containerRes.success || !containerRes.containerId) throw new Error(containerRes.message || 'Failed to create container');
      if (contentType === 'REELS' || contentType === 'STORIES') { setPublishStatus('processing'); setStatusMessage('Instagram is processing the media'); await waitForContainer(containerRes.containerId, selectedAccount); }
      else { await new Promise(r => setTimeout(r, 2000)); }
      setPublishStatus('publishing'); setStatusMessage('Publishing to Instagram');
      const publishRes = await api.publishIGContainer(selectedAccount, containerRes.containerId);
      if (!publishRes.success || !publishRes.mediaId) throw new Error(publishRes.message || 'Publish failed');
      setPublishStatus('done'); setPublishedMediaId(publishRes.mediaId); setStatusMessage('Published');
      showToast('Published to Instagram');
    } catch (err) { setPublishStatus('error'); setStatusMessage(err.message); showToast(`Publishing failed. ${err.message}`, 'error'); }
    finally { setUploading(false); }
  };

  const handleBulkFilesSelect = e => {
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

  const removeBulkFile = id => {
    setBulkFiles(prev => { const item = prev.find(f => f.id === id); if (item?.preview) URL.revokeObjectURL(item.preview); return prev.filter(f => f.id !== id); });
  };

  const updateBulkFileCaption = (id, cap) => setBulkFiles(prev => prev.map(f => f.id === id ? { ...f, caption: cap } : f));

  const applySharedCaption = () => { if (!bulkSharedCaption) return; setBulkFiles(prev => prev.map(f => f.status === 'pending' ? { ...f, caption: bulkSharedCaption } : f)); };

  const clearBulkFiles = () => { bulkFiles.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); }); setBulkFiles([]); setBulkProcessing(false); bulkCancelRef.current = false; };

  const handleBulkProcess = async () => {
    if (!bulkAccount || bulkFiles.length === 0 || !bulkContentType) { showToast('Choose an account, a content type and at least one file.', 'error'); return; }
    if (!cloudConfig) { showToast('Cloudinary is not set up on the server. Check Settings.', 'error'); return; }
    if (bulkScheduleMode && (!bulkStartDate || !bulkStartTime)) { showToast('Set a start date and time for the schedule.', 'error'); return; }
    const baseTime = bulkScheduleMode ? new Date(`${bulkStartDate}T${bulkStartTime}`) : null;
    if (baseTime && baseTime <= new Date()) { showToast('Pick a start time in the future.', 'error'); return; }
    setBulkProcessing(true); bulkCancelRef.current = false;
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
          xhr.addEventListener('error', () => reject(new Error('The upload lost its network connection')));
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
    if (bulkCancelRef.current) { showToast('Bulk upload stopped. Files already processed keep their status.', 'warning'); }
    else { showToast(`Bulk upload finished: ${successCount} succeeded, ${failCount} failed`, successCount > 0 ? 'success' : 'error'); if (bulkScheduleMode) loadScheduledPosts(); }
  };

  const handleDeleteScheduled = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try { await api.deleteScheduledPost(pendingDelete.id); showToast(pendingDelete.status === 'published' ? 'Record removed' : 'Scheduled post deleted'); loadScheduledPosts(); }
    catch (err) { showToast(`Couldn't delete the post. ${err.message}`, 'error'); }
    finally { setDeleting(false); setPendingDelete(null); }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try { const res = await api.deleteAllScheduledPosts(); showToast(`Deleted ${res.deleted} post${res.deleted === 1 ? '' : 's'}`); loadScheduledPosts(); }
    catch (err) { showToast(`Couldn't delete the posts. ${err.message}`, 'error'); }
    finally { setDeleting(false); setConfirmDeleteAll(false); }
  };

  const startEditPost = post => {
    setEditingPostId(post.id); setEditCaption(post.caption || '');
    const dt = new Date(post.scheduledAt);
    setEditDate(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`);
    setEditTime(`${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`);
  };
  const cancelEdit = () => { setEditingPostId(null); setEditCaption(''); setEditDate(''); setEditTime(''); };

  const handleSaveEdit = async () => {
    if (!editingPostId || !editDate || !editTime) { showToast('Set a date and time.', 'error'); return; }
    const scheduledAt = new Date(`${editDate}T${editTime}`);
    if (scheduledAt <= new Date()) { showToast('Pick a time in the future.', 'error'); return; }
    setSavingEdit(true);
    try {
      const res = await api.updateScheduledPost(editingPostId, { caption: editCaption, scheduledAt: scheduledAt.toISOString() });
      if (!res.success) throw new Error(res.message || 'Update failed');
      showToast('Scheduled post updated'); cancelEdit(); loadScheduledPosts();
    } catch (err) { showToast(`Couldn't update the post. ${err.message}`, 'error'); }
    finally { setSavingEdit(false); }
  };

  const canPublish = !!file && !!contentType && !!selectedAccount && !(scheduleMode && (!scheduleDate || !scheduleTime));
  const selectedAcct = igAccounts.find(a => a.id === selectedAccount);
  const selectedType = CONTENT_TYPES.find(t => t.value === contentType);
  const bulkType = CONTENT_TYPES.find(t => t.value === bulkContentType);

  const bulkStats = {
    total: bulkFiles.length,
    pending: bulkFiles.filter(f => f.status === 'pending').length,
    done: bulkFiles.filter(f => f.status === 'done').length,
    scheduled: bulkFiles.filter(f => f.status === 'scheduled').length,
    errors: bulkFiles.filter(f => f.status === 'error').length,
  };

  const fmtLocalDate = iso => iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
  const today = new Date().toISOString().split('T')[0];

  const statusChips = [
    { value: 'all',        label: 'All',        count: scheduledPosts.length },
    { value: 'pending',    label: 'Pending',    count: scheduledPosts.filter(p => p.status === 'pending').length },
    { value: 'publishing', label: 'Publishing', count: scheduledPosts.filter(p => p.status === 'publishing').length },
    { value: 'published',  label: 'Published',  count: scheduledPosts.filter(p => p.status === 'published').length },
    { value: 'failed',     label: 'Failed',     count: scheduledPosts.filter(p => p.status === 'failed').length },
  ];
  const filteredScheduled = scheduledPosts
    .filter(p => statusFilter === 'all' || p.status === statusFilter)
    .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));

  const intervalText = bulkInterval >= 1440 ? `${bulkInterval / 1440} day${bulkInterval > 1440 ? 's' : ''}` : `${bulkInterval / 60} hours`;

  if (igAccounts.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Publish" description="Post and schedule photos, Reels and Stories to Instagram." />
        <SurfaceBox>
          <EmptyState
            icon={<InstagramIcon />}
            title="Connect an Instagram account to publish"
            description="Publishing works with Instagram Business and Creator accounts. YouTube publishing is not available yet."
            action={<Button render={<Link to="/accounts?add=1" />}><Plus data-icon="inline-start" />Add an account</Button>}
          />
        </SurfaceBox>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Publish"
        description="Post and schedule photos, Reels and Stories to Instagram."
        actions={publishStatus === 'done' && uploadMode === 'single' && (
          <Button onClick={resetAll}><Plus data-icon="inline-start" />Publish another</Button>
        )}
      />

      {!cloudConfig && (
        <Alert variant="warning">
          <AlertCircle />
          <AlertDescription>
            Uploads need Cloudinary, which is not set up on the server. Instagram only accepts media from a public URL. Set the Cloudinary environment variables, then check the status in <Link to="/settings" className="font-semibold underline">Settings</Link>.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={uploadMode} onValueChange={setUploadMode} className="gap-6">
        <TabsList>
          <TabsTrigger value="single"><Upload />Single post</TabsTrigger>
          <TabsTrigger value="bulk">
            <FolderUp />Bulk upload
            {bulkFiles.length > 0 && <Badge variant="solid" className="h-4 px-1.5">{bulkFiles.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          {activeStep === 2 ? (
            <SurfaceBox>
              <div role="status" className="flex flex-col items-center gap-3 py-10 text-center">
                {publishStatus === 'uploading-cloudinary' && (
                  <>
                    <Upload className="size-10 stroke-[1.5] text-ink-muted" />
                    <h2 className="font-heading text-section font-semibold text-ink">Uploading media</h2>
                    <Progress value={uploadProgress} className="w-72 max-w-full" aria-label="Upload progress" />
                    <p className="text-small text-ink-muted tabular-nums">{uploadProgress}% uploaded</p>
                  </>
                )}
                {['creating-container', 'publishing', 'scheduling', 'processing'].includes(publishStatus) && (
                  <>
                    <Spinner className="size-10 text-brand" />
                    <h2 className="font-heading text-section font-semibold text-ink">
                      {publishStatus === 'creating-container' ? 'Preparing the post' : publishStatus === 'scheduling' ? 'Saving the schedule' : publishStatus === 'processing' ? 'Instagram is processing the media' : 'Publishing'}
                    </h2>
                    <p className="text-small text-ink-muted">{statusMessage}</p>
                    {publishStatus === 'processing' && <p className="text-caption text-ink-faint">Videos can take a minute.</p>}
                  </>
                )}
                {publishStatus === 'done' && (
                  <>
                    <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success"><CheckCircle2 className="size-6" /></span>
                    <h2 className="font-heading text-page-title font-semibold text-ink">Published</h2>
                    <p className="text-sm text-ink-muted">Your {selectedType?.label?.toLowerCase()} is live on Instagram.</p>
                    {publishedMediaId && <Badge variant="outline" className="font-mono">Media ID {publishedMediaId}</Badge>}
                    <div className="mt-2 flex gap-2">
                      <Button onClick={resetAll}><Plus data-icon="inline-start" />Publish another</Button>
                      {selectedAcct?.username && (
                        <Button variant="outline" render={<a href={`https://instagram.com/${selectedAcct.username}`} target="_blank" rel="noopener noreferrer" />}>
                          <ExternalLink data-icon="inline-start" />View profile
                        </Button>
                      )}
                    </div>
                  </>
                )}
                {publishStatus === 'scheduled' && (
                  <>
                    <span className="flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning"><Calendar className="size-6" /></span>
                    <h2 className="font-heading text-page-title font-semibold text-ink">Post scheduled</h2>
                    <p className="text-sm text-ink-muted">{statusMessage}</p>
                    <p className="max-w-md text-small text-ink-faint">The server publishes it at that time, even when this browser is closed.</p>
                    <Button onClick={resetAll} className="mt-2"><Plus data-icon="inline-start" />Schedule another</Button>
                  </>
                )}
                {publishStatus === 'error' && (
                  <>
                    <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger"><AlertCircle className="size-6" /></span>
                    <h2 className="font-heading text-page-title font-semibold text-ink"><span className="sr-only">Error: </span>{scheduleMode ? 'Scheduling failed' : 'Publishing failed'}</h2>
                    <p className="max-w-md text-sm text-ink-muted">{statusMessage}</p>
                    <div className="mt-2 flex gap-2">
                      <Button onClick={() => { setActiveStep(0); setPublishStatus(''); }}>Try again</Button>
                      <Button variant="outline" onClick={resetAll}>Start over</Button>
                    </div>
                  </>
                )}
              </div>
            </SurfaceBox>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_28rem]">
              <div className="flex min-w-0 flex-col gap-4">
                <SurfaceBox title="Media" subheader={selectedType ? selectedType.desc : 'Choose what you are posting, then add the file.'}>
                  <div className="flex flex-col gap-4">
                    <TypePicker value={contentType} onChange={v => { setContentType(v); clearFile(); }} />
                    {!file ? (
                      <button
                        type="button"
                        onClick={() => contentType && fileInputRef.current?.click()}
                        disabled={!contentType}
                        className={cn(
                          'flex w-full flex-col items-center gap-2 rounded-card border border-dashed p-10 text-center transition-colors duration-(--duration-fast)',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                          contentType ? 'border-line-strong/50 hover:border-brand hover:bg-brand-soft/30' : 'cursor-not-allowed border-line opacity-60',
                        )}
                      >
                        <Upload className="size-8 stroke-[1.5] text-ink-faint" />
                        <span className="text-sm font-medium text-ink">{contentType ? 'Choose a file' : 'Choose a content type first'}</span>
                        {selectedType && <span className="text-caption text-ink-faint">{selectedType.desc}</span>}
                      </button>
                    ) : (
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <div className="relative w-full shrink-0 overflow-hidden rounded-control bg-surface-sunken sm:w-52">
                          {file.type.startsWith('video/') ? (
                            <video src={filePreview} controls muted className="max-h-72 w-full bg-black object-contain" />
                          ) : (
                            <img src={filePreview} alt="Selected media preview" className="max-h-72 w-full object-contain" />
                          )}
                          <button
                            type="button"
                            onClick={clearFile}
                            aria-label="Remove file"
                            className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-[#0C0809]/75 text-white transition-colors hover:bg-brand"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{file.name}</p>
                          <p className="text-small text-ink-muted">{(file.size / (1024 * 1024)).toFixed(2)} MB, {file.type}</p>
                          <Badge variant="default" className="mt-2">{selectedType?.label}</Badge>
                        </div>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" hidden accept={selectedType?.accept || '*'} onChange={handleFileSelect} aria-label="Media file" />
                  </div>
                </SurfaceBox>

                <SurfaceBox title="Caption">
                  <Textarea
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    placeholder="Write a caption. Add #hashtags and @mentions."
                    rows={7}
                    maxLength={CAPTION_LIMIT}
                    aria-label="Caption"
                    className="min-h-40 border-0 bg-transparent px-0 text-base leading-6 shadow-none hover:border-0 focus-visible:outline-none md:text-base"
                  />
                  <p className={cn('mt-2 text-right text-caption tabular-nums', caption.length > CAPTION_LIMIT * 0.9 ? 'text-warning' : 'text-ink-faint')}>
                    {caption.length.toLocaleString()} / {CAPTION_LIMIT.toLocaleString()}
                  </p>
                </SurfaceBox>
              </div>

              <DetailPanel
                title="Post settings"
                footer={
                  <Button size="lg" className="w-full" onClick={handlePublish} disabled={uploading || !canPublish}>
                    {uploading ? <Spinner className="size-4" /> : scheduleMode ? <Calendar data-icon="inline-start" /> : <Send data-icon="inline-start" />}
                    {scheduleMode ? 'Schedule post' : 'Publish now'}
                  </Button>
                }
              >
                <FieldRow label="Account">
                  <AccountSelect accounts={igAccounts} value={selectedAccount} onChange={setSelectedAccount} />
                </FieldRow>

                {contentType === 'IMAGE' && (
                  <FieldRow label="Alt text" hint="Describes the photo for people using screen readers." htmlFor="alt-text">
                    <IconInput id="alt-text" icon={ImageIcon} value={altText} onChange={e => setAltText(e.target.value)} placeholder="A short description of the photo" />
                  </FieldRow>
                )}
                <FieldRow label="Collaborators" hint="Separate usernames with commas." htmlFor="collaborators">
                  <IconInput id="collaborators" icon={UserPlus} value={collaborators} onChange={e => setCollaborators(e.target.value)} placeholder="username1, username2" />
                </FieldRow>
                <FieldRow label="Tagged people" hint="Separate with commas. Add x and y after a name to position the tag." htmlFor="user-tags">
                  <IconInput id="user-tags" icon={AtSign} value={userTags} onChange={e => setUserTags(e.target.value)} placeholder="@username1, @username2" />
                </FieldRow>
                <FieldRow label="Location" hint="The Facebook Page ID of the place." htmlFor="location-id">
                  <IconInput id="location-id" icon={MapPin} value={locationId} onChange={e => setLocationId(e.target.value)} placeholder="Location ID" />
                </FieldRow>

                {contentType === 'REELS' && (
                  <div className="flex flex-col gap-5 border-t border-divider pt-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-ink">Share to feed</p>
                        <p className="text-caption text-ink-faint">Show the Reel on the profile grid as well.</p>
                      </div>
                      <Switch checked={shareToFeed} onCheckedChange={setShareToFeed} aria-label="Share to feed" />
                    </div>
                    <FieldRow label="Audio name" hint="Optional" htmlFor="audio-name">
                      <IconInput id="audio-name" icon={Music} value={audioName} onChange={e => setAudioName(e.target.value)} placeholder="Original audio" />
                    </FieldRow>
                    <FieldRow label="Thumbnail offset" hint="Milliseconds into the video to use as the thumbnail." htmlFor="thumb-offset">
                      <IconInput id="thumb-offset" icon={Clock} type="number" min="0" value={thumbOffset} onChange={e => setThumbOffset(e.target.value)} placeholder="0" />
                    </FieldRow>
                    <FieldRow label="Cover image" hint="Optional JPEG.">
                      {!coverFile ? (
                        <Button variant="outline" onClick={() => coverInputRef.current?.click()} className="justify-start">
                          <Camera data-icon="inline-start" />Choose a cover
                        </Button>
                      ) : (
                        <div className="flex items-center gap-3 rounded-control border border-line p-2">
                          <img src={coverPreview} alt="Cover preview" className="size-10 rounded-sm object-cover" />
                          <span className="min-w-0 flex-1 truncate text-small text-ink">{coverFile.name}</span>
                          <Button variant="ghost" size="icon-xs" onClick={clearCover} aria-label="Remove cover"><X /></Button>
                        </div>
                      )}
                      <input ref={coverInputRef} type="file" hidden accept="image/jpeg" onChange={handleCoverSelect} aria-label="Cover image" />
                    </FieldRow>
                  </div>
                )}

                <div className="flex flex-col gap-4 border-t border-divider pt-5">
                  <FieldRow label="When">
                    <ScheduleToggle scheduled={scheduleMode} onChange={setScheduleMode} />
                  </FieldRow>
                  {scheduleMode && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} min={today} aria-label="Schedule date" />
                      <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} aria-label="Schedule time" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 rounded-control bg-surface-sunken/60 p-3">
                  <SummaryRow label="Account">{selectedAcct ? `@${selectedAcct.username || selectedAcct.title}` : '-'}</SummaryRow>
                  <SummaryRow label="Type">{selectedType?.label || '-'}</SummaryRow>
                  <SummaryRow label="File">{file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : '-'}</SummaryRow>
                  <SummaryRow label="Goes live">
                    {scheduleMode ? (scheduleDate && scheduleTime ? new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString() : 'Pick a time') : 'Right away'}
                  </SummaryRow>
                </div>
              </DetailPanel>
            </div>
          )}
        </TabsContent>

        <TabsContent value="bulk">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_28rem]">
            <div className="flex min-w-0 flex-col gap-4">
              <SurfaceBox
                title={`Files${bulkFiles.length ? ` (${bulkFiles.length})` : ''}`}
                subheader={bulkType?.desc}
                secondary={
                  <div className="flex gap-2">
                    {bulkFiles.length > 0 && !bulkProcessing && (
                      <Button size="sm" variant="ghost" onClick={clearBulkFiles} className="hover:bg-danger-soft hover:text-danger">
                        <Trash2 data-icon="inline-start" />Clear all
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => bulkFileInputRef.current?.click()} disabled={bulkProcessing}>
                      <Plus data-icon="inline-start" />Add files
                    </Button>
                  </div>
                }
              >
                <input ref={bulkFileInputRef} type="file" hidden multiple accept={bulkType?.accept || '*'} onChange={handleBulkFilesSelect} aria-label="Files to upload" />
                {bulkFiles.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => bulkFileInputRef.current?.click()}
                    className="flex w-full flex-col items-center gap-2 rounded-card border border-dashed border-line-strong/50 p-10 text-center transition-colors duration-(--duration-fast) hover:border-brand hover:bg-brand-soft/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <FolderUp className="size-8 stroke-[1.5] text-ink-faint" />
                    <span className="text-sm font-medium text-ink">Choose several files</span>
                    <span className="text-caption text-ink-faint">Each file becomes its own post, published or scheduled in order.</span>
                  </button>
                ) : (
                  <ul className="flex max-h-[34rem] flex-col gap-2 overflow-y-auto pr-1">
                    {bulkFiles.map((item, idx) => {
                      const isActive = ACTIVE_BULK.includes(item.status);
                      return (
                        <li key={item.id} className={cn('flex items-start gap-3 rounded-field border p-3', isActive ? 'border-brand/40 bg-brand-soft/20' : 'border-line')}>
                          <div className="relative size-14 shrink-0 overflow-hidden rounded-control bg-surface-sunken">
                            {item.file.type.startsWith('video/')
                              ? <video src={item.preview} muted className="size-full object-cover" />
                              : <img src={item.preview} alt="" className="size-full object-cover" />}
                            <span className="absolute top-0.5 left-0.5 rounded-sm bg-[#0C0809]/75 px-1 font-mono text-[0.5625rem] font-semibold text-white">{idx + 1}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-ink">{item.file.name}</span>
                              <span className="shrink-0 text-caption text-ink-faint">{(item.file.size / (1024 * 1024)).toFixed(1)} MB</span>
                            </div>
                            {item.status === 'pending' ? (
                              <Textarea value={item.caption} onChange={e => updateBulkFileCaption(item.id, e.target.value)} placeholder={`Caption for file ${idx + 1}`} rows={1} className="min-h-9 text-small" aria-label={`Caption for file ${idx + 1}`} />
                            ) : (
                              <p className="truncate text-caption text-ink-muted">{item.caption || 'No caption'}</p>
                            )}
                            {item.status === 'uploading' && <Progress value={item.progress} className="mt-1.5" aria-label={`Upload progress for file ${idx + 1}`} />}
                            {item.error && <p className="mt-1 text-caption text-danger">Error: {item.error}</p>}
                            {item.mediaId && <p className="mt-1 font-mono text-caption text-success">Media ID {item.mediaId}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {isActive && <Spinner className="size-3.5 text-brand" />}
                            <StatusBadge status={item.status} map={BULK_STATUS} />
                            {item.status === 'pending' && !bulkProcessing && (
                              <Button variant="ghost" size="icon-xs" onClick={() => removeBulkFile(item.id)} aria-label={`Remove ${item.file.name}`}><X /></Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SurfaceBox>

              {(bulkProcessing || bulkStats.done > 0 || bulkStats.scheduled > 0 || bulkStats.errors > 0) && (
                <SurfaceBox title={bulkProcessing ? 'Working through the files' : 'Results'}>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{bulkStats.total} total</Badge>
                    {bulkStats.done > 0 && <Badge variant="success"><CheckCircle2 />{bulkStats.done} published</Badge>}
                    {bulkStats.scheduled > 0 && <Badge variant="warning"><Calendar />{bulkStats.scheduled} scheduled</Badge>}
                    {bulkStats.errors > 0 && <Badge variant="destructive"><AlertCircle />{bulkStats.errors} failed</Badge>}
                    {bulkStats.pending > 0 && <Badge variant="secondary">{bulkStats.pending} pending</Badge>}
                  </div>
                  {bulkProcessing && (
                    <Progress value={((bulkStats.done + bulkStats.scheduled + bulkStats.errors) / Math.max(1, bulkStats.total)) * 100} className="mt-3" aria-label="Overall progress" />
                  )}
                </SurfaceBox>
              )}
            </div>

            <DetailPanel
              title="Bulk settings"
              footer={bulkProcessing ? (
                <Button variant="destructive" size="lg" className="w-full" onClick={() => { bulkCancelRef.current = true; }}>
                  <Square data-icon="inline-start" />Stop after this file
                </Button>
              ) : (
                <Button size="lg" className="w-full" onClick={handleBulkProcess} disabled={bulkStats.pending === 0 || !bulkAccount || !bulkContentType}>
                  {bulkScheduleMode ? <Calendar data-icon="inline-start" /> : <Send data-icon="inline-start" />}
                  {bulkScheduleMode ? `Schedule ${bulkStats.pending} post${bulkStats.pending === 1 ? '' : 's'}` : `Publish ${bulkStats.pending} post${bulkStats.pending === 1 ? '' : 's'} now`}
                </Button>
              )}
            >
              <FieldRow label="Account">
                <AccountSelect accounts={igAccounts} value={bulkAccount} onChange={setBulkAccount} disabled={bulkProcessing} />
              </FieldRow>
              <FieldRow label="Content type">
                <TypePicker value={bulkContentType} onChange={setBulkContentType} disabled={bulkProcessing} />
              </FieldRow>
              <FieldRow label="Shared caption" hint="Copies this caption onto every pending file." htmlFor="bulk-caption">
                <div className="flex gap-2">
                  <Textarea id="bulk-caption" value={bulkSharedCaption} onChange={e => setBulkSharedCaption(e.target.value)} placeholder="Caption for all files" rows={2} disabled={bulkProcessing} className="flex-1" />
                  <Tooltip>
                    <TooltipTrigger render={<Button variant="outline" size="icon" onClick={applySharedCaption} disabled={!bulkSharedCaption || bulkProcessing} aria-label="Apply caption to all pending files" />}>
                      <Copy />
                    </TooltipTrigger>
                    <TooltipContent>Apply to all pending files</TooltipContent>
                  </Tooltip>
                </div>
              </FieldRow>
              <FieldRow label="Collaborators" hint="Applied to every post." htmlFor="bulk-collaborators">
                <IconInput id="bulk-collaborators" icon={UserPlus} value={bulkCollaborators} onChange={e => setBulkCollaborators(e.target.value)} placeholder="username1, username2" disabled={bulkProcessing} />
              </FieldRow>
              <FieldRow label="Tagged people" hint="Applied to every post." htmlFor="bulk-tags">
                <IconInput id="bulk-tags" icon={AtSign} value={bulkUserTags} onChange={e => setBulkUserTags(e.target.value)} placeholder="@username1, @username2" disabled={bulkProcessing} />
              </FieldRow>
              <FieldRow label="Location" hint="Facebook Page ID, applied to every post." htmlFor="bulk-location">
                <IconInput id="bulk-location" icon={MapPin} value={bulkLocationId} onChange={e => setBulkLocationId(e.target.value)} placeholder="Location ID" disabled={bulkProcessing} />
              </FieldRow>
              {bulkContentType === 'REELS' && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink">Share Reels to feed</p>
                  <Switch checked={bulkShareToFeed} onCheckedChange={setBulkShareToFeed} disabled={bulkProcessing} aria-label="Share Reels to feed" />
                </div>
              )}

              <div className="flex flex-col gap-4 border-t border-divider pt-5">
                <FieldRow label="When">
                  <ScheduleToggle scheduled={bulkScheduleMode} onChange={setBulkScheduleMode} disabled={bulkProcessing} nowLabel="Publish all now" laterLabel="Spread out" />
                </FieldRow>
                {bulkScheduleMode ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="date" value={bulkStartDate} onChange={e => setBulkStartDate(e.target.value)} min={today} disabled={bulkProcessing} aria-label="Start date" />
                      <Input type="time" value={bulkStartTime} onChange={e => setBulkStartTime(e.target.value)} disabled={bulkProcessing} aria-label="Start time" />
                    </div>
                    <Select value={String(bulkInterval)} onValueChange={v => setBulkInterval(Number(v))} disabled={bulkProcessing} items={BULK_INTERVAL_OPTIONS.map(o => ({ value: String(o.value), label: o.label }))}>
                      <SelectTrigger className="w-full" aria-label="Interval"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {BULK_INTERVAL_OPTIONS.map(o => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {bulkStartDate && bulkStartTime && bulkStats.pending > 0 && (
                      <Alert variant="info">
                        <Info />
                        <AlertDescription>
                          {bulkStats.pending} posts from {new Date(`${bulkStartDate}T${bulkStartTime}`).toLocaleString()}, {intervalText} apart. The last one goes out {new Date(new Date(`${bulkStartDate}T${bulkStartTime}`).getTime() + (bulkStats.pending - 1) * bulkInterval * 60000).toLocaleString()}.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                ) : bulkStats.pending > 0 && (
                  <Alert>
                    <Info />
                    <AlertDescription>{bulkStats.pending} files upload and publish one at a time. Instagram allows 100 posts per account every 24 hours.</AlertDescription>
                  </Alert>
                )}
              </div>
            </DetailPanel>
          </div>
        </TabsContent>
      </Tabs>

      {scheduledPosts.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-heading text-section font-semibold text-ink">Scheduled posts</h2>
              <p className="text-small text-ink-muted">Posts waiting to go out, and the history of ones that already did.</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={loadScheduledPosts}><RefreshCw data-icon="inline-start" />Refresh</Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmDeleteAll(true)} className="hover:bg-danger-soft hover:text-danger"><Trash2 data-icon="inline-start" />Delete all</Button>
            </div>
          </div>
          <FilterChips label="Status" options={statusChips} value={statusFilter} onChange={setStatusFilter} />
          <SurfaceBox content={false} className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-right">#</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="min-w-48">Caption</TableHead>
                  <TableHead className="min-w-40">Scheduled for</TableHead>
                  <TableHead className="min-w-40">Published</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-40">Error</TableHead>
                  <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredScheduled.map((post, idx) => {
                  const acct = igAccounts.find(a => a.id === post.accountId);
                  const typeInfo = CONTENT_TYPES.find(t => t.value === post.mediaType);
                  const TypeIcon = typeInfo?.icon || ImageIcon;
                  const isEditing = editingPostId === post.id;
                  const canEdit = post.status === 'pending' || post.status === 'scheduled';
                  const isPastDue = post.status === 'pending' && new Date(post.scheduledAt) < new Date();
                  return (
                    <React.Fragment key={post.id}>
                      <TableRow data-state={isEditing ? 'selected' : undefined}>
                        <TableCell className="text-right font-mono text-caption text-ink-faint">{idx + 1}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            {acct && <AccountAvatar account={acct} size="xs" />}
                            <span className="text-small font-medium text-ink">{acct?.username ? `@${acct.username}` : post.accountId}</span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-small text-ink-muted"><TypeIcon className="size-3.5" />{typeInfo?.label || post.mediaType}</span>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger render={<p className="max-w-48 cursor-default truncate text-small text-ink-muted" />}>{post.caption || 'No caption'}</TooltipTrigger>
                            <TooltipContent className="max-w-sm">{post.caption || 'No caption'}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <span className={cn('text-small', isPastDue ? 'text-warning' : 'text-ink-muted')}>{fmtLocalDate(post.scheduledAt)}</span>
                          {isPastDue && <p className="text-caption text-warning">Overdue</p>}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-small text-ink-muted">
                            {fmtLocalDate(post.publishedAt)}
                            {post.publishedMediaId && (
                              <Tooltip>
                                <TooltipTrigger render={<span className="text-success" />}><CheckCircle2 className="size-3.5" /></TooltipTrigger>
                                <TooltipContent>Media ID {post.publishedMediaId}</TooltipContent>
                              </Tooltip>
                            )}
                          </span>
                        </TableCell>
                        <TableCell><StatusBadge status={post.status} map={POST_STATUS} /></TableCell>
                        <TableCell>
                          {post.error ? (
                            <Tooltip>
                              <TooltipTrigger render={<p className="max-w-40 cursor-help truncate text-small text-danger" />}>{post.error}</TooltipTrigger>
                              <TooltipContent className="max-w-sm">{post.error}</TooltipContent>
                            </Tooltip>
                          ) : <span className="text-ink-faint">-</span>}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {canEdit && !isEditing && (
                            <Tooltip>
                              <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={() => startEditPost(post)} aria-label="Edit scheduled post" />}><Pencil /></TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                          )}
                          {isEditing && <Button variant="ghost" size="icon-xs" onClick={cancelEdit} aria-label="Cancel editing"><X /></Button>}
                          {post.status !== 'publishing' && (
                            <Tooltip>
                              <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={() => setPendingDelete(post)} aria-label={post.status === 'published' ? 'Remove record' : 'Delete scheduled post'} className="hover:bg-danger-soft hover:text-danger" />}><Trash2 /></TooltipTrigger>
                              <TooltipContent>{post.status === 'published' ? 'Remove record' : 'Delete'}</TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                      {isEditing && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={9} className="whitespace-normal bg-surface-sunken/40 p-0">
                            <div className="flex flex-col gap-3 p-4">
                              <Textarea value={editCaption} onChange={e => setEditCaption(e.target.value)} rows={3} aria-label="Caption" maxLength={CAPTION_LIMIT} />
                              <p className="text-caption text-ink-faint tabular-nums">{editCaption.length.toLocaleString()} / {CAPTION_LIMIT.toLocaleString()}</p>
                              <div className="flex flex-wrap gap-2">
                                <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} min={today} className="w-44" aria-label="Date" />
                                <Input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} className="w-36" aria-label="Time" />
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                                <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit}>
                                  {savingEdit ? <Spinner className="size-3.5" /> : <CheckCircle2 data-icon="inline-start" />}
                                  {savingEdit ? 'Saving' : 'Save changes'}
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
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9}>
                      <EmptyState compact icon={<Calendar />} title={`No ${statusFilter} posts`} description="Choose a different status to see other posts." />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </SurfaceBox>
        </section>
      )}

      <p className="text-caption text-ink-faint">
        Files upload to Cloudinary first because Instagram needs a public URL. Twiligent then creates an Instagram media container, waits for processing, and publishes it. Publishing needs the instagram_business_content_publish permission. Instagram allows 100 posts per account every 24 hours.
      </p>

      <ConfirmDialog
        open={confirmDeleteAll}
        onOpenChange={setConfirmDeleteAll}
        title="Delete all scheduled posts?"
        description="Every record is removed: pending, published and failed. Pending posts will not go out. Posts already on Instagram stay live; only Twiligent's records are deleted. Posts that are publishing right now are kept."
        confirmLabel="Delete all"
        onConfirm={handleDeleteAll}
        busy={deleting}
        hold
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={open => { if (!open) setPendingDelete(null); }}
        title={pendingDelete?.status === 'published' ? 'Remove this record?' : 'Delete this scheduled post?'}
        description={pendingDelete?.status === 'published'
          ? 'The post stays live on Instagram. Only the record in Twiligent is removed.'
          : 'It will not be published. The uploaded media stays in Cloudinary.'}
        confirmLabel={pendingDelete?.status === 'published' ? 'Remove' : 'Delete'}
        onConfirm={handleDeleteScheduled}
        busy={deleting}
        hold
      />
    </div>
  );
}
