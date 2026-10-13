import React from 'react';
import { DocTitle, H2, P, A, Code, Callout, CodeBlock, Steps, Step, Table } from '../../components';

export default function Instagram() {
  return (
    <>
      <DocTitle title="Instagram app" lead="A Meta app lets members sign in with Instagram so Twiligent can read insights and publish." />

      <Callout type="note" title="Before you start">
        <p>You need a Meta developer account (free, at <A href="https://developers.facebook.com">developers.facebook.com</A>) and an Instagram Business or Creator account to test with. You need your backend URL for the redirect; if you have not deployed yet, use <Code>http://localhost:8787</Code> now and add the real one later.</p>
      </Callout>

      <Steps>
        <Step title="Create the app">
          <P>In <A href="https://developers.facebook.com/apps">My Apps</A> choose <strong>Create app</strong>. When asked for a use case, pick <strong>Other</strong>, then app type <strong>Business</strong>. Give it a name your members will recognise; Instagram shows it on the sign-in screen.</P>
        </Step>
        <Step title="Add Instagram">
          <P>On the app dashboard, add the <strong>Instagram</strong> product and choose <strong>API setup with Instagram business login</strong>. Do not use the Facebook login variant.</P>
        </Step>
        <Step title="Copy the Instagram app ID and secret">
          <P>On the Instagram API setup page, copy the <strong>Instagram app ID</strong> and <strong>Instagram app secret</strong>. These are <Code>INSTAGRAM_APP_ID</Code> and <Code>INSTAGRAM_APP_SECRET</Code>.</P>
          <Callout type="warning" title="Use the Instagram values, not the Facebook ones">
            <p>The app dashboard also shows a Facebook App ID under Settings, Basic. That one does not work here and produces an "Invalid platform app" error.</p>
          </Callout>
        </Step>
        <Step title="Set the redirect URL">
          <P>In <strong>Set up Instagram business login</strong>, open <strong>Business login settings</strong> and add this OAuth redirect URI, replacing the address with your backend URL:</P>
          <CodeBlock title="Redirect URI">{'https://twiligent.your-subdomain.workers.dev/api/auth/instagram/callback'}</CodeBlock>
          <P>For local development, add <Code>{'http://localhost:8787/api/auth/instagram/callback'}</Code> as well. It must match <Code>BACKEND_URL</Code> exactly, with no trailing slash.</P>
        </Step>
        <Step title="Add testers">
          <P>While the app is in development mode, only Instagram accounts with a tester role can connect. Open <strong>App roles</strong>, then <strong>Roles</strong>, choose <strong>Add people</strong>, pick <strong>Instagram Tester</strong> and enter the Instagram username.</P>
          <P>The person then accepts the invite in Instagram under <A href="https://www.instagram.com/accounts/manage_access/">Apps and websites</A>, <strong>Tester invites</strong>. Members are told to email you for this; set your address with <Code>VITE_ADMIN_EMAIL</Code>.</P>
        </Step>
      </Steps>

      <H2>Permissions Twiligent asks for</H2>
      <Table
        head={['Permission', 'Why']}
        rows={[
          [<Code>instagram_business_basic</Code>, 'Read the profile, follower count and media list.'],
          [<Code>instagram_business_manage_insights</Code>, 'Read views, reach and other insights.'],
          [<Code>instagram_business_content_publish</Code>, 'Publish photos, Reels and Stories.'],
          [<Code>instagram_business_manage_comments</Code>, 'Read comment counts and comments.'],
          [<Code>instagram_business_manage_messages</Code>, 'Requested with the business login set; not used to send messages.'],
        ]}
      />

      <H2>Going live for everyone</H2>
      <P>To let any Instagram account connect without a tester role, submit the app for <strong>App Review</strong> with the permissions above, then switch it to <strong>Live</strong>. Meta asks for a privacy policy URL, a screencast of each permission in use, and business verification. For a private team, tester roles are usually simpler.</P>
    </>
  );
}
