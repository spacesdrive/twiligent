import React from 'react';
import { DocTitle, P, Code, Callout, CodeBlock, Steps, Step } from '../../components';

export default function DeployFrontend() {
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
