import React from 'react';
import { DocTitle, H2, P, A, Code, Callout, Steps, Step, Table } from '../../components';

export default function GettingStarted() {
  return (
    <>
      <DocTitle title="Sign in and first steps" lead="Everything a member does in the first ten minutes. No installation or setup needed." />

      <Callout type="note" title="This guide is for members">
        <p>You are a member if someone gave you a Twiligent link to sign in to. The server, keys and scheduling are already handled by the administrator.</p>
      </Callout>

      <Steps>
        <Step title="Create your account">
          <P>Open your instance's link and choose <strong>Continue with Google</strong>, if your instance offers it. Otherwise choose <strong>Create an account</strong> and use your email and a password of at least 6 characters, then enter the 6-digit code we email you. If you sign in with Google using the same email as an existing account, both open the same account. If you joined with Google and also want a password, set one in <strong>Settings</strong>, <strong>Password</strong>. Forgot it? Choose <strong>Forgot password?</strong> on the sign-in page and enter the 6-digit code we email you with a new password.</P>
        </Step>
        <Step title="Connect an account">
          <P>Open <strong>Accounts</strong> in the sidebar and choose <strong>Add account</strong>. Pick YouTube, Instagram or Reddit. Each one is explained in <A to="/docs/use/connect-accounts">Connect your accounts</A>.</P>
        </Step>
        <Step title="Look around">
          <P>The <strong>Overview</strong> fills in within a minute or two. Use the search box at the top of the sidebar, or press <Code>Ctrl K</Code> (<Code>Cmd K</Code> on a Mac), to jump to any page or account.</P>
        </Step>
        <Step title="Choose a theme">
          <P>Twiligent has a light and a dark theme. Switch with the sun or moon button at the top right, or pick <strong>Match system</strong> in Settings.</P>
        </Step>
      </Steps>

      <H2>Where things are</H2>
      <Table
        head={['Page', 'Use it to']}
        rows={[
          [<strong>Overview</strong>, 'See audience, views, content, comments and likes across every account.'],
          [<strong>Videos, Shorts</strong>, 'Browse and sort every video from your YouTube channels.'],
          [<strong>Instagram content</strong>, 'Browse reels, posts and videos with views, likes and comments.'],
          [<strong>Reddit posts</strong>, 'See every post from your Reddit accounts with karma and comments.'],
          [<strong>Tracked content</strong>, 'Follow specific Reddit posts and YouTube videos by link.'],
          [<strong>Publish</strong>, 'Post or schedule to Instagram.'],
          [<strong>Accounts</strong>, 'Add, refresh and remove connected accounts.'],
          [<strong>Settings</strong>, 'Theme, server status and setup guides.'],
        ]}
      />
    </>
  );
}
