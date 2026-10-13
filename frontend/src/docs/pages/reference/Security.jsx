import React from 'react';
import { DocTitle, H2, P, UL, A, Table } from '../../components';

export default function Security() {
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
