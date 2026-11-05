import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, FolderUp, History, Upload } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ConfirmDialog from '@/components/ConfirmDialog';
import LiveStatus from '@/components/LiveStatus';
import PageHeader from '@/components/PageHeader';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useUrlChoice } from '@/hooks/use-url-state';
import { useAppContext } from '../../context/AppContext';
import { useCloudinaryConfig } from '../../hooks/use-cloudinary-config';
import BulkUploadTab from './BulkUploadTab';
import NoInstagramAccount from './NoInstagramAccount';
import ScheduledPostDialogs from './ScheduledPostDialogs';
import ScheduledPostsSection from './ScheduledPostsSection';
import SinglePostTab from './SinglePostTab';
import { progressHeading } from './queueHelpers.ts';
import { useBulkPublish } from './useBulkPublish';
import { useBulkQueue } from './useBulkQueue';
import { useBulkSettings } from './useBulkSettings';
import { useScheduledPostDelete } from './useScheduledPostDelete';
import { useScheduledPostEdit } from './useScheduledPostEdit';
import { useScheduledPosts } from './useScheduledPosts';
import { useSinglePostForm } from './useSinglePostForm';
import { useSinglePublish } from './useSinglePublish';
import type { AppAccount } from '../../utils/formatters';
import type { PublishStatus } from './queueHelpers.ts';

type UploadMode = 'single' | 'bulk';
const UPLOAD_MODES: UploadMode[] = ['single', 'bulk'];

// what the page's live region says at each stage; the end states are read from the result heading instead
function stageAnnouncement(status: PublishStatus, uploading: boolean): string {
  if (status === 'uploading-cloudinary') return 'Uploading media';
  if (status === 'creating-container' || status === 'processing' || status === 'publishing' || status === 'scheduling') return progressHeading(status);
  return uploading ? 'Working' : '';
}

export default function UploadContent() {
  const { accounts, showToast } = useAppContext();
  const cloudinary = useCloudinaryConfig(accounts);
  const cloudConfig = cloudinary.config;
  const [igAccounts, setIgAccounts] = useState<AppAccount[]>([]);
  const [uploadMode, setUploadMode] = useUrlChoice<UploadMode>('mode', UPLOAD_MODES, 'single');
  const schedule = useScheduledPosts();
  const { loadScheduledPosts } = schedule;
  const editor = useScheduledPostEdit({ showToast, loadScheduledPosts });
  const removal = useScheduledPostDelete({ showToast, loadScheduledPosts, hidePost: schedule.hidePost, showPost: schedule.showPost });
  const form = useSinglePostForm();
  const { setSelectedAccount } = form;
  const publish = useSinglePublish({ form, cloudConfig, showToast, onScheduled: loadScheduledPosts });
  const bulk = useBulkSettings();
  const queue = useBulkQueue({ sharedCaption: bulk.settings.sharedCaption, onFirstFiles: bulk.applyFirstBatchDefaults });
  const bulkPublish = useBulkPublish({ queue, settings: bulk.settings, cloudConfig, showToast, onScheduled: loadScheduledPosts });

  // work in progress or typed and not yet sent; leaving would stop the uploads or drop the files
  const running = publish.uploading || queue.processing;
  const singleUnsent = form.dirty && publish.activeStep !== 2;
  const bulkUnsent = queue.files.some(item => item.status === 'pending');
  const guard = useUnsavedChanges(running || singleUnsent || bulkUnsent || editor.dirty);

  useEffect(() => {
    const instagramAccounts = (accounts || []).filter(account => account.platform === 'instagram');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIgAccounts(instagramAccounts);
    if (instagramAccounts.length === 1) setSelectedAccount(instagramAccounts[0].id);
    loadScheduledPosts();
  }, [accounts, setSelectedAccount, loadScheduledPosts]);

  const resetAll = () => {
    form.resetForm();
    publish.reset();
  };

  if (igAccounts.length === 0) return <NoInstagramAccount />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Instagram publishing" description="Post and schedule photos, Reels and Stories to Instagram." />
      <LiveStatus message={stageAnnouncement(publish.publishStatus, publish.uploading)} />

      {cloudinary.error && (
        <Alert variant="warning">
          <AlertCircle />
          <AlertDescription>
            Uploads can't start: the upload settings did not load. {cloudinary.error} The server status is in <Link to="/settings#server-keys" className="font-semibold underline underline-offset-4">Settings</Link>.
          </AlertDescription>
          <AlertAction><Button size="xs" variant="outline" onClick={cloudinary.retry} disabled={cloudinary.loading}>{cloudinary.loading ? 'Trying again' : 'Try again'}</Button></AlertAction>
        </Alert>
      )}

      {form.restored && publish.activeStep !== 2 && (
        <Alert variant="info">
          <History />
          <AlertTitle>Your caption and settings are back</AlertTitle>
          <AlertDescription>They were kept from earlier in this tab. Choose the file again to post them.</AlertDescription>
          <AlertAction><Button size="sm" variant="outline" onClick={resetAll}>Discard them</Button></AlertAction>
        </Alert>
      )}

      <Tabs value={uploadMode} onValueChange={value => setUploadMode(value as UploadMode)} className="gap-6">
        <TabsList>
          <TabsTrigger value="single"><Upload />Single post</TabsTrigger>
          <TabsTrigger value="bulk">
            <FolderUp />Bulk upload
            {queue.files.length > 0 && <Badge variant="solid" className="h-4 px-1.5"><span className="sr-only">, </span>{queue.files.length}<span className="sr-only"> files</span></Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <SinglePostTab form={form} publish={publish} igAccounts={igAccounts} onReset={resetAll} />
        </TabsContent>

        <TabsContent value="bulk">
          <BulkUploadTab bulk={bulk} queue={queue} bulkPublish={bulkPublish} igAccounts={igAccounts} />
        </TabsContent>
      </Tabs>

      {(schedule.scheduledPosts.length > 0 || schedule.loadError) && (
        <ScheduledPostsSection schedule={schedule} editor={editor} removal={removal} igAccounts={igAccounts} />
      )}

      <ScheduledPostDialogs removal={removal} />
      <ConfirmDialog
        open={guard.blocked}
        onOpenChange={open => { if (!open) guard.stay(); }}
        title={running ? 'Leave while posts are uploading?' : 'Leave without posting?'}
        description={running
          ? 'Leaving stops the files that have not started. A file that is uploading or publishing right now may still finish, and files that already went out keep their status.'
          : 'Chosen files are not kept. A typed caption and settings stay in this tab and come back when you return.'}
        cancelLabel="Stay on this page"
        confirmLabel="Leave"
        onConfirm={() => {
          bulkPublish.stopBulk();
          publish.stopWaiting();
          guard.leave();
        }}
      />
    </div>
  );
}
