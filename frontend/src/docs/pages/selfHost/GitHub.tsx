import React from 'react';
import { DocTitle, H2, P, A, Code, Callout, Steps, Step, Table } from '../../components';

export default function GitHub() {
  return (
    <>
      <DocTitle title="GitHub automation" lead="Deploy on every push, and keep a second scheduler running in case the Worker misses a run." />
      <P>Both parts are optional. Fork <A href="https://github.com/spacesdrive/twiligent">spacesdrive/twiligent</A> to your own GitHub account first. Add secrets in your fork under <strong>Settings</strong>, <strong>Secrets and variables</strong>, <strong>Actions</strong>, <strong>New repository secret</strong>.</P>

      <H2>Deploy on push</H2>
      <P>The workflows <Code>deploy-backend.yml</Code> and <Code>deploy-frontend.yml</Code> deploy whenever <Code>backend/</Code> or <Code>frontend/</Code> changes on <Code>main</Code>. A change to <Code>package.json</Code> or <Code>package-lock.json</Code> in the top folder deploys both, because those files list the packages for the whole project. Each workflow installs the packages itself, so there is nothing to install on GitHub.</P>
      <Table
        head={['Secret', 'Where to get it']}
        rows={[
          [<Code>CLOUDFLARE_API_TOKEN</Code>, <>Cloudflare dashboard, <strong>My Profile</strong>, <strong>API Tokens</strong>, <strong>Create Token</strong>, template <strong>Edit Cloudflare Workers</strong>. Add the <strong>Cloudflare Pages: Edit</strong> permission.</>],
          [<Code>CLOUDFLARE_ACCOUNT_ID</Code>, 'Cloudflare dashboard, Workers and Pages overview, shown on the right as Account ID.'],
          [<Code>VITE_SUPABASE_URL</Code>, 'Same value as in frontend/.env.'],
          [<Code>VITE_SUPABASE_ANON_KEY</Code>, 'Same value as in frontend/.env.'],
          [<Code>VITE_API_URL</Code>, 'Same value as in frontend/.env, ending in /api.'],
          [<Code>VITE_ADMIN_EMAIL</Code>, 'Optional. Your contact address.'],
          [<Code>VITE_GOOGLE_CLIENT_ID</Code>, 'Optional. Shows Continue with Google on the sign-in page.'],
        ]}
      />
      <P>Worker secrets stay in Cloudflare; the backend workflow does not need them.</P>

      <H2>Backup scheduler</H2>
      <P>The Worker already publishes scheduled posts. <Code>publish-scheduled.yml</Code> runs the same job from GitHub every 15 minutes as a safety net. Each post is claimed before publishing, so it is never posted twice even when both run at once.</P>
      <Steps>
        <Step title="Add two secrets">
          <P><Code>SUPABASE_URL</Code> and <Code>SUPABASE_SERVICE_KEY</Code>, with the same values the Worker uses.</P>
        </Step>
        <Step title="Enable workflows">
          <P>Forks start with Actions turned off. Open the <strong>Actions</strong> tab and choose <strong>I understand my workflows, go ahead and enable them</strong>. Then open <strong>Instagram Scheduled Publisher</strong> and choose <strong>Enable workflow</strong>.</P>
        </Step>
        <Step title="Run it once">
          <P>Choose <strong>Run workflow</strong>. It worked if the run finishes with a green check and the log says <Code>No posts due for publishing</Code> or shows a Results line.</P>
        </Step>
      </Steps>
      <Callout type="tip" title="Private forks">
        <p>Public repositories get unlimited Actions minutes. A private fork gets 2,000 free minutes a month; change the schedule in the workflow to every 30 minutes to stay inside it.</p>
      </Callout>
      <P>The in-app version of these steps, with links filled in for your GitHub username, is in <strong>Settings</strong>, <strong>Scheduled publishing</strong>.</P>
    </>
  );
}
