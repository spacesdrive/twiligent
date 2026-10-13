import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import SurfaceBox from '@/components/SurfaceBox';
import { cn } from '@/lib/utils';
import SettingsSection from './SettingsSection';
import { useApiHealthCheck } from './useApiHealthCheck';
import type { KeysStatusResponse } from '@shared/types/domain.ts';

interface StatusRowProps {
  label: string;
  ok?: boolean;
  hint?: string;
}

export interface ServerKeysSectionProps {
  serverStatus: KeysStatusResponse | null;
  refreshAll: () => void;
  refreshingAll: boolean;
}

function StatusRow({ label, ok, hint }: StatusRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="text-caption text-ink-faint">{hint}</p>}
      </div>
      {ok ? (
        <Badge variant="success"><CheckCircle2 />Configured</Badge>
      ) : (
        <Badge variant="warning"><AlertTriangle />Not set</Badge>
      )}
    </div>
  );
}

export default function ServerKeysSection({ serverStatus, refreshAll, refreshingAll }: ServerKeysSectionProps) {
  const { testing, testResult, handleTest } = useApiHealthCheck();
  return (
    <SettingsSection
      id="server-keys"
      title="Server API keys"
      description="YouTube, Instagram and Cloudinary credentials are environment variables on the server, shared by everyone on this instance."
    >
      <SurfaceBox content={false} className="divide-y divide-divider">
        <StatusRow label="YouTube" hint="Channel and video analytics" ok={serverStatus?.youtube?.configured} />
        <StatusRow label="Instagram" hint="Account connection and publishing" ok={serverStatus?.instagram?.configured} />
        <StatusRow label="Cloudinary" hint="Media hosting for publishing" ok={serverStatus?.cloudinary?.configured} />
      </SurfaceBox>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={handleTest} disabled={testing}>
          {testing ? <Spinner className="size-4" /> : <Activity data-icon="inline-start" />}
          {testing ? 'Checking API' : 'Check API health'}
        </Button>
        <Button variant="outline" onClick={refreshAll} disabled={refreshingAll}>
          <RefreshCw data-icon="inline-start" className={cn(refreshingAll && 'animate-spin')} />
          {refreshingAll ? 'Refreshing accounts' : 'Refresh all accounts'}
        </Button>
      </div>
      {testResult && (
        <Alert variant={testResult.success ? 'success' : 'destructive'}>
          {testResult.success ? <CheckCircle2 /> : <AlertTriangle />}
          <AlertDescription>{testResult.success ? '' : 'Error: '}{testResult.message}</AlertDescription>
        </Alert>
      )}
    </SettingsSection>
  );
}
