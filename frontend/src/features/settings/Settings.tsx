import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/PageHeader';
import { useAppContext } from '../../context/AppContext';
import { useServerSettings } from './useServerSettings';
import SettingsSection from './SettingsSection';
import AppearanceSection from './AppearanceSection';
import PasswordSection from './PasswordSection';
import ServerKeysSection from './ServerKeysSection';
import SchedulingSection from './SchedulingSection';
import PlatformRequirementsSection from './PlatformRequirementsSection';
import UsefulLinksSection from './UsefulLinksSection';

export default function Settings() {
  const { showToast, refreshAll, loading: refreshingAll } = useAppContext();
  const { serverStatus, loading, github } = useServerSettings(showToast);
  const location = useLocation();

  // links such as /settings#scheduling jump to their section after loading
  useEffect(() => {
    if (loading || !location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [loading, location.hash]);

  // the setup guide picks its open state at mount, so it mounts after loading
  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Settings" description="Appearance, password, connections and setup guides" />
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-40 rounded-card" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Settings" description="Appearance, password, connections and setup guides" />

      <div className="flex flex-col gap-8">
        <AppearanceSection />
        <PasswordSection />
        <ServerKeysSection serverStatus={serverStatus} refreshAll={refreshAll} refreshingAll={refreshingAll} />
        <SchedulingSection github={github} />
        <PlatformRequirementsSection />
        <UsefulLinksSection />
        <SettingsSection id="about" title="About Twiligent" description="Analytics and publishing for YouTube, Instagram and Reddit, run on your own infrastructure." />
      </div>
    </div>
  );
}
