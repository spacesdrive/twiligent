import React from 'react';
import { DocTitle, H3, P, A } from '../../components';

export default function FAQ() {
  return (
    <>
      <DocTitle title="FAQ" lead="Short answers to the questions people ask most." />

      <H3>Do I need GitHub to schedule posts?</H3>
      <P>No. Members never do. Administrators only need the deployed Worker; the GitHub workflow is an optional backup.</P>

      <H3>Do I need my own Supabase project?</H3>
      <P>Only if you run your own instance. Members of someone else's instance use theirs.</P>

      <H3>Why can't I connect my Instagram account?</H3>
      <P>It must be a Business or Creator account, and while the instance's Meta app is in development mode it must be added as a tester. See <A to="/docs/use/connect-accounts">Connect your accounts</A>.</P>

      <H3>Can I connect a YouTube channel I do not own?</H3>
      <P>Yes. YouTube analytics use public data, so any public channel works.</P>

      <H3>Does Twiligent publish to YouTube or Reddit?</H3>
      <P>No. Publishing is Instagram only. YouTube and Reddit are analytics only.</P>

      <H3>What does running an instance cost?</H3>
      <P>For a small team, nothing. Supabase, Cloudflare, Cloudinary and Upstash free plans cover typical use, and the YouTube and Instagram APIs are free.</P>

      <H3>How fresh is the data?</H3>
      <P>Data is fetched when you open a page or choose Refresh, and cached for a short time when Redis is set up. Instagram tokens are renewed nightly.</P>

      <H3>Who do I contact for help?</H3>
      <P>The administrator of your instance. Their address is on the <A to="/docs/use/troubleshooting">Troubleshooting</A> page.</P>
    </>
  );
}
