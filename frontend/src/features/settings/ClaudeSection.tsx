import React, { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import SurfaceBox from '@/components/SurfaceBox';
import { FieldRow } from '@/components/DetailPanel';
import { ErrorState } from '@/components/StateViews';
import { docsUrl } from '@/lib/docs';
import { useAppContext } from '../../context/AppContext';
import SettingsSection from './SettingsSection';
import CopyField from './CopyField';
import ClaudeTokenForm from './ClaudeTokenForm';
import ClaudeTokenList from './ClaudeTokenList';
import ClaudeClientList from './ClaudeClientList';
import { claudeCodeCommand } from './claudeAccessData';
import { useClaudeAccess } from './useClaudeAccess';
import type { CreatedToken } from './useClaudeAccess';

function CreatedTokenNotice({ created, serverUrl, onDone }: { created: CreatedToken; serverUrl: string; onDone: () => void }) {
  // the token is shown once, so focus goes to it for keyboard and screen reader users
  useEffect(() => {
    document.getElementById('mcp-new-token')?.focus();
  }, [created.token]);

  return (
    <Alert>
      <CheckCircle2 />
      <AlertTitle>Copy {created.summary.label} now</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>This is the only time the token is shown. Store it like a password; anyone who has it can act as you.</p>
        <FieldRow label="Access token" htmlFor="mcp-new-token">
          <CopyField id="mcp-new-token" label="access token" value={created.token} />
        </FieldRow>
        <FieldRow label="Claude Code command with this token" htmlFor="mcp-new-command">
          <CopyField id="mcp-new-command" label="Claude Code command" value={claudeCodeCommand(serverUrl, created.token)} />
        </FieldRow>
        <Button variant="outline" size="sm" className="self-start" onClick={onDone}>I copied it</Button>
      </AlertDescription>
    </Alert>
  );
}

export default function ClaudeSection() {
  const { showToast } = useAppContext();
  const state = useClaudeAccess(showToast);
  const { access, error, loading } = state;

  return (
    <SettingsSection
      id="claude"
      title="Claude"
      description="Let Claude read your analytics and manage your scheduled posts. Each connection acts as you and can do only what you allow."
    >
      {loading && !access && (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">Loading Claude connection settings</span>
          <Skeleton className="h-40 rounded-card" />
          <Skeleton className="h-40 rounded-card" />
        </div>
      )}

      {error && !access && (
        <SurfaceBox>
          <ErrorState title="Claude connection settings could not load" description={error} onRetry={() => { void state.reload(); }} />
        </SurfaceBox>
      )}

      {access && (
        <>
          <SurfaceBox title="Connect Claude" headingLevel="h3">
            <div className="flex flex-col gap-4">
              <FieldRow label="Server address" htmlFor="mcp-server-url">
                <CopyField id="mcp-server-url" label="server address" value={access.serverUrl} />
              </FieldRow>
              <FieldRow label="Claude Code" htmlFor="mcp-command" hint="Run this in a terminal, with twl_your_token replaced by a token you create below.">
                <CopyField id="mcp-command" label="Claude Code command" value={claudeCodeCommand(access.serverUrl)} />
              </FieldRow>
              <p className="max-w-prose text-body text-ink-muted">
                {access.oauthEnabled
                  ? 'Claude on the web, desktop and mobile: add a custom connector with the server address, then approve it when Twiligent asks.'
                  : 'Claude on the web, desktop and mobile needs connector sign-in, which the instance owner has not turned on yet. Claude Code works now with a token.'}
                {' '}
                <a href={docsUrl('/use/claude')} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline underline-offset-4">
                  How to connect Claude<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </p>
            </div>
          </SurfaceBox>

          <SurfaceBox title="Access tokens" headingLevel="h3" subheader="For Claude Code and other clients that send a token. Each one signs in as you.">
            <div className="flex flex-col gap-6">
              {state.created && <CreatedTokenNotice created={state.created} serverUrl={access.serverUrl} onDone={state.dismissCreated} />}
              <ClaudeTokenForm creating={state.creating} onCreate={state.createToken} />
            </div>
          </SurfaceBox>

          <SurfaceBox title="Your tokens" headingLevel="h3" content={false}>
            <ClaudeTokenList tokens={access.tokens} revokingId={state.revokingId} onRevoke={state.revokeToken} />
          </SurfaceBox>

          <SurfaceBox title="Approved apps" headingLevel="h3" subheader="Claude apps you approved through connector sign-in." content={false}>
            <ClaudeClientList clients={access.clients} oauthEnabled={access.oauthEnabled} revokingId={state.revokingId} onRemove={state.revokeClient} />
          </SurfaceBox>
        </>
      )}
    </SettingsSection>
  );
}
