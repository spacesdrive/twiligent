import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState } from '@/components/StateViews';
import { InstagramIcon } from '@/components/brand/platform-icons';

export default function NoInstagramAccount() {
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
