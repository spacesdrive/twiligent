import React from 'react';
import { DocTitle, H2, P, Code, CodeBlock, Steps, Step, Table } from '../../components';

export default function DeployBackend() {
  return (
    <>
      <DocTitle title="Deploy the backend" lead="Put the Worker on Cloudflare and give it every secret." />
      <Steps>
        <Step title="Install and sign in">
          <P>Run these in the top folder of your copy of the project. One <Code>npm install</Code> there installs the backend and the website together; do not run it inside <Code>backend</Code> or <Code>frontend</Code>.</P>
          <CodeBlock>{`
npm install
cd backend
npx wrangler login
`}</CodeBlock>
          <P>A browser window opens to sign in to Cloudflare. Create a free account if you do not have one. Run the rest of the commands on this page from the <Code>backend</Code> folder.</P>
        </Step>
        <Step title="Deploy once to get your URL">
          <CodeBlock>{'npx wrangler deploy'}</CodeBlock>
          <P>Wrangler builds the Worker from <Code>server.ts</Code>, the entry file named in <Code>wrangler.toml</Code>, and prints the Worker address, for example <Code>https://twiligent.your-subdomain.workers.dev</Code>. This is your <strong>backend URL</strong>.</P>
          <P>If you changed the code, run <Code>npm run typecheck</Code> in the top folder first. Wrangler does not check TypeScript types, so this is the step that catches a type error before it reaches Cloudflare.</P>
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
          <P>Open <Code>{'https://your-backend-url/api/health'}</Code>. It should return <Code>{'{"status":"ok"}'}</Code> with a timestamp.</P>
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
      <P>Create <Code>backend/.dev.vars</Code> with the same names and values, one per line as <Code>NAME=value</Code>, with <Code>{'BACKEND_URL=http://localhost:8787'}</Code> and <Code>{'FRONTEND_URL=http://localhost:5173'}</Code>. Then run <Code>npm run dev</Code> in the top folder of the project to start the backend on port 8787 and the website on port 5173 together, or <Code>npm run dev:backend</Code> for the backend alone. The file is ignored by Git; never commit it.</P>
    </>
  );
}
