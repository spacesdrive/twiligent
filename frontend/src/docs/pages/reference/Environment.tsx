import React from 'react';
import { DocTitle, H2, P, UL, A, Code, Callout, Table, Badge } from '../../components';

type Need = keyof typeof NEED;

const BACKEND_VARS: [string, Need, boolean, string, string][] = [
  ['SUPABASE_URL', 'required', false, 'Supabase, Project Settings, Data API', 'Which database the Worker talks to.'],
  ['SUPABASE_SERVICE_KEY', 'required', true, 'Supabase, Project Settings, API Keys, secret key (legacy: service_role)', 'Reads and writes all tables on behalf of members.'],
  ['SUPABASE_ANON_KEY', 'required', false, 'Supabase, Project Settings, API Keys, publishable key (legacy: anon)', 'Checks that a sign-in token is genuine.'],
  ['YOUTUBE_API_KEY', 'youtube', true, 'Google Cloud, APIs and Services, Credentials', 'Every YouTube read.'],
  ['INSTAGRAM_APP_ID', 'instagram', false, 'Meta app, Instagram, API setup with Instagram business login', 'Starts Instagram sign-in.'],
  ['INSTAGRAM_APP_SECRET', 'instagram', true, 'Same page as the app ID', 'Exchanges and renews Instagram access tokens.'],
  ['CLOUDINARY_CLOUD_NAME', 'publishing', false, 'Cloudinary dashboard', 'Where uploaded media goes.'],
  ['CLOUDINARY_UPLOAD_PRESET', 'publishing', false, 'Cloudinary, Settings, Upload, Upload presets (unsigned)', 'Lets browsers upload without the Cloudinary API secret.'],
  ['BACKEND_URL', 'instagram', false, 'Your Worker address, no trailing slash', 'Builds the Instagram redirect URI.'],
  ['FRONTEND_URL', 'required', false, 'Your Pages address', 'The only site the backend accepts requests from, and where members land after Instagram sign-in.'],
  ['ALLOWED_ORIGINS', 'optional', false, 'Other addresses the site is served from, comma-separated, for example https://twiligent.pages.dev', 'Lets the site call the backend from more than one address.'],
  ['UPSTASH_REDIS_REST_URL', 'optional', false, 'Upstash database, REST API', 'Cache address.'],
  ['UPSTASH_REDIS_REST_TOKEN', 'optional', true, 'Upstash database, REST API', 'Cache password.'],
  ['SEND_EMAIL_HOOK_SECRET', 'optional', true, 'Supabase, Authentication, Auth Hooks, Send Email hook', 'Proves an email request came from your Supabase project.'],
  ['RESEND_API_KEY', 'optional', true, 'Resend, API Keys (sending access)', 'Sends verification codes and other sign-in emails.'],
  ['EMAIL_FROM', 'optional', false, 'A sender on a domain verified in Resend, for example Twiligent <no-reply@example.com>', 'The sender of those emails.'],
  ['EMAIL_DAILY_LIMIT', 'optional', false, 'A whole number; 100 when not set', 'Emails a day before sign-up points people to Google.'],
];

const FRONTEND_VARS: [string, Need, string][] = [
  ['VITE_SUPABASE_URL', 'required', 'Same as SUPABASE_URL.'],
  ['VITE_SUPABASE_ANON_KEY', 'required', 'The publishable key. Never the secret key.'],
  ['VITE_API_URL', 'required', 'Backend URL plus /api, for example https://twiligent.you.workers.dev/api. Defaults to http://localhost:8787/api in development.'],
  ['VITE_ADMIN_EMAIL', 'optional', 'Where members are told to write for Instagram tester access or help.'],
  ['VITE_GOOGLE_CLIENT_ID', 'optional', 'Web client ID from Google Auth Platform. Shows the Sign in with Google button; leave unset to hide it.'],
];

const NEED = {
  required: <Badge tone="required">Required</Badge>,
  youtube: <Badge tone="optional">For YouTube</Badge>,
  instagram: <Badge tone="optional">For Instagram</Badge>,
  publishing: <Badge tone="optional">For publishing</Badge>,
  optional: <Badge tone="optional">Optional</Badge>,
};

export default function Environment() {
  return (
    <>
      <DocTitle title="Environment variables" lead="Every value Twiligent reads, where it comes from, and where it goes." />

      <Callout type="note" title="Members can skip this page">
        <p>Only the administrator of an instance sets these. If you sign in to someone else's Twiligent, nothing here applies to you.</p>
      </Callout>

      <H2>Backend (Cloudflare Worker)</H2>
      <P>Set each one with <Code>npx wrangler secret put NAME</Code> in <Code>backend/</Code>. For local development, put them in <Code>backend/.dev.vars</Code>, which Git ignores. See <A to="/docs/self-host/deploy-backend">Deploy the backend</A>.</P>
      <P>The backend only answers browsers on <Code>FRONTEND_URL</Code> and the addresses in <Code>ALLOWED_ORIGINS</Code>. If the site loads but every page fails to load data, check that <Code>FRONTEND_URL</Code> matches the address in the browser exactly, including <Code>https://</Code>. A backend running on your own computer also accepts the local website on port 5173.</P>
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
      <P>Set these in <Code>frontend/.env</Code> before running <Code>npm run build</Code> in the top folder of the project, or as GitHub secrets when the deploy workflow builds for you. They are built into the site and are public.</P>
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
          [<><Code>VITE_SUPABASE_URL</Code>, <Code>VITE_SUPABASE_ANON_KEY</Code>, <Code>VITE_API_URL</Code>, <Code>VITE_ADMIN_EMAIL</Code>, <Code>VITE_GOOGLE_CLIENT_ID</Code></>, 'Frontend deploy workflow'],
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
