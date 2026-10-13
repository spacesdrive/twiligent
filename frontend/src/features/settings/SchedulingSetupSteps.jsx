import React from 'react';
import { GitFork, KeyRound, Lock, PlayCircle, Power } from 'lucide-react';
import CopyChip from './CopyChip';
import GuideLinkButton from './GuideLinkButton';
import RepoLinkButton from './RepoLinkButton';
import SetupStep from './SetupStep';

const UPSTREAM_REPO = 'spacesdrive/twiligent';
const SUPABASE_KEYS_URL = 'https://supabase.com/dashboard/project/_/settings/api-keys';
const SUPABASE_URL_PAGE = 'https://supabase.com/dashboard/project/_/integrations/data_api/overview';

export default function SchedulingSetupSteps({ done, toggle, base }) {
  return (
    <ol className="flex flex-col gap-3">
      <SetupStep
        number={1}
        icon={GitFork}
        title="Make your own copy of Twiligent on GitHub"
        done={!!done.fork}
        onToggle={toggle('fork')}
        check="you see the twiligent repository under your own GitHub username."
      >
        <p>Open the Twiligent repository and choose <strong>Fork</strong>, then <strong>Create fork</strong>. Keep it public: GitHub runs public repositories for free.</p>
        <div><GuideLinkButton href={`https://github.com/${UPSTREAM_REPO}/fork`}>Fork on GitHub</GuideLinkButton></div>
      </SetupStep>

      <SetupStep
        number={2}
        icon={KeyRound}
        title="Copy two values from Supabase"
        done={!!done.supabase}
        onToggle={toggle('supabase')}
        check="you have the project URL and the secret key ready to paste."
      >
        <p><strong>Project URL.</strong> In Supabase, open your project, then <strong>Integrations, Data API</strong>. It looks like <code className="font-mono text-small text-ink">https://abcdefgh.supabase.co</code>.</p>
        <p><strong>Secret key.</strong> Open <strong>Settings, API Keys</strong> and copy a secret key (it starts with <code className="font-mono text-small text-ink">sb_secret_</code>). If your project only shows legacy keys, copy <strong>service_role</strong> instead.</p>
        <p className="flex items-start gap-1.5 text-small text-warning"><Lock className="mt-0.5 size-3.5 shrink-0" />The secret key can read and change all your data. Paste it only into GitHub secrets in the next step, never into code, chat or email.</p>
        <div className="flex flex-wrap gap-2">
          <GuideLinkButton href={SUPABASE_URL_PAGE}>Open Data API</GuideLinkButton>
          <GuideLinkButton href={SUPABASE_KEYS_URL}>Open API Keys</GuideLinkButton>
        </div>
      </SetupStep>

      <SetupStep
        number={3}
        icon={Lock}
        title="Save the two values as secrets in your copy"
        done={!!done.secrets}
        onToggle={toggle('secrets')}
        check="both names appear in the Repository secrets list."
      >
        <p>On the secrets page choose <strong>New repository secret</strong>. Type the name exactly as shown, paste the value, and choose <strong>Add secret</strong>. Do it twice:</p>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2"><CopyChip text="SUPABASE_URL" /><span className="text-small">with the project URL</span></div>
          <div className="flex flex-wrap items-center gap-2"><CopyChip text="SUPABASE_SERVICE_KEY" /><span className="text-small">with the secret key</span></div>
        </div>
        <div><RepoLinkButton base={base} path="/settings/secrets/actions" label="Open secrets page" /></div>
      </SetupStep>

      <SetupStep
        number={4}
        icon={Power}
        title="Switch on the publisher"
        done={!!done.enable}
        onToggle={toggle('enable')}
        check="Instagram Scheduled Publisher is listed on the left with no disabled warning."
      >
        <p>GitHub switches workflows off in new copies. Open the <strong>Actions</strong> tab and choose <strong>I understand my workflows, go ahead and enable them</strong>. Then choose <strong>Instagram Scheduled Publisher</strong> in the list on the left, and if a yellow banner says it is disabled, choose <strong>Enable workflow</strong>.</p>
        <div><RepoLinkButton base={base} path="/actions" label="Open Actions" /></div>
      </SetupStep>

      <SetupStep
        number={5}
        icon={PlayCircle}
        title="Run it once to test"
        done={!!done.test}
        onToggle={toggle('test')}
        check="the run shows a green tick after about a minute. The log saying “No posts due for publishing” is fine."
      >
        <p>On the publisher page choose <strong>Run workflow</strong>, then the green <strong>Run workflow</strong> button. Refresh the page after a few seconds and open the new run.</p>
        <p>A red cross with <strong>Missing SUPABASE_URL or SUPABASE_SERVICE_KEY</strong> means a secret name is misspelled; fix it in step 3. Any other red cross usually means the secret key was pasted incompletely.</p>
        <div><RepoLinkButton base={base} path="/actions/workflows/publish-scheduled.yml" label="Open the publisher" /></div>
      </SetupStep>
    </ol>
  );
}
