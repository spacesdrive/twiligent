import { useState } from 'react';
import { defaultBulkStartDate } from './scheduleHelpers.ts';
import type { BulkSettings } from './publishHelpers.ts';

const INITIAL_SETTINGS: BulkSettings = {
  account: '',
  contentType: 'REELS',
  sharedCaption: '',
  collaborators: '',
  userTags: '',
  locationId: '',
  shareToFeed: true,
  scheduleMode: false,
  startDate: '',
  startTime: '',
  interval: 1440,
};

export function useBulkSettings() {
  const [settings, setSettings] = useState(INITIAL_SETTINGS);

  const setSetting = <K extends keyof BulkSettings>(name: K, value: BulkSettings[K]) => setSettings(prev => ({ ...prev, [name]: value }));

  // the first files added default to one post a day from 08:00 the next day
  const applyFirstBatchDefaults = () => {
    const startDate = defaultBulkStartDate();
    setSettings(prev => ({ ...prev, scheduleMode: true, interval: 1440, startTime: '08:00', startDate }));
  };

  return { settings, setSetting, applyFirstBatchDefaults };
}

export type BulkSettingsState = ReturnType<typeof useBulkSettings>;
