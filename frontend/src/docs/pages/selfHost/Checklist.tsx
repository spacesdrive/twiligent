import React from 'react';
import { DocTitle, H2, P, A, Code, Table } from '../../components';

export default function Checklist() {
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
