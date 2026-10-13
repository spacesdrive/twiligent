import React from 'react';
import { DocTitle, H2, H3, P, UL, OL, A, Code, Callout, CodeBlock, Steps, Step, Table, Badge } from '../components';

export const SCHEMA_SQL = `
create table accounts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  data jsonb not null
);
create index accounts_user_id_idx on accounts(user_id);

create table settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb,
  primary key (user_id, key)
);

create table scheduled_posts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null references accounts(id) on delete cascade,
  status text not null default 'pending',
  scheduled_at timestamptz not null,
  data jsonb
);
create index scheduled_posts_due_idx on scheduled_posts(status, scheduled_at);

create table tracked_posts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text references accounts(id) on delete set null,
  url text not null,
  label text not null default '',
  category text not null default '',
  content_type text not null default 'reddit',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data jsonb
);
create index tracked_posts_user_id_idx on tracked_posts(user_id);

alter table accounts enable row level security;
alter table settings enable row level security;
alter table scheduled_posts enable row level security;
alter table tracked_posts enable row level security;
`;

const RLS_SQL = `
alter table accounts enable row level security;
alter table settings enable row level security;
alter table scheduled_posts enable row level security;
alter table tracked_posts enable row level security;
`;

export function Overview() {
  return (
    <>
      <DocTitle title="Self-hosting overview" lead="What you need to run your own Twiligent, what it costs, and the order to set it up in." />

      <Callout type="note" title="Only the administrator follows this section">
        <p>If you signed in to a Twiligent link someone gave you, you do not need any of this. The server, the keys and scheduling are already handled. Read <A to="/docs/use/getting-started">Using Twiligent</A> instead.</p>
      </Callout>

      <H2>How the pieces fit</H2>
      <P>Twiligent has two parts. The <strong>frontend</strong> is the website people sign in to, hosted on Cloudflare Pages. The <strong>backend</strong> is a Cloudflare Worker that talks to YouTube, Instagram and Reddit, stores data in Supabase, and publishes scheduled posts every 15 minutes. All secrets live in the backend; the frontend only holds values that are safe to be public.</P>

      <H2>Accounts you need</H2>
      <Table
        head={['Service', 'Needed for', '', 'Cost']}
        rows={[
          ['Supabase', 'Sign-in and the database', <Badge tone="required">Required</Badge>, 'Free plan is enough'],
          ['Cloudflare', 'Hosting the backend and frontend', <Badge tone="required">Required</Badge>, 'Free plan is enough'],
          ['Google Cloud', 'YouTube analytics', <Badge tone="optional">For YouTube</Badge>, 'Free, 10,000 quota units a day'],
          ['Meta for Developers', 'Connecting Instagram and publishing', <Badge tone="optional">For Instagram</Badge>, 'Free'],
          ['Cloudinary', 'Hosting media before Instagram fetches it', <Badge tone="optional">For publishing</Badge>, 'Free plan is enough'],
          ['Upstash', 'Caching to save API quota and speed pages up', <Badge tone="optional">Optional</Badge>, 'Free plan is enough'],
          ['GitHub', 'Deploy on every push, and a backup scheduler', <Badge tone="optional">Optional</Badge>, 'Free'],
        ]}
      />
      <P>Reddit needs no key. Each member pastes their own Reddit session cookie when they connect an account.</P>

      <H2>Order of setup</H2>
      <OL>
        <li><A to="/docs/self-host/supabase">Supabase</A>: create the project, the tables and turn on row level security.</li>
        <li><A to="/docs/self-host/youtube">YouTube API key</A>, <A to="/docs/self-host/instagram">Instagram app</A>, <A to="/docs/self-host/cloudinary">Cloudinary</A> and optionally <A to="/docs/self-host/redis">Upstash Redis</A>, in any order.</li>
        <li><A to="/docs/self-host/deploy-backend">Deploy the backend</A> and give it every secret.</li>
        <li><A to="/docs/self-host/deploy-frontend">Deploy the frontend</A>.</li>
        <li>Optionally connect <A to="/docs/self-host/github">GitHub</A>, then run through the <A to="/docs/self-host/checklist">launch checklist</A>.</li>
      </OL>
      <P>Keep a private note open while you work. Each page tells you which values to copy, and <A to="/docs/reference/environment">Environment variables</A> lists all of them in one table.</P>

      <H2>What you need on your computer</H2>
      <UL>
        <li>Node.js 20 or newer, and Git.</li>
        <li>A copy of the code: <Code>git clone https://github.com/spacesdrive/twiligent.git</Code></li>
      </UL>
    </>
  );
}

export function Supabase() {
  return (
    <>
      <DocTitle title="Supabase" lead="Supabase handles sign-in and stores every account, scheduled post and tracked item." />

      <Steps>
        <Step title="Create a project">
          <P>Sign in at <A href="https://supabase.com/dashboard">supabase.com/dashboard</A> and choose <strong>New project</strong>. Pick a name, a strong database password and the region closest to you. Wait about two minutes for it to start.</P>
        </Step>
        <Step title="Create the tables">
          <P>Open <strong>SQL Editor</strong>, choose <strong>New query</strong>, paste the SQL below and choose <strong>Run</strong>. It creates the four tables Twiligent uses and turns on row level security for each.</P>
          <CodeBlock title="schema.sql">{SCHEMA_SQL}</CodeBlock>
        </Step>
        <Step title="Configure sign-in">
          <P>Open <strong>Authentication</strong>, then <strong>Sign In / Providers</strong>, then <strong>Email</strong>.</P>
          <UL>
            <li>Turn off <strong>Confirm email</strong> unless you have set up an email provider. Otherwise new members never receive the confirmation and cannot sign in.</li>
            <li>To keep the instance private, turn off <strong>Allow new users to sign up</strong> after you and your team have created accounts. You can also add members yourself under <strong>Authentication</strong>, <strong>Users</strong>, <strong>Add user</strong>.</li>
          </UL>
        </Step>
        <Step title="Copy the project URL">
          <P>Open <strong>Project Settings</strong>, then <strong>Data API</strong> (or <strong>Integrations</strong>, <strong>Data API</strong>). Copy the <strong>Project URL</strong>, which looks like <Code>https://abcdefgh.supabase.co</Code>. It is used as <Code>SUPABASE_URL</Code> and <Code>VITE_SUPABASE_URL</Code>.</P>
        </Step>
        <Step title="Copy the two keys">
          <P>Open <strong>Project Settings</strong>, then <strong>API Keys</strong>. Supabase shows either the new key format or the legacy one; both work.</P>
          <Table
            head={['Key', 'Looks like', 'Used as', 'Safety']}
            rows={[
              ['Publishable key (legacy: anon)', <Code>sb_publishable_...</Code>, <><Code>SUPABASE_ANON_KEY</Code> and <Code>VITE_SUPABASE_ANON_KEY</Code></>, <Badge>Safe in the browser</Badge>],
              ['Secret key (legacy: service_role)', <Code>sb_secret_...</Code>, <Code>SUPABASE_SERVICE_KEY</Code>, <Badge tone="secret">Server only</Badge>],
            ]}
          />
          <Callout type="danger" title="Never put the secret key in the frontend">
            <p>The secret key can read and change every row in the database. It belongs only in the Worker's secrets and, if you use the backup scheduler, in GitHub Actions secrets.</p>
          </Callout>
        </Step>
      </Steps>

      <H2>Already have the tables?</H2>
      <P>If you created the tables from an older README, make sure <Code>tracked_posts</Code> exists and has the <Code>content_type</Code> column, and that row level security is on. This is safe to run more than once:</P>
      <CodeBlock title="upgrade.sql">{`
alter table tracked_posts add column if not exists content_type text not null default 'reddit';
${RLS_SQL.trim()}
`}</CodeBlock>

      <H3>Why row level security with no policies</H3>
      <P>The backend uses the secret key, which bypasses row level security, and limits every query to the signed-in user itself. Turning security on with no policies means the public publishable key, which ships in the frontend, cannot read or change any table directly. Without it, anyone holding that public key could read other members' data.</P>
    </>
  );
}

export function GoogleSignIn() {
  return (
    <>
      <DocTitle title="Sign in with Google (optional)" lead="Let members sign in with their Google account, with your name and logo on Google's sign-in screen." />

      <Callout type="note" title="How it works">
        <p>Twiligent shows Google's own sign-in button. Google returns a signed ID token to the browser, and Supabase verifies it directly. Nothing redirects through your Supabase address, so every domain Google sees is one you own, which is what lets Google approve your logo.</p>
      </Callout>

      <Steps>
        <Step title="Serve Twiligent from your own domain">
          <P>Google only verifies domains you prove you own in <A href="https://search.google.com/search-console">Search Console</A>. Addresses like <Code>twiligent.pages.dev</Code> cannot be verified, so add a custom domain such as <Code>twiligent.example.com</Code> to your Cloudflare Pages project under <strong>Custom domains</strong>, and update <Code>FRONTEND_URL</Code> on the Worker.</P>
        </Step>
        <Step title="Set up branding">
          <P>In <A href="https://console.cloud.google.com/auth/branding">Google Auth Platform, Branding</A>, enter the app name, support email and a 120 by 120 pixel logo. Set the home page and privacy policy links; both must be on your domain, and the home page must link to the privacy policy. Add your domain under <strong>Authorized domains</strong>. One entry covers all its subdomains.</P>
        </Step>
        <Step title="Choose the audience and scopes">
          <P>Under <strong>Audience</strong>, pick <strong>External</strong> and publish the app to production. Under <strong>Data access</strong>, add only <Code>openid</Code>, <Code>userinfo.email</Code> and <Code>userinfo.profile</Code>. These are not sensitive, so there is no user cap and no security review.</P>
        </Step>
        <Step title="Create the client">
          <P>Under <strong>Clients</strong>, create a <strong>Web application</strong>. Add your Twiligent address as an authorized JavaScript origin, plus <Code>http://localhost:5173</Code> for development. No redirect URI is needed. Copy the client ID.</P>
        </Step>
        <Step title="Turn on Google in Supabase">
          <P>In Supabase, open <strong>Authentication</strong>, <strong>Sign In / Providers</strong>, <strong>Google</strong>. Enable it and paste the client ID into <strong>Client IDs</strong>. Leave <strong>Skip nonce checks</strong> off; Twiligent sends a nonce with every sign-in.</P>
        </Step>
        <Step title="Add the client ID to the frontend">
          <P>Set <Code>VITE_GOOGLE_CLIENT_ID</Code> in <Code>frontend/.env</Code> and as a GitHub secret, then redeploy. The <strong>Continue with Google</strong> button appears on the sign-in page.</P>
        </Step>
        <Step title="Submit for brand verification">
          <P>Open <strong>Verification Center</strong> and submit. Google reviews brands with basic scopes in a few business days. Until then sign-in works, but Google shows your domain instead of your name and logo.</P>
        </Step>
      </Steps>
    </>
  );
}

export function YouTube() {
  return (
    <>
      <DocTitle title="YouTube API key" lead="One shared key lets every member add any public channel." />
      <Steps>
        <Step title="Create a Google Cloud project">
          <P>Open <A href="https://console.cloud.google.com/projectcreate">Google Cloud Console</A> and create a project, for example <Code>twiligent</Code>.</P>
        </Step>
        <Step title="Enable the YouTube Data API">
          <P>Open <A href="https://console.cloud.google.com/apis/library/youtube.googleapis.com">YouTube Data API v3</A> in the API Library, make sure your new project is selected, and choose <strong>Enable</strong>.</P>
        </Step>
        <Step title="Create the key">
          <P>Open <strong>APIs and Services</strong>, then <A href="https://console.cloud.google.com/apis/credentials">Credentials</A>. Choose <strong>Create credentials</strong>, then <strong>API key</strong>. Copy the key; it starts with <Code>AIza</Code>. This is <Code>YOUTUBE_API_KEY</Code>.</P>
        </Step>
        <Step title="Restrict the key">
          <P>Edit the key. Under <strong>API restrictions</strong> choose <strong>Restrict key</strong> and select only YouTube Data API v3. Leave <strong>Application restrictions</strong> at None, because the key is used by the Worker, not a browser.</P>
        </Step>
      </Steps>
      <Callout type="tip" title="Quota">
        <p>The free quota is 10,000 units a day, shared by all members. Most reads cost 1 unit. Adding <A to="/docs/self-host/redis">Upstash Redis</A> caches results and makes the quota go much further.</p>
      </Callout>
    </>
  );
}

export function Instagram() {
  return (
    <>
      <DocTitle title="Instagram app" lead="A Meta app lets members sign in with Instagram so Twiligent can read insights and publish." />

      <Callout type="note" title="Before you start">
        <p>You need a Meta developer account (free, at <A href="https://developers.facebook.com">developers.facebook.com</A>) and an Instagram Business or Creator account to test with. You need your backend URL for the redirect; if you have not deployed yet, use <Code>http://localhost:8787</Code> now and add the real one later.</p>
      </Callout>

      <Steps>
        <Step title="Create the app">
          <P>In <A href="https://developers.facebook.com/apps">My Apps</A> choose <strong>Create app</strong>. When asked for a use case, pick <strong>Other</strong>, then app type <strong>Business</strong>. Give it a name your members will recognise; Instagram shows it on the sign-in screen.</P>
        </Step>
        <Step title="Add Instagram">
          <P>On the app dashboard, add the <strong>Instagram</strong> product and choose <strong>API setup with Instagram business login</strong>. Do not use the Facebook login variant.</P>
        </Step>
        <Step title="Copy the Instagram app ID and secret">
          <P>On the Instagram API setup page, copy the <strong>Instagram app ID</strong> and <strong>Instagram app secret</strong>. These are <Code>INSTAGRAM_APP_ID</Code> and <Code>INSTAGRAM_APP_SECRET</Code>.</P>
          <Callout type="warning" title="Use the Instagram values, not the Facebook ones">
            <p>The app dashboard also shows a Facebook App ID under Settings, Basic. That one does not work here and produces an "Invalid platform app" error.</p>
          </Callout>
        </Step>
        <Step title="Set the redirect URL">
          <P>In <strong>Set up Instagram business login</strong>, open <strong>Business login settings</strong> and add this OAuth redirect URI, replacing the address with your backend URL:</P>
          <CodeBlock title="Redirect URI">{'https://twiligent.your-subdomain.workers.dev/api/auth/instagram/callback'}</CodeBlock>
          <P>For local development, add <Code>http://localhost:8787/api/auth/instagram/callback</Code> as well. It must match <Code>BACKEND_URL</Code> exactly, with no trailing slash.</P>
        </Step>
        <Step title="Add testers">
          <P>While the app is in development mode, only Instagram accounts with a tester role can connect. Open <strong>App roles</strong>, then <strong>Roles</strong>, choose <strong>Add people</strong>, pick <strong>Instagram Tester</strong> and enter the Instagram username.</P>
          <P>The person then accepts the invite in Instagram under <A href="https://www.instagram.com/accounts/manage_access/">Apps and websites</A>, <strong>Tester invites</strong>. Members are told to email you for this; set your address with <Code>VITE_ADMIN_EMAIL</Code>.</P>
        </Step>
      </Steps>

      <H2>Permissions Twiligent asks for</H2>
      <Table
        head={['Permission', 'Why']}
        rows={[
          [<Code>instagram_business_basic</Code>, 'Read the profile, follower count and media list.'],
          [<Code>instagram_business_manage_insights</Code>, 'Read views, reach and other insights.'],
          [<Code>instagram_business_content_publish</Code>, 'Publish photos, Reels and Stories.'],
          [<Code>instagram_business_manage_comments</Code>, 'Read comment counts and comments.'],
          [<Code>instagram_business_manage_messages</Code>, 'Requested with the business login set; not used to send messages.'],
        ]}
      />

      <H2>Going live for everyone</H2>
      <P>To let any Instagram account connect without a tester role, submit the app for <strong>App Review</strong> with the permissions above, then switch it to <strong>Live</strong>. Meta asks for a privacy policy URL, a screencast of each permission in use, and business verification. For a private team, tester roles are usually simpler.</P>
    </>
  );
}

export function Cloudinary() {
  return (
    <>
      <DocTitle title="Cloudinary" lead="Instagram publishes from a public URL, so files are uploaded to Cloudinary first." />
      <Steps>
        <Step title="Create an account">
          <P>Sign up at <A href="https://cloudinary.com/users/register_free">cloudinary.com</A>. On the dashboard, copy the <strong>Cloud name</strong>. This is <Code>CLOUDINARY_CLOUD_NAME</Code>.</P>
        </Step>
        <Step title="Create an unsigned upload preset">
          <P>Open <strong>Settings</strong>, then <strong>Upload</strong>, then <strong>Upload presets</strong>, and choose <strong>Add upload preset</strong>. Set <strong>Signing mode</strong> to <strong>Unsigned</strong> and save. Copy the preset name. This is <Code>CLOUDINARY_UPLOAD_PRESET</Code>.</P>
        </Step>
      </Steps>
      <Callout type="note" title="Why unsigned">
        <p>Browsers upload large videos straight to Cloudinary so they never pass through the Worker. Unsigned presets allow this without exposing your Cloudinary API secret. Both values are only handed to signed-in members.</p>
      </Callout>
      <P>Without Cloudinary, everything works except publishing and uploading screenshots for tracked Reddit posts.</P>
    </>
  );
}

export function Redis() {
  return (
    <>
      <DocTitle title="Upstash Redis (optional)" lead="A cache that saves YouTube and Instagram quota and makes pages load faster." />
      <P>Twiligent works fully without Redis. Every cache read falls back to a live API call, and Redis errors are ignored. Add it when you have several members or many YouTube channels.</P>
      <Steps>
        <Step title="Create a database">
          <P>Sign in at <A href="https://console.upstash.com">console.upstash.com</A>, choose <strong>Create database</strong>, and pick the region closest to your Supabase project.</P>
        </Step>
        <Step title="Copy the REST values">
          <P>On the database page, in the <strong>REST API</strong> section, copy <strong>UPSTASH_REDIS_REST_URL</strong> and <strong>UPSTASH_REDIS_REST_TOKEN</strong>. They are used under exactly those names.</P>
        </Step>
      </Steps>
    </>
  );
}

export function DeployBackend() {
  return (
    <>
      <DocTitle title="Deploy the backend" lead="Put the Worker on Cloudflare and give it every secret." />
      <Steps>
        <Step title="Install and sign in">
          <CodeBlock>{`
cd backend
npm install
npx wrangler login
`}</CodeBlock>
          <P>A browser window opens to sign in to Cloudflare. Create a free account if you do not have one.</P>
        </Step>
        <Step title="Deploy once to get your URL">
          <CodeBlock>{'npx wrangler deploy'}</CodeBlock>
          <P>Wrangler prints the Worker address, for example <Code>https://twiligent.your-subdomain.workers.dev</Code>. This is your <strong>backend URL</strong>.</P>
        </Step>
        <Step title="Add the secrets">
          <P>Run each command and paste the value when asked. Values are encrypted by Cloudflare and never shown again.</P>
          <CodeBlock>{`
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_KEY
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put YOUTUBE_API_KEY
npx wrangler secret put INSTAGRAM_APP_ID
npx wrangler secret put INSTAGRAM_APP_SECRET
npx wrangler secret put CLOUDINARY_CLOUD_NAME
npx wrangler secret put CLOUDINARY_UPLOAD_PRESET
npx wrangler secret put BACKEND_URL
npx wrangler secret put FRONTEND_URL
`}</CodeBlock>
          <P>If you use Redis, also add <Code>UPSTASH_REDIS_REST_URL</Code> and <Code>UPSTASH_REDIS_REST_TOKEN</Code>. Skip any platform you do not use. <Code>FRONTEND_URL</Code> is the address of the site from the next page; you can set it after deploying the frontend.</P>
        </Step>
        <Step title="Check it is running">
          <P>Open <Code>https://your-backend-url/api/health</Code>. It should return <Code>{'{"status":"ok"}'}</Code> with a timestamp.</P>
        </Step>
      </Steps>

      <H2>Scheduled jobs</H2>
      <P>Deploying also registers two cron triggers from <Code>wrangler.toml</Code>. You do not need to set anything up.</P>
      <Table
        head={['Schedule', 'What it does']}
        rows={[
          [<Code>*/15 * * * *</Code>, 'Publishes scheduled Instagram posts that are due.'],
          [<Code>0 0 * * *</Code>, 'Renews Instagram access tokens before they expire.'],
        ]}
      />

      <H2>Run it locally</H2>
      <P>Create <Code>backend/.dev.vars</Code> with the same names and values, one per line as <Code>NAME=value</Code>, with <Code>BACKEND_URL=http://localhost:8787</Code> and <Code>FRONTEND_URL=http://localhost:5173</Code>. Then run <Code>npx wrangler dev</Code>. The file is ignored by Git; never commit it.</P>
    </>
  );
}

export function DeployFrontend() {
  return (
    <>
      <DocTitle title="Deploy the frontend" lead="Build the website and host it on Cloudflare Pages." />
      <Callout type="note" title="These values are public">
        <p>Anything starting with <Code>VITE_</Code> is built into the website and visible to every visitor. Only use the publishable Supabase key here, never the secret one.</p>
      </Callout>
      <Steps>
        <Step title="Create frontend/.env">
          <CodeBlock title="frontend/.env">{`
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
VITE_API_URL=https://twiligent.your-subdomain.workers.dev/api
VITE_ADMIN_EMAIL=you@example.com
`}</CodeBlock>
          <P><Code>VITE_API_URL</Code> is your backend URL followed by <Code>/api</Code>. Leaving off <Code>/api</Code> is the most common setup mistake.</P>
        </Step>
        <Step title="Build and deploy">
          <CodeBlock>{`
cd frontend
npm install
npm run build
npx wrangler pages deploy dist --project-name=twiligent
`}</CodeBlock>
          <P>The first time, Wrangler creates the Pages project and prints the address, for example <Code>https://twiligent.pages.dev</Code>.</P>
        </Step>
        <Step title="Point the backend at it">
          <P>Set <Code>FRONTEND_URL</Code> on the Worker to that address, so Instagram sign-in returns members to the right place:</P>
          <CodeBlock>{`
cd ../backend
npx wrangler secret put FRONTEND_URL
`}</CodeBlock>
        </Step>
      </Steps>
      <P>Open the site, create your account and connect something. For a custom domain, add it under the Pages project's <strong>Custom domains</strong> tab and update <Code>FRONTEND_URL</Code> to match.</P>
    </>
  );
}

export function GitHub() {
  return (
    <>
      <DocTitle title="GitHub automation" lead="Deploy on every push, and keep a second scheduler running in case the Worker misses a run." />
      <P>Both parts are optional. Fork <A href="https://github.com/spacesdrive/twiligent">spacesdrive/twiligent</A> to your own GitHub account first. Add secrets in your fork under <strong>Settings</strong>, <strong>Secrets and variables</strong>, <strong>Actions</strong>, <strong>New repository secret</strong>.</P>

      <H2>Deploy on push</H2>
      <P>The workflows <Code>deploy-backend.yml</Code> and <Code>deploy-frontend.yml</Code> deploy whenever <Code>backend/</Code> or <Code>frontend/</Code> changes on <Code>main</Code>.</P>
      <Table
        head={['Secret', 'Where to get it']}
        rows={[
          [<Code>CLOUDFLARE_API_TOKEN</Code>, <>Cloudflare dashboard, <strong>My Profile</strong>, <strong>API Tokens</strong>, <strong>Create Token</strong>, template <strong>Edit Cloudflare Workers</strong>. Add the <strong>Cloudflare Pages: Edit</strong> permission.</>],
          [<Code>CLOUDFLARE_ACCOUNT_ID</Code>, 'Cloudflare dashboard, Workers and Pages overview, shown on the right as Account ID.'],
          [<Code>VITE_SUPABASE_URL</Code>, 'Same value as in frontend/.env.'],
          [<Code>VITE_SUPABASE_ANON_KEY</Code>, 'Same value as in frontend/.env.'],
          [<Code>VITE_API_URL</Code>, 'Same value as in frontend/.env, ending in /api.'],
          [<Code>VITE_ADMIN_EMAIL</Code>, 'Optional. Your contact address.'],
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

export function Checklist() {
  return (
    <>
      <DocTitle title="Launch checklist" lead="Confirm everything works before you invite anyone." />
      <Table
        head={['Check', 'How']}
        rows={[
          ['Backend is up', <><Code>/api/health</Code> on your backend URL returns status ok.</>],
          ['Sign-in works', 'Create an account on the site and sign in.'],
          ['Keys are detected', 'Settings, Server API keys shows YouTube, Instagram and Cloudinary as set.'],
          ['YouTube works', 'Add any public channel in Accounts.'],
          ['Instagram works', 'Connect your own tester account in Accounts.'],
          ['Publishing works', 'Schedule a post 5 minutes ahead. It shows Published within 20 minutes.'],
          ['Data is private', 'Row level security is on for all four tables (Supabase, Table Editor shows no "RLS disabled" warning).'],
          ['Signups match your plan', 'Turn off new signups in Supabase if the instance is private.'],
          ['Members can reach you', 'VITE_ADMIN_EMAIL is your address.'],
        ]}
      />
      <H2>Tell your members</H2>
      <P>Send them the site address and a link to <A to="/docs/use/getting-started">Using Twiligent</A>. They need nothing else. If they will connect Instagram, collect their usernames and add them as testers first.</P>
    </>
  );
}
