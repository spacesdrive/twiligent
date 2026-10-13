import React from 'react';
import { DocTitle, H2, H3, P, UL, A, Code, Callout, Table, Badge } from '../components';

const BACKEND_VARS = [
  ['SUPABASE_URL', 'required', false, 'Supabase, Project Settings, Data API', 'Which database the Worker talks to.'],
  ['SUPABASE_SERVICE_KEY', 'required', true, 'Supabase, Project Settings, API Keys, secret key (legacy: service_role)', 'Reads and writes all tables on behalf of members.'],
  ['SUPABASE_ANON_KEY', 'required', false, 'Supabase, Project Settings, API Keys, publishable key (legacy: anon)', 'Checks that a sign-in token is genuine.'],
  ['YOUTUBE_API_KEY', 'youtube', true, 'Google Cloud, APIs and Services, Credentials', 'Every YouTube read.'],
  ['INSTAGRAM_APP_ID', 'instagram', false, 'Meta app, Instagram, API setup with Instagram business login', 'Starts Instagram sign-in.'],
  ['INSTAGRAM_APP_SECRET', 'instagram', true, 'Same page as the app ID', 'Exchanges and renews Instagram access tokens.'],
  ['CLOUDINARY_CLOUD_NAME', 'publishing', false, 'Cloudinary dashboard', 'Where uploaded media goes.'],
  ['CLOUDINARY_UPLOAD_PRESET', 'publishing', false, 'Cloudinary, Settings, Upload, Upload presets (unsigned)', 'Lets browsers upload without the Cloudinary API secret.'],
  ['BACKEND_URL', 'instagram', false, 'Your Worker address, no trailing slash', 'Builds the Instagram redirect URI.'],
  ['FRONTEND_URL', 'instagram', false, 'Your Pages address', 'Where members land after Instagram sign-in.'],
  ['UPSTASH_REDIS_REST_URL', 'optional', false, 'Upstash database, REST API', 'Cache address.'],
  ['UPSTASH_REDIS_REST_TOKEN', 'optional', true, 'Upstash database, REST API', 'Cache password.'],
];

const FRONTEND_VARS = [
  ['VITE_SUPABASE_URL', 'required', 'Same as SUPABASE_URL.'],
  ['VITE_SUPABASE_ANON_KEY', 'required', 'The publishable key. Never the secret key.'],
  ['VITE_API_URL', 'required', 'Backend URL plus /api, for example https://twiligent.you.workers.dev/api. Defaults to http://localhost:8787/api in development.'],
  ['VITE_ADMIN_EMAIL', 'optional', 'Where members are told to write for Instagram tester access or help.'],
];

const NEED = {
  required: <Badge tone="required">Required</Badge>,
  youtube: <Badge tone="optional">For YouTube</Badge>,
  instagram: <Badge tone="optional">For Instagram</Badge>,
  publishing: <Badge tone="optional">For publishing</Badge>,
  optional: <Badge tone="optional">Optional</Badge>,
};

export function Environment() {
  return (
    <>
      <DocTitle title="Environment variables" lead="Every value Twiligent reads, where it comes from, and where it goes." />

      <Callout type="note" title="Members can skip this page">
        <p>Only the administrator of an instance sets these. If you sign in to someone else's Twiligent, nothing here applies to you.</p>
      </Callout>

      <H2>Backend (Cloudflare Worker)</H2>
      <P>Set each one with <Code>npx wrangler secret put NAME</Code> in <Code>backend/</Code>. For local development, put them in <Code>backend/.dev.vars</Code>, which Git ignores. See <A to="/docs/self-host/deploy-backend">Deploy the backend</A>.</P>
      <Table
        head={['Name', 'Needed', 'Where to get it', 'Used for']}
        rows={BACKEND_VARS.map(([name, need, secret, from, use]) => [
          <span className="inline-flex flex-col gap-1"><Code>{name}</Code>{secret && <Badge tone="secret">Secret</Badge>}</span>,
          NEED[need],
          from,
          use,
        ])}
      />
      <P>Platform keys are shared by every member of the instance. Missing ones only switch off that platform: Settings shows which are set, and members see a clear message instead of an error.</P>

      <H2>Frontend (Cloudflare Pages)</H2>
      <P>Set these in <Code>frontend/.env</Code> before <Code>npm run build</Code>, or as GitHub secrets when the deploy workflow builds for you. They are built into the site and are public.</P>
      <Table
        head={['Name', 'Needed', 'Value']}
        rows={FRONTEND_VARS.map(([name, need, value]) => [<Code>{name}</Code>, NEED[need], value])}
      />

      <H2>GitHub Actions secrets</H2>
      <Table
        head={['Name', 'Used by']}
        rows={[
          [<Code>CLOUDFLARE_API_TOKEN</Code>, 'Both deploy workflows'],
          [<Code>CLOUDFLARE_ACCOUNT_ID</Code>, 'Both deploy workflows'],
          [<><Code>VITE_SUPABASE_URL</Code>, <Code>VITE_SUPABASE_ANON_KEY</Code>, <Code>VITE_API_URL</Code>, <Code>VITE_ADMIN_EMAIL</Code></>, 'Frontend deploy workflow'],
          [<><Code>SUPABASE_URL</Code>, <Code>SUPABASE_SERVICE_KEY</Code></>, 'Backup scheduler (publish-scheduled.yml)'],
        ]}
      />

      <H2>Not needed</H2>
      <UL>
        <li><Code>REDDIT_ENCRYPTION_KEY</Code> appears in older notes but is no longer read. Reddit cookies are stored server-side and never returned to the browser.</li>
        <li>A GitHub personal access token. Earlier versions asked for one in Settings; it was never used and has been removed.</li>
        <li>A Reddit API key. Members use their own session cookie.</li>
      </UL>
    </>
  );
}

export function Scheduling() {
  return (
    <>
      <DocTitle title="How scheduling works" lead="What happens between choosing Schedule post and the post going live." />

      <H2>For members</H2>
      <P>Nothing to set up. Pick a time, choose <strong>Schedule post</strong>, and close the browser if you like. The server publishes the post within 15 minutes after the time you picked.</P>

      <H2>For administrators</H2>
      <P>Deploying the backend is all that is required. The Worker's cron trigger runs every 15 minutes and publishes every post that is due. The GitHub workflow is an optional second runner for extra reliability.</P>

      <H3>The lifecycle of a post</H3>
      <Table
        head={['Step', 'Status', 'What happens']}
        rows={[
          ['1', <Badge>pending</Badge>, 'The file is on Cloudinary and the post is saved with its time.'],
          ['2', <Badge>publishing</Badge>, 'A scheduler claims the post. Only one scheduler can claim it, so it is published once.'],
          ['3', <Badge>published</Badge>, 'Instagram accepted it. The Instagram media ID is saved.'],
          ['3', <Badge>failed</Badge>, 'Instagram rejected it. The reason is saved and shown in the Error column.'],
        ]}
      />

      <H3>Two schedulers, one post</H3>
      <P>Both schedulers claim a post by changing it from <Code>pending</Code> to <Code>publishing</Code> in a single database update that only succeeds while it is still pending. Whichever arrives second finds nothing to claim and skips it.</P>

      <H3>When posts stay pending</H3>
      <UL>
        <li>The Worker was never deployed, or its cron triggers were removed. Check <strong>Triggers</strong> on the Worker in the Cloudflare dashboard.</li>
        <li><Code>SUPABASE_SERVICE_KEY</Code> or <Code>SUPABASE_URL</Code> is wrong on the Worker.</li>
        <li>The connected Instagram account's access was removed. Reconnect it.</li>
      </UL>
      <P>Twiligent warns members when a post is more than 30 minutes overdue and tells them to contact the administrator.</P>
    </>
  );
}

export function Security() {
  return (
    <>
      <DocTitle title="Security" lead="How member data is kept apart, and the settings an administrator must get right." />

      <H2>What members can rely on</H2>
      <UL>
        <li>Other members cannot see your accounts, scheduled posts or tracked content.</li>
        <li>Instagram access tokens and Reddit cookies are stored on the server and never sent to any browser, including yours.</li>
        <li>No member, including you, ever handles the instance's API keys.</li>
      </UL>

      <H2>How isolation works</H2>
      <P>The browser signs in with Supabase and sends its token with every request. The Worker verifies the token and takes the member's ID from it, never from anything the browser sends. Every database query is limited to that ID. Responses are stripped of tokens and cookies before they leave the Worker.</P>

      <H2>Administrator responsibilities</H2>
      <Table
        head={['Setting', 'Why it matters']}
        rows={[
          ['Row level security on all four tables', 'The publishable key ships in the website. With security off, anyone could use it to read every table directly.'],
          ['Secret key only in server secrets', 'It bypasses all database rules. Keep it in Worker secrets and GitHub Actions secrets only.'],
          ['Signups', 'Supabase allows anyone with the address to sign up. Turn signups off for a private instance.'],
          ['backend/.dev.vars never committed', 'It holds every secret for local development.'],
          ['Instagram testers', 'In development mode, only people you add can connect Instagram.'],
        ]}
      />
      <P>The SQL to turn on row level security is on the <A to="/docs/self-host/supabase">Supabase</A> page.</P>
    </>
  );
}

export function FAQ() {
  return (
    <>
      <DocTitle title="FAQ" lead="Short answers to the questions people ask most." />

      <H3>Do I need GitHub to schedule posts?</H3>
      <P>No. Members never do. Administrators only need the deployed Worker; the GitHub workflow is an optional backup.</P>

      <H3>Do I need my own Supabase project?</H3>
      <P>Only if you run your own instance. Members of someone else's instance use theirs.</P>

      <H3>Why can't I connect my Instagram account?</H3>
      <P>It must be a Business or Creator account, and while the instance's Meta app is in development mode it must be added as a tester. See <A to="/docs/use/connect-accounts">Connect your accounts</A>.</P>

      <H3>Can I connect a YouTube channel I do not own?</H3>
      <P>Yes. YouTube analytics use public data, so any public channel works.</P>

      <H3>Does Twiligent publish to YouTube or Reddit?</H3>
      <P>No. Publishing is Instagram only. YouTube and Reddit are analytics only.</P>

      <H3>What does running an instance cost?</H3>
      <P>For a small team, nothing. Supabase, Cloudflare, Cloudinary and Upstash free plans cover typical use, and the YouTube and Instagram APIs are free.</P>

      <H3>How fresh is the data?</H3>
      <P>Data is fetched when you open a page or choose Refresh, and cached for a short time when Redis is set up. Instagram tokens are renewed nightly.</P>

      <H3>Who do I contact for help?</H3>
      <P>The administrator of your instance. Their address is on the <A to="/docs/use/troubleshooting">Troubleshooting</A> page.</P>
    </>
  );
}
