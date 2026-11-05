import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import SegmentedChoice from '@/components/SegmentedChoice';
import { FieldRow } from '@/components/DetailPanel';
import { LoadingState } from '@/components/StateViews';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { CONSENT_ABILITIES, redirectHost } from '@/lib/oauthConsent';
import { PERMISSION_OPTIONS } from '../features/settings/claudeAccessData';
import { useAuth } from '../context/AuthContext';
import { useOAuthConsent } from './useOAuthConsent';
import type { OAuthAuthorizationDetails } from '@supabase/supabase-js';
import type { McpPermission } from '@shared/types/mcp.ts';

interface ConsentFormProps {
  details: OAuthAuthorizationDetails;
  busy: 'allow' | 'deny' | null;
  onAllow: (permission: McpPermission) => void;
  onDeny: () => void;
}

function ConsentForm({ details, busy, onAllow, onDeny }: ConsentFormProps) {
  const { signOut } = useAuth();
  // read only is the default, so allowing without a second look cannot change anything
  const [permission, setPermission] = useState<McpPermission>('read');
  const appName = details.client.name || 'This app';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 id="consent-title" className="font-heading text-page-title font-semibold text-ink">Allow {appName} to use your Twiligent account?</h1>
        <p className="text-body text-ink-muted">
          After you choose, you go back to <span className="font-semibold text-ink">{redirectHost(details.redirect_uri)}</span>.
        </p>
      </div>

      <FieldRow label={`What ${appName} may do`} htmlFor="consent-permission" group>
        <SegmentedChoice<McpPermission>
          name="consent-permission"
          id="consent-permission"
          options={PERMISSION_OPTIONS}
          value={permission}
          onChange={setPermission}
          disabled={busy !== null}
        />
      </FieldRow>
      <ul className="flex flex-col gap-2" aria-label={`What ${PERMISSION_OPTIONS.find(option => option.value === permission)?.label ?? ''} allows`}>
        {CONSENT_ABILITIES[permission].map(line => (
          <li key={line} className="flex items-start gap-2 text-body text-ink">
            <Check className="mt-1 size-4 shrink-0 text-success" aria-hidden="true" />
            {line}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button onClick={() => onAllow(permission)} disabled={busy !== null} className="sm:flex-1">
          {busy === 'allow' && <Spinner className="size-4" />}
          {busy === 'allow' ? 'Allowing' : 'Allow'}
        </Button>
        <Button variant="outline" onClick={onDeny} disabled={busy !== null} className="sm:flex-1">
          {busy === 'deny' && <Spinner className="size-4" />}
          {busy === 'deny' ? 'Denying' : 'Deny'}
        </Button>
      </div>

      <p className="text-center text-small text-ink-muted">
        Signed in as {details.user.email}.{' '}
        <button type="button" onClick={() => { void signOut(); }} className="font-semibold text-ink underline underline-offset-4">
          Not you? Sign out
        </button>
        <br />
        You can remove {appName} at any time in Settings, Claude.
      </p>
    </div>
  );
}

function ConsentProblem({ message }: { message: string }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 text-center">
      <span className="flex size-11 items-center justify-center rounded-card bg-danger-soft text-danger">
        <AlertTriangle className="size-5 stroke-[1.75]" aria-hidden="true" />
      </span>
      <h1 id="consent-title" className="font-heading text-section font-semibold text-ink">
        <span className="sr-only">Error: </span>Claude could not be connected
      </h1>
      <p className="max-w-prose text-body text-ink-muted">{message}</p>
    </div>
  );
}

export default function OAuthConsent() {
  useDocumentTitle('Allow access');
  const [params] = useSearchParams();
  const { state, busy, allow, deny } = useOAuthConsent(params.get('authorization_id'));

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface px-4 py-10">
      <section
        aria-labelledby="consent-title"
        aria-busy={state.kind === 'loading' || state.kind === 'leaving'}
        className="w-full max-w-[30rem] rounded-dialog border border-line bg-popover p-8 text-popover-foreground shadow-lg sm:p-9"
      >
        <Logo className="mx-auto mb-6 h-7" />
        {(state.kind === 'loading' || state.kind === 'leaving') && <h1 id="consent-title" className="sr-only">Connect an app to Twiligent</h1>}
        {state.kind === 'loading' && <LoadingState label="Loading the request" className="min-h-40" />}
        {state.kind === 'leaving' && <LoadingState label="Returning you to the app" className="min-h-40" />}
        {state.kind === 'failed' && <ConsentProblem message={state.message} />}
        {state.kind === 'ready' && (
          <ConsentForm
            details={state.details}
            busy={busy}
            onAllow={permission => { void allow(state.details, permission); }}
            onDeny={() => { void deny(state.details); }}
          />
        )}
      </section>
    </div>
  );
}
