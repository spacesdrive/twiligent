import React from 'react';
import { DocTitle, H2, H3, P, UL, A, Code, Callout, CodeBlock, Steps, Step, Table, Badge } from '../../components';
import { SCHEMA_SQL, UPGRADE_SQL } from './selfHostSql';

export default function Supabase() {
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
          <P>Open <strong>Project Settings</strong>, then <strong>Data API</strong> (or <strong>Integrations</strong>, <strong>Data API</strong>). Copy the <strong>Project URL</strong>, which looks like <Code>{'https://abcdefgh.supabase.co'}</Code>. It is used as <Code>SUPABASE_URL</Code> and <Code>VITE_SUPABASE_URL</Code>.</P>
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
      <CodeBlock title="upgrade.sql">{UPGRADE_SQL}</CodeBlock>

      <H3>Why row level security with no policies</H3>
      <P>The backend uses the secret key, which bypasses row level security, and limits every query to the signed-in user itself. Turning security on with no policies means the public publishable key, which ships in the frontend, cannot read or change any table directly. Without it, anyone holding that public key could read other members' data.</P>
    </>
  );
}
