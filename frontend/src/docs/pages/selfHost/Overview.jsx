import React from 'react';
import { DocTitle, H2, P, UL, OL, A, Code, Callout, Table, Badge } from '../../components';

export default function Overview() {
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
