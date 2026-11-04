import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import SurfaceBox from '@/components/SurfaceBox';
import SegmentedChoice from '@/components/SegmentedChoice';
import { FieldRow } from '@/components/DetailPanel';
import { useSmoothTheme } from '@/hooks/use-smooth-theme';
import SettingsSection from './SettingsSection';

type ThemeChoice = 'light' | 'dark' | 'system';

const THEMES = [
  { value: 'light' as const, label: 'Light', icon: <Sun /> },
  { value: 'dark' as const, label: 'Dark', icon: <Moon /> },
  { value: 'system' as const, label: 'System', icon: <Monitor /> },
];

// a theme applies the moment it is picked, so this section has no Save button
export default function AppearanceSection() {
  const { theme, setTheme } = useSmoothTheme();
  return (
    <SettingsSection id="appearance" title="Appearance" description="Choose a theme or follow your system setting.">
      <SurfaceBox>
        <FieldRow label="Theme" htmlFor="theme" group hint="System follows the light or dark setting of your device. The change applies at once.">
          <SegmentedChoice<ThemeChoice>
            name="theme"
            options={THEMES}
            value={(theme as ThemeChoice | undefined) ?? 'system'}
            onChange={setTheme}
          />
        </FieldRow>
      </SurfaceBox>
    </SettingsSection>
  );
}
