import React from 'react';
import { DocTitle, H2, P, A, Table } from '../../components';
import AdminLink from './AdminLink';

export default function Troubleshooting() {
  return (
    <>
      <DocTitle title="Troubleshooting" lead="Common problems for members, and who to contact when you are stuck." />
      <Table
        head={['Problem', 'What to do']}
        rows={[
          ['Instagram shows an error or a blank page when connecting', <>Your account is probably not a tester yet. See <A to="/docs/use/connect-accounts">Get tester access first</A>.</>],
          ['"This Instagram account is already connected"', 'It is already in your Accounts list. Refresh it there instead.'],
          ['Instagram connection says the account type is wrong', 'Switch the Instagram account to Business or Creator, then connect again.'],
          ['Reddit says the session cookie is invalid or expired', 'Remove the Reddit account and add it again with a fresh reddit_session cookie.'],
          ['A scheduled post stays Pending', <>Email the administrator at <AdminLink subject="Scheduled posts are not publishing on Twiligent" />.</>],
          ['A scheduled post Failed', 'Read the Error column. Common causes are a file Instagram does not accept or an account whose access was removed.'],
          ['Publish says Cloudinary is not set up', 'Only the administrator can fix this. Let them know.'],
          ['Analytics will not load', 'Use Refresh on the account. If it keeps failing, contact the administrator; the platform key may be missing.'],
        ]}
      />
      <H2>Contact the administrator</H2>
      <P>For anything only the person running this instance can fix, email <AdminLink subject="Help with Twiligent" />. Include what you were doing, the account involved and the exact message you saw.</P>
    </>
  );
}
