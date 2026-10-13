import { useState } from 'react';
import { usePublishProgress } from './usePublishProgress';
import { publishSinglePost, scheduleSinglePost } from './singlePostFlow.js';
import { singlePostError } from './publishHelpers.js';

function beginRun(run) {
  run.setUploading(true);
  run.progress.setPublishStatus('uploading-cloudinary');
  run.progress.setActiveStep(2);
}

function failRun(run, err, title) {
  run.progress.setPublishStatus('error');
  run.progress.setStatusMessage(err.message);
  run.showToast(`${title}. ${err.message}`, 'error');
}

async function schedulePost(run) {
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
    failRun(run, err, 'Scheduling failed');
  } finally {
    run.setUploading(false);
  }
}

async function publishNow(run) {
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
    failRun(run, err, 'Publishing failed');
  } finally {
    run.setUploading(false);
  }
}

export function useSinglePublish({ form, cloudConfig, showToast, onScheduled }) {
  const progress = usePublishProgress();
  const [uploading, setUploading] = useState(false);

  // reads the form as it is at the moment of the click
  const handlePublish = async () => {
    const error = singlePostError({ ...form, hasCloudConfig: Boolean(cloudConfig), now: new Date() });
    if (error) {
      showToast(error, 'error');
      return;
    }
    const run = { form, cloudConfig, progress, setUploading, showToast, onScheduled };
    if (form.fields.scheduleMode) {
      await schedulePost(run);
      return;
    }
    await publishNow(run);
  };

  return { ...progress, uploading, handlePublish };
}
