import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, FolderUp, Plus, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/PageHeader';
import { useAppContext } from '../../context/AppContext';
import { useCloudinaryConfig } from '../../hooks/use-cloudinary-config';
import BulkUploadTab from './BulkUploadTab';
import NoInstagramAccount from './NoInstagramAccount';
import ScheduledPostDialogs from './ScheduledPostDialogs';
import ScheduledPostsSection from './ScheduledPostsSection';
import SinglePostTab from './SinglePostTab';
import { useBulkPublish } from './useBulkPublish';
import { useBulkQueue } from './useBulkQueue';
import { useBulkSettings } from './useBulkSettings';
import { useScheduledPostDelete } from './useScheduledPostDelete';
import { useScheduledPostEdit } from './useScheduledPostEdit';
import { useScheduledPosts } from './useScheduledPosts';
import { useSinglePostForm } from './useSinglePostForm';
import { useSinglePublish } from './useSinglePublish';

export default function UploadContent() {
  const { accounts, showToast } = useAppContext();
  const cloudConfig = useCloudinaryConfig(accounts);
  const [igAccounts, setIgAccounts] = useState([]);
  const [uploadMode, setUploadMode] = useState('single');
  const schedule = useScheduledPosts();
  const { loadScheduledPosts } = schedule;
  const editor = useScheduledPostEdit({ showToast, loadScheduledPosts });
  const removal = useScheduledPostDelete({ showToast, loadScheduledPosts });
  const form = useSinglePostForm();
  const { setSelectedAccount } = form;
  const publish = useSinglePublish({ form, cloudConfig, showToast, onScheduled: loadScheduledPosts });
  const bulk = useBulkSettings();
  const queue = useBulkQueue({ sharedCaption: bulk.settings.sharedCaption, onFirstFiles: bulk.applyFirstBatchDefaults });
  const bulkPublish = useBulkPublish({ queue, settings: bulk.settings, cloudConfig, showToast, onScheduled: loadScheduledPosts });

  useEffect(() => {
    const instagramAccounts = (accounts || []).filter(account => account.platform === 'instagram');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keeps the original first render
    setIgAccounts(instagramAccounts);
    if (instagramAccounts.length === 1) setSelectedAccount(instagramAccounts[0].id);
    loadScheduledPosts();
  }, [accounts, setSelectedAccount, loadScheduledPosts]);

  const resetAll = () => {
    form.resetForm();
    publish.resetProgress();
  };

  if (igAccounts.length === 0) return <NoInstagramAccount />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Publish"
        description="Post and schedule photos, Reels and Stories to Instagram."
        actions={publish.publishStatus === 'done' && uploadMode === 'single' && (
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
            {queue.files.length > 0 && <Badge variant="solid" className="h-4 px-1.5">{queue.files.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <SinglePostTab form={form} publish={publish} igAccounts={igAccounts} onReset={resetAll} />
        </TabsContent>

        <TabsContent value="bulk">
          <BulkUploadTab bulk={bulk} queue={queue} bulkPublish={bulkPublish} igAccounts={igAccounts} />
        </TabsContent>
      </Tabs>

      {schedule.scheduledPosts.length > 0 && (
        <ScheduledPostsSection schedule={schedule} editor={editor} removal={removal} igAccounts={igAccounts} />
      )}

      <p className="text-caption text-ink-faint">
        Files upload to Cloudinary first because Instagram needs a public URL. Twiligent then creates an Instagram media container, waits for processing, and publishes it. Publishing needs the instagram_business_content_publish permission. Instagram allows 100 posts per account every 24 hours.
      </p>

      <ScheduledPostDialogs removal={removal} />
    </div>
  );
}
