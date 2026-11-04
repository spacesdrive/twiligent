import { useRef, useState } from 'react';
import { usePublishProgress } from './usePublishProgress';
import { publishSinglePost, scheduleSinglePost } from './singlePostFlow.ts';
import { singlePostProblem } from './publishHelpers.ts';
import type { CloudinaryUploadConfig } from '../../services/api';
import type { AppContextValue } from '../../context/AppContext';
import type { FieldProblem, SinglePostField } from './publishHelpers.ts';
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
  signal: AbortSignal;
}

// where focus goes for each problem, so the person lands on what to fix
export const SINGLE_POST_FIELD_IDS: Record<SinglePostField, string> = {
  account: 'post-account',
  contentType: 'post-type',
  file: 'post-file',
  server: 'post-publish',
  schedule: 'post-date',
};

function beginRun(run: SinglePublishRun): void {
  run.setUploading(true);
  run.progress.setPublishStatus('uploading-cloudinary');
  run.progress.setActiveStep(2);
}

// the failure is shown on the result screen with Try again, so no toast repeats it
function failRun(run: SinglePublishRun, err: Error): void {
  run.progress.setPublishStatus('error');
  run.progress.setStatusMessage(err.message);
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
    failRun(run, err as Error);
  } finally {
    run.setUploading(false);
  }
}

async function publishNow(run: SinglePublishRun): Promise<void> {
  const { progress } = run;
  beginRun(run);
  progress.setStatusMessage('Uploading media');
  try {
    const mediaId = await publishSinglePost(run.form, run.cloudConfig, progress, run.signal);
    progress.setPublishStatus('done');
    progress.setPublishedMediaId(mediaId);
    progress.setStatusMessage('Published');
    run.showToast('Published to Instagram');
  } catch (err) {
    failRun(run, err as Error);
  } finally {
    run.setUploading(false);
  }
}

export function useSinglePublish({ form, cloudConfig, showToast, onScheduled }: SinglePublishOptions) {
  const progress = usePublishProgress();
  const [uploading, setUploading] = useState(false);
  const [tried, setTried] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  // a problem shows once publishing was tried, then follows the form so it clears as soon as it is fixed
  const problem: FieldProblem<SinglePostField> | null = tried
    ? singlePostProblem({ ...form, hasCloudConfig: Boolean(cloudConfig), now: new Date() })
    : null;
  const errorFor = (field: SinglePostField) => (problem?.field === field ? problem.message : undefined);

  // reads the form as it is at the moment of the click
  const handlePublish = async () => {
    if (uploading) return;
    setTried(true);
    const found = singlePostProblem({ ...form, hasCloudConfig: Boolean(cloudConfig), now: new Date() });
    if (found) {
      document.getElementById(SINGLE_POST_FIELD_IDS[found.field])?.focus();
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    const run: SinglePublishRun = { form, cloudConfig, progress, setUploading, showToast, onScheduled, signal: controller.signal };
    if (form.fields.scheduleMode) {
      await schedulePost(run);
      return;
    }
    await publishNow(run);
  };

  // only the wait for Instagram can stop; an upload or a publish request already sent finishes on its own
  const stopWaiting = () => controllerRef.current?.abort();

  const reset = () => {
    setTried(false);
    progress.resetProgress();
  };

  return { ...progress, uploading, handlePublish, stopWaiting, problem, errorFor, reset };
}

export type SinglePublish = ReturnType<typeof useSinglePublish>;
