import { useState } from 'react';
import { usePublishProgress } from './usePublishProgress';
import { publishSinglePost, scheduleSinglePost } from './singlePostFlow.ts';
import { singlePostError } from './publishHelpers.ts';
import type { CloudinaryUploadConfig } from '../../services/api';
import type { AppContextValue } from '../../context/AppContext';
import type { PublishProgressState } from './usePublishProgress';
import type { SinglePostForm } from './useSinglePostForm';

export interface SinglePublishOptions {
  form: SinglePostForm;
  cloudConfig: CloudinaryUploadConfig | null;
  showToast: AppContextValue['showToast'];
  onScheduled: () => void;
}

interface SinglePublishRun extends SinglePublishOptions {
  progress: PublishProgressState;
  setUploading: (uploading: boolean) => void;
}

function beginRun(run: SinglePublishRun): void {
  run.setUploading(true);
  run.progress.setPublishStatus('uploading-cloudinary');
  run.progress.setActiveStep(2);
}

function failRun(run: SinglePublishRun, err: Error, title: string): void {
  run.progress.setPublishStatus('error');
  run.progress.setStatusMessage(err.message);
  run.showToast(`${title}. ${err.message}`, 'error');
}

async function schedulePost(run: SinglePublishRun): Promise<void> {
  const { form, progress } = run;
  const scheduledAt = new Date(`${form.fields.scheduleDate}T${form.fields.scheduleTime}`);
  beginRun(run);
  try {
    await scheduleSinglePost(form, run.cloudConfig, scheduledAt, progress);
    progress.setPublishStatus('scheduled');
    progress.setStatusMessage(`Scheduled for ${scheduledAt.toLocaleString()}`);
    run.showToast('Post scheduled');
    run.onScheduled();
  } catch (err) {
    failRun(run, err as Error, 'Scheduling failed');
  } finally {
    run.setUploading(false);
  }
}

async function publishNow(run: SinglePublishRun): Promise<void> {
  const { progress } = run;
  beginRun(run);
  progress.setStatusMessage('Uploading media');
  try {
    const mediaId = await publishSinglePost(run.form, run.cloudConfig, progress);
    progress.setPublishStatus('done');
    progress.setPublishedMediaId(mediaId);
    progress.setStatusMessage('Published');
    run.showToast('Published to Instagram');
  } catch (err) {
    failRun(run, err as Error, 'Publishing failed');
  } finally {
    run.setUploading(false);
  }
}

export function useSinglePublish({ form, cloudConfig, showToast, onScheduled }: SinglePublishOptions) {
  const progress = usePublishProgress();
  const [uploading, setUploading] = useState(false);

  // reads the form as it is at the moment of the click
  const handlePublish = async () => {
    const error = singlePostError({ ...form, hasCloudConfig: Boolean(cloudConfig), now: new Date() });
    if (error) {
      showToast(error, 'error');
      return;
    }
    const run: SinglePublishRun = { form, cloudConfig, progress, setUploading, showToast, onScheduled };
    if (form.fields.scheduleMode) {
      await schedulePost(run);
      return;
    }
    await publishNow(run);
  };

  return { ...progress, uploading, handlePublish };
}

export type SinglePublish = ReturnType<typeof useSinglePublish>;
