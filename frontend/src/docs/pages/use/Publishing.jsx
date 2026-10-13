import React from 'react';
import { DocTitle, H2, P, UL, Callout, Steps, Step, Table } from '../../components';
import AdminLink from './AdminLink';

export default function Publishing() {
  return (
    <>
      <DocTitle title="Publish and schedule" lead="Post photos, Reels and Stories to Instagram now or later." />

      <H2>Publish a single post</H2>
      <Steps>
        <Step title="Choose the type and file">
          <P>Open <strong>Publish</strong>, pick <strong>Photo</strong>, <strong>Reel</strong> or <strong>Story</strong>, then choose the file. Photos must be JPEG; Reels must be MP4 or MOV in 9:16; Stories accept either.</P>
        </Step>
        <Step title="Write the caption and settings">
          <P>Write the caption (up to 2,200 characters). In the panel on the right, pick the account and optionally add alt text, collaborators, tagged people, a location, and for Reels a cover image and audio name.</P>
        </Step>
        <Step title="Publish now or schedule">
          <P>Under <strong>When</strong>, keep <strong>Publish now</strong>, or pick <strong>Schedule</strong> and set a date and time. Then choose <strong>Publish now</strong> or <strong>Schedule post</strong>.</P>
        </Step>
      </Steps>

      <H2>What happens after you schedule</H2>
      <P>The file uploads straight away. The server publishes the post within 15 minutes after the time you picked, even when your browser is closed. There is nothing for a member to set up.</P>
      <Table
        head={['Status', 'Meaning']}
        rows={[
          [<strong>Pending</strong>, 'Waiting for its time. You can edit the caption and time, or delete it.'],
          [<strong>Publishing</strong>, 'The server is publishing it right now.'],
          [<strong>Published</strong>, 'Live on Instagram.'],
          [<strong>Failed</strong>, 'Instagram rejected it. The Error column says why.'],
        ]}
      />
      <Callout type="warning" title="Pending for more than 30 minutes past its time?">
        <p>The scheduler on the server is not running. Email the administrator at <AdminLink subject="Scheduled posts are not publishing on Twiligent" /> with the time of the post. Publish shows the same warning automatically.</p>
      </Callout>

      <H2>Bulk upload</H2>
      <P>Choose <strong>Bulk upload</strong> to add many files at once. Give each file its own caption or apply one caption to all, then either publish them one after another or <strong>spread them out</strong> from a start time at an interval such as once a day.</P>

      <H2>Limits</H2>
      <UL>
        <li>Instagram allows 100 posts per account in any 24 hours.</li>
        <li>Photos up to 8MB; videos up to 300MB and 15 minutes; Stories up to 60 seconds.</li>
        <li>Publishing needs Cloudinary set up by the administrator. If it is missing, Publish says so.</li>
      </UL>
    </>
  );
}
