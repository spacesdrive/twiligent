import React from 'react';
import { DocTitle, H2, H3, P, UL, Code, Table, Badge } from '../../components';

export default function Scheduling() {
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
