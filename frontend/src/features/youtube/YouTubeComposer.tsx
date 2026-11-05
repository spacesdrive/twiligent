import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import SegmentedChoice from '@/components/SegmentedChoice';
import SurfaceBox from '@/components/SurfaceBox';
import { FieldRow } from '@/components/DetailPanel';
import { api } from '../../services/api';
import { CATEGORY_OPTIONS, PRIVACY_OPTIONS, TITLE_MAX, composerProblem, parseTags } from './youtubeUploadData';
import type { CloudinaryUploadConfig, CloudinaryUpload } from '../../services/api';
import type { ComposerField } from './youtubeUploadData';
import type { YouTubeConnectionSummary, YouTubePrivacy, YouTubeUploadRequest } from '@shared/types/youtubePublishing.ts';

export interface YouTubeComposerProps {
  connections: YouTubeConnectionSummary[];
  cloudConfig: CloudinaryUploadConfig | null;
  cloudLoading: boolean;
  onQueue: (request: YouTubeUploadRequest) => Promise<boolean>;
  showError: (message: string) => void;
}

type KidsChoice = 'yes' | 'no' | '';
const KIDS_OPTIONS: { value: KidsChoice; label: string }[] = [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }];
// YouTube takes custom thumbnails up to 2 MB
const THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024;

const FIELD_IDS: Record<ComposerField, string> = {
  connection: 'yt-channel', video: 'yt-video', title: 'yt-title', madeForKids: 'yt-kids', schedule: 'yt-publish-at',
};

async function register(upload: CloudinaryUpload, label: string): Promise<string> {
  const { media } = await api.registerMedia({ ...upload, label });
  return media.id;
}

export default function YouTubeComposer({ connections, cloudConfig, cloudLoading, onQueue, showError }: YouTubeComposerProps) {
  const active = connections.filter(connection => connection.status === 'active');
  const [connectionId, setConnectionId] = useState(active.length === 1 ? active[0].id : '');
  const [video, setVideo] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [categoryId, setCategoryId] = useState('22');
  const [privacy, setPrivacy] = useState<YouTubePrivacy>('private');
  const [scheduled, setScheduled] = useState(false);
  const [publishAt, setPublishAt] = useState('');
  const [kids, setKids] = useState<KidsChoice>('');
  const [synthetic, setSynthetic] = useState(false);
  const [notify, setNotify] = useState(true);
  const [tried, setTried] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const values = { connectionId, hasVideo: video !== null, title, madeForKids: kids === '' ? null : kids === 'yes', scheduled, publishAt };
  const problem = tried ? composerProblem(values, new Date()) : null;
  const errorFor = (field: ComposerField) => (problem?.field === field ? problem.message : undefined);
  const titleLength = [...title].length;

  function reset() {
    setVideo(null);
    setThumbnail(null);
    setTitle('');
    setDescription('');
    setTags('');
    setScheduled(false);
    setPublishAt('');
    setKids('');
    setSynthetic(false);
    setTried(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (working) return;
    setTried(true);
    const found = composerProblem(values, new Date());
    if (found) {
      document.getElementById(FIELD_IDS[found.field])?.focus();
      return;
    }
    if (!cloudConfig || !video) return;
    if (thumbnail && thumbnail.size > THUMBNAIL_MAX_BYTES) {
      showError('Couldn\'t queue the video. The thumbnail is larger than 2 MB, which YouTube does not accept.');
      return;
    }
    try {
      setWorking('Uploading the video');
      setProgress(0);
      const uploadedVideo = await api.uploadWithDetails(video, cloudConfig, { onProgress: setProgress });
      setWorking('Saving it to your media');
      const mediaId = await register(uploadedVideo, title.trim());
      let thumbnailMediaId: string | null = null;
      if (thumbnail) {
        setWorking('Uploading the thumbnail');
        thumbnailMediaId = await register(await api.uploadWithDetails(thumbnail, cloudConfig), `${title.trim()} thumbnail`);
      }
      setWorking('Queueing the upload');
      const queued = await onQueue({
        connectionId,
        mediaId,
        thumbnailMediaId,
        title: title.trim(),
        description,
        tags: parseTags(tags),
        categoryId,
        privacy: scheduled ? 'private' : privacy,
        publishAt: scheduled ? new Date(publishAt).toISOString() : null,
        madeForKids: kids === 'yes',
        syntheticMedia: synthetic,
        notifySubscribers: notify,
        // one id per press, so a repeated request never queues the video twice
        clientRequestId: crypto.randomUUID(),
      });
      if (queued) reset();
    } catch (err) {
      showError(`Couldn't queue the video. ${(err as Error).message}`);
    } finally {
      setWorking(null);
    }
  }

  return (
    <SurfaceBox title="New upload" headingLevel="h2" subheader="The video goes to Cloudinary first, then to YouTube over the next runs, every 15 minutes.">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <FieldRow label="Channel" htmlFor="yt-channel" error={errorFor('connection')}>
          <Select value={connectionId} onValueChange={value => setConnectionId(String(value))} items={active.map(item => ({ value: item.id, label: item.channelTitle || item.channelId }))}>
            <SelectTrigger id="yt-channel" className="w-full max-w-sm"><SelectValue placeholder="Choose a channel" /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {active.map(item => <SelectItem key={item.id} value={item.id}>{item.channelTitle || item.channelId}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Video" htmlFor="yt-video" hint="MP4 or MOV. A vertical or square video of up to three minutes becomes a Short. Your Cloudinary plan sets the largest size (100 MB on the free plan)." error={errorFor('video')}>
          <input id="yt-video" type="file" accept="video/*" onChange={e => setVideo(e.target.files?.[0] ?? null)} className="block w-full max-w-sm text-body text-ink file:mr-3 file:rounded-control file:border file:border-line-control file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-ink" />
        </FieldRow>

        <FieldRow label="Title" htmlFor="yt-title" hint={`${titleLength} of ${TITLE_MAX} characters.`} error={errorFor('title')}>
          <Input id="yt-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={TITLE_MAX + 20} required />
        </FieldRow>

        <FieldRow label="Description" htmlFor="yt-description" optional>
          <Textarea id="yt-description" value={description} onChange={e => setDescription(e.target.value)} rows={5} />
        </FieldRow>

        <FieldRow label="Tags" htmlFor="yt-tags" optional hint="Separate them with commas.">
          <Input id="yt-tags" value={tags} onChange={e => setTags(e.target.value)} />
        </FieldRow>

        <FieldRow label="Category" htmlFor="yt-category">
          <Select value={categoryId} onValueChange={value => setCategoryId(String(value))} items={CATEGORY_OPTIONS}>
            <SelectTrigger id="yt-category" className="w-full max-w-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {CATEGORY_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Made for kids" htmlFor="yt-kids" group hint="YouTube requires an answer for every video." error={errorFor('madeForKids')}>
          <SegmentedChoice<KidsChoice> name="yt-kids" id="yt-kids" options={KIDS_OPTIONS} value={kids} onChange={setKids} />
        </FieldRow>

        <FieldRow label="Publish later" htmlFor="yt-schedule" hint={scheduled ? 'The video stays private until this time, then YouTube makes it public.' : 'Off: the video gets the visibility below as soon as it is processed.'}>
          <Switch id="yt-schedule" checked={scheduled} onCheckedChange={setScheduled} />
        </FieldRow>

        {scheduled ? (
          <FieldRow label="Publish at" htmlFor="yt-publish-at" hint="In your own time zone." error={errorFor('schedule')}>
            <Input id="yt-publish-at" type="datetime-local" value={publishAt} onChange={e => setPublishAt(e.target.value)} className="max-w-sm" />
          </FieldRow>
        ) : (
          <FieldRow label="Visibility" htmlFor="yt-privacy" group>
            <SegmentedChoice<YouTubePrivacy> name="yt-privacy" id="yt-privacy" options={PRIVACY_OPTIONS} value={privacy} onChange={setPrivacy} />
          </FieldRow>
        )}

        <FieldRow label="Thumbnail" htmlFor="yt-thumbnail" optional hint="JPEG or PNG up to 2 MB. Custom thumbnails need a verified channel.">
          <input id="yt-thumbnail" type="file" accept="image/jpeg,image/png" onChange={e => setThumbnail(e.target.files?.[0] ?? null)} className="block w-full max-w-sm text-body text-ink file:mr-3 file:rounded-control file:border file:border-line-control file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-ink" />
        </FieldRow>

        <div className="flex flex-col gap-3">
          <label htmlFor="yt-synthetic" className="flex items-start gap-2 text-body text-ink">
            <Checkbox id="yt-synthetic" checked={synthetic} onCheckedChange={checked => setSynthetic(checked === true)} className="mt-1" />
            <span>Contains realistic content made or changed with AI</span>
          </label>
          <label htmlFor="yt-notify" className="flex items-start gap-2 text-body text-ink">
            <Checkbox id="yt-notify" checked={notify} onCheckedChange={checked => setNotify(checked === true)} className="mt-1" />
            <span>Tell subscribers about the new video</span>
          </label>
        </div>

        {working && (
          <div role="status" className="flex flex-col gap-2">
            <p className="text-sm text-ink-muted">{working}</p>
            {working === 'Uploading the video' && <Progress value={progress} aria-label="Video upload progress" />}
          </div>
        )}

        <Button type="submit" className="self-start" disabled={working !== null || !cloudConfig}>
          {working ? <Spinner className="size-4" /> : <Upload data-icon="inline-start" />}
          {working ? 'Queueing' : 'Queue upload'}
        </Button>
        {!cloudConfig && (
          <p className="text-sm text-ink-muted">{cloudLoading ? 'Checking the upload settings.' : 'Uploads can\'t start until the upload settings load. The reason is above the form.'}</p>
        )}
      </form>
    </SurfaceBox>
  );
}
