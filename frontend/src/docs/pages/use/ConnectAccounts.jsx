import React from 'react';
import { INSTAGRAM_TESTER_INVITES_URL } from '@/lib/contact';
import { DocTitle, H2, H3, P, OL, A, Code, Callout, Steps, Step } from '../../components';
import AdminLink from './AdminLink';

export default function ConnectAccounts() {
  return (
    <>
      <DocTitle title="Connect your accounts" lead="How to add YouTube channels, Instagram professional accounts and Reddit profiles." />

      <H2>YouTube</H2>
      <P>Open <strong>Accounts</strong>, choose <strong>Add account</strong>, then <strong>YouTube channel</strong>. Paste a channel link, an <Code>@handle</Code> or a channel ID starting with <Code>UC</Code>, choose <strong>Find</strong> to check it, then <strong>Add channel</strong>. Any public channel works; you do not need to own it.</P>

      <H2>Instagram</H2>
      <P>Instagram only connects <strong>Business</strong> or <strong>Creator</strong> accounts. You can switch a personal account to a professional one for free in the Instagram app under Settings, Account type and tools.</P>

      <H3>Get tester access first</H3>
      <P>Most instances run their Meta app in development mode. In that mode Instagram only lets accounts added as <strong>testers</strong> sign in. Without tester access, Instagram shows an error or a blank page.</P>
      <Steps>
        <Step title="Ask the administrator">
          <P>Email <AdminLink subject="Instagram tester request for Twiligent" /> with your Instagram username. The administrator adds you in the Meta app dashboard.</P>
        </Step>
        <Step title="Accept the invite">
          <P>Sign in to Instagram on the web and open <A href={INSTAGRAM_TESTER_INVITES_URL}>Apps and websites</A>, then the <strong>Tester invites</strong> tab, and accept the invite. In the Instagram app it is under Settings and privacy, Website permissions, Apps and websites, Tester invites.</P>
        </Step>
        <Step title="Connect">
          <P>In Twiligent, open <strong>Accounts</strong>, choose <strong>Add account</strong>, then <strong>Instagram account</strong>, then <strong>Continue to Instagram</strong>. Approve every requested permission. Instagram sends you back and the account appears in the list.</P>
        </Step>
      </Steps>
      <Callout type="note" title="Access lasts 60 days and renews itself">
        <p>Instagram access tokens last 60 days. Twiligent renews them automatically every night, so you only reconnect if you remove access in Instagram or change your password.</p>
      </Callout>

      <H2>Reddit</H2>
      <P>Reddit blocks most requests from servers, so Twiligent uses your browser session cookie to read your profile and posts.</P>
      <OL>
        <li>Sign in to reddit.com in your browser.</li>
        <li>Open the browser's developer tools (F12), then <strong>Application</strong>, then <strong>Cookies</strong>, then <Code>https://www.reddit.com</Code>.</li>
        <li>Find the cookie named <Code>reddit_session</Code> and copy its value.</li>
        <li>In Twiligent choose <strong>Add account</strong>, <strong>Reddit account</strong>, enter your username and paste the cookie.</li>
      </OL>
      <Callout type="warning" title="Treat the cookie like a password">
        <p>It signs in as you. Twiligent stores it on the server and never shows it again. If Reddit signs you out, the cookie stops working: remove the account and add it again with a fresh cookie.</p>
      </Callout>
    </>
  );
}
