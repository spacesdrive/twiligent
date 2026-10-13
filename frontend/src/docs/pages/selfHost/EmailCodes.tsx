import React from 'react';
import { DocTitle, P, A, Code, CodeBlock, Callout, Steps, Step } from '../../components';

export default function EmailCodes() {
  return (
    <>
      <DocTitle title="Email verification codes (optional)" lead="Confirm each new email account with a 6-digit code, sent free through Resend, with a daily cap." />

      <Callout type="note" title="How it works">
        <p>Supabase Auth hands every sign-up, password reset and sign-in email to your backend instead of sending it. The backend checks that the request came from your Supabase project, counts the day&apos;s emails, and sends the code through Resend. Resend&apos;s free plan sends 100 emails a day, so the backend stops at 100. After that, the sign-up page tells people to sign in with Google instead, and email codes start again at midnight UTC.</p>
      </Callout>

      <Steps>
        <Step title="Create a Resend account and verify your domain">
          <P>Sign up at <A href="https://resend.com">resend.com</A>. Under <strong>Domains</strong>, add the domain you will send from, such as <Code>example.com</Code>, and add the DNS records Resend shows. Emails from an unverified domain are refused. The free plan allows one domain.</P>
        </Step>
        <Step title="Create an API key">
          <P>Under <strong>API Keys</strong>, create a key with <strong>Sending access</strong> for that domain. Copy it; Resend shows it once.</P>
        </Step>
        <Step title="Add the email secrets to the backend">
          <P>In <Code>backend/</Code>, run:</P>
          <CodeBlock>{`npx wrangler secret put RESEND_API_KEY
npx wrangler secret put EMAIL_FROM`}</CodeBlock>
          <P><Code>EMAIL_FROM</Code> is the sender people see, on your verified domain, for example <Code>{'Twiligent <no-reply@example.com>'}</Code>. If you pay for a Resend plan without a daily quota, also set <Code>EMAIL_DAILY_LIMIT</Code> to the number of emails a day you allow.</P>
        </Step>
        <Step title="Point Supabase at the backend">
          <P>In Supabase, open <strong>Authentication</strong>, <strong>Auth Hooks</strong>, and add a <strong>Send Email</strong> hook of type <strong>HTTPS</strong>. The URL is your backend address followed by <Code>/api/auth/email-hook</Code>, for example <Code>https://twiligent-api.example.workers.dev/api/auth/email-hook</Code>. Generate a secret, copy it, and save the hook.</P>
          <CodeBlock>{`npx wrangler secret put SEND_EMAIL_HOOK_SECRET`}</CodeBlock>
          <P>Paste the secret exactly as Supabase shows it, starting with <Code>v1,whsec_</Code>.</P>
        </Step>
        <Step title="Turn on email confirmation">
          <P>Open <strong>Sign In / Providers</strong>, <strong>Email</strong>. Turn on <strong>Confirm email</strong> and keep the email OTP length at 6. New members then enter the code on the sign-up page before they can sign in.</P>
        </Step>
        <Step title="Slow down bursts">
          <P>Open <strong>Rate Limits</strong> and set <strong>Rate limit for sending emails</strong> to about 30 an hour, so a burst of sign-ups cannot use the whole day at once. The backend also allows at most 5 emails a day to any one address. To stop automated sign-ups, turn on CAPTCHA under <strong>Attack Protection</strong>.</P>
        </Step>
        <Step title="Test it">
          <P>Create an account with an address you own. The code should arrive within a minute, from your <Code>EMAIL_FROM</Code> address. If it does not, run <Code>npx wrangler tail</Code> in <Code>backend/</Code> while you sign up: a <Code>request failed</Code> line explains why, for example an unverified domain.</P>
        </Step>
      </Steps>

      <Callout type="warning" title="Every email counts">
        <p>Password resets, email changes and security notices go through the same hook and count towards the 100. When the cap is reached, notices are skipped rather than blocking the change they report. Without Redis, the backend cannot count, and Resend&apos;s own daily quota is the only limit; the message people see is the same.</p>
      </Callout>
    </>
  );
}
