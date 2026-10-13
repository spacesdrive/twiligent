import React from 'react';
import { DocTitle, P, A, Code, Callout, Steps, Step } from '../../components';

export default function GoogleSignIn() {
  return (
    <>
      <DocTitle title="Sign in with Google (optional)" lead="Let members sign in with their Google account, with your name and logo on Google's sign-in screen." />

      <Callout type="note" title="How it works">
        <p>Twiligent shows Google's own sign-in button. Google returns a signed ID token to the browser, and Supabase verifies it directly. Nothing redirects through your Supabase address, so every domain Google sees is one you own, which is what lets Google approve your logo.</p>
      </Callout>

      <Steps>
        <Step title="Serve Twiligent from your own domain">
          <P>Google only verifies domains you prove you own in <A href="https://search.google.com/search-console">Search Console</A>. Addresses like <Code>twiligent.pages.dev</Code> cannot be verified, so add a custom domain such as <Code>twiligent.example.com</Code> to your Cloudflare Pages project under <strong>Custom domains</strong>, and update <Code>FRONTEND_URL</Code> on the Worker.</P>
        </Step>
        <Step title="Set up branding">
          <P>In <A href="https://console.cloud.google.com/auth/branding">Google Auth Platform, Branding</A>, enter the app name, support email and a 120 by 120 pixel logo. Set the home page and privacy policy links; both must be on your domain, and the home page must link to the privacy policy. Add your domain under <strong>Authorized domains</strong>. One entry covers all its subdomains.</P>
        </Step>
        <Step title="Choose the audience and scopes">
          <P>Under <strong>Audience</strong>, pick <strong>External</strong> and publish the app to production. Under <strong>Data access</strong>, add only <Code>openid</Code>, <Code>userinfo.email</Code> and <Code>userinfo.profile</Code>. These are not sensitive, so there is no user cap and no security review.</P>
        </Step>
        <Step title="Create the client">
          <P>Under <strong>Clients</strong>, create a <strong>Web application</strong>. Add your Twiligent address as an authorized JavaScript origin, plus <Code>http://localhost:5173</Code> for development. No redirect URI is needed. Copy the client ID.</P>
        </Step>
        <Step title="Turn on Google in Supabase">
          <P>In Supabase, open <strong>Authentication</strong>, <strong>Sign In / Providers</strong>, <strong>Google</strong>. Enable it and paste the client ID into <strong>Client IDs</strong>. Leave <strong>Skip nonce checks</strong> off; Twiligent sends a nonce with every sign-in.</P>
        </Step>
        <Step title="Add the client ID to the frontend">
          <P>Set <Code>VITE_GOOGLE_CLIENT_ID</Code> in <Code>frontend/.env</Code> and as a GitHub secret, then redeploy. The <strong>Continue with Google</strong> button appears on the sign-in page.</P>
        </Step>
        <Step title="Submit for brand verification">
          <P>Open <strong>Verification Center</strong> and submit. Google reviews brands with basic scopes in a few business days. Until then sign-in works, but Google shows your domain instead of your name and logo.</P>
        </Step>
      </Steps>
    </>
  );
}
