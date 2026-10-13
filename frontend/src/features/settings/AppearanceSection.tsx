import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SurfaceBox from '@/components/SurfaceBox';
import { FieldRow } from '@/components/DetailPanel';
import { useSmoothTheme } from '@/hooks/use-smooth-theme';
import SettingsSection from './SettingsSection';

export default function AppearanceSection() {
  const { theme, setTheme } = useSmoothTheme();
  return (
    <SettingsSection id="appearance" title="Appearance" description="Choose a theme or follow your system setting.">
      <SurfaceBox>
        <FieldRow label="Theme" hint="Dusk is the dark theme, Paper the light one.">
          <Tabs value={theme ?? 'system'} onValueChange={setTheme}>
            <TabsList variant="segmented" className="w-full sm:w-fit">
              <TabsTrigger value="light"><Sun />Light</TabsTrigger>
              <TabsTrigger value="dark"><Moon />Dark</TabsTrigger>
              <TabsTrigger value="system"><Monitor />System</TabsTrigger>
            </TabsList>
          </Tabs>
        </FieldRow>
      </SurfaceBox>
    </SettingsSection>
  );
}
