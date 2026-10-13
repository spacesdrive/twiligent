import React from 'react';
import { DocTitle, H2, H3, P, UL, A, Callout, PathCards, PathCard, Table } from '../components';

export function Introduction() {
  return (
    <>
      <DocTitle
        title="Twiligent documentation"
        lead="Guides for everyone who uses Twiligent, and for the people who run their own copy of it."
      />

      <H2>What Twiligent does</H2>
      <P>
        Twiligent brings your YouTube channels, Instagram professional accounts and Reddit profiles into one place. You see their analytics side by side, publish and schedule Instagram posts, and follow individual Reddit posts and YouTube videos that matter to you.
      </P>
      <P>
        Twiligent is self-hosted. Every copy of it, called an <strong>instance</strong>, belongs to the person or team who set it up. That person is the instance's <strong>administrator</strong>. Everyone who signs in to it is a <strong>member</strong>.
      </P>

      <H2>Choose your path</H2>
      <P>Which guides you need depends on one question: did someone give you a Twiligent link to sign in to, or are you setting Twiligent up yourself?</P>
      <PathCards>
        <PathCard to="/docs/use/getting-started" title="Use Twiligent" art={0}>
          You signed in to an instance someone else runs. Connect your accounts, read analytics and schedule posts. Nothing to install.
        </PathCard>
        <PathCard to="/docs/self-host" title="Run your own" art={1}>
          You want your own instance. Set up Supabase, the platform keys and Cloudflare, step by step, mostly on free plans.
        </PathCard>
        <PathCard to="/docs/reference/environment" title="Reference" art={2}>
          Every environment variable, how scheduling works, and the security model, in one place.
        </PathCard>
      </PathCards>

      <H2>What you can do</H2>
      <Table
        head={['Area', 'What it covers']}
        rows={[
          [<strong>Analytics</strong>, 'Subscribers, followers, karma, views, likes and comments across platforms, with per-account detail pages.'],
          [<strong>Libraries</strong>, 'Every YouTube video and Short, every Instagram reel, post and video, and every Reddit post, searchable and filterable.'],
          [<strong>Publishing</strong>, 'Publish photos, Reels and Stories to Instagram now, schedule them for later, or upload many files at once.'],
          [<strong>Tracked content</strong>, 'Follow any Reddit post or YouTube video by link, group them into categories and compare them.'],
        ]}
      />

      <Callout type="note" title="Not sure whether you are a member or an administrator?">
        <p>If you only ever opened a link and signed in, you are a member: read <A to="/docs/use/getting-started">Using Twiligent</A>. If you created the Supabase project and deployed the app, you are the administrator: read <A to="/docs/self-host">Run your own</A>.</p>
      </Callout>
    </>
  );
}

export function Concepts() {
  return (
    <>
      <DocTitle
        title="Members and administrators"
        lead="Who sets up what, and what each person can and cannot change."
      />

      <H2>Two roles</H2>
      <H3>Member</H3>
      <P>
        A member signs in to an existing instance with an email and password. Members connect their own YouTube, Instagram and Reddit accounts, read their analytics, publish and schedule posts, and track content. A member never needs a server, a database, API keys or GitHub.
      </P>
      <H3>Administrator</H3>
      <P>
        The administrator runs the instance. They create the Supabase project, get the platform keys (YouTube, Instagram, Cloudinary), deploy the backend and frontend to Cloudflare, and keep them running. The administrator is also the person members contact for Instagram tester access or when something is not working.
      </P>

      <H2>Who does what</H2>
      <Table
        head={['Task', 'Member', 'Administrator']}
        rows={[
          ['Sign in and add accounts', 'Yes', 'Yes'],
          ['Read analytics, publish and schedule', 'Yes', 'Yes'],
          ['Request Instagram tester access', 'Yes, by email', 'Adds the tester in the Meta app'],
          ['Set up scheduling', 'Nothing to do. The server publishes scheduled posts.', 'Deploys the backend once; optionally adds the GitHub backup'],
          ['Create and own the Supabase project', 'No', 'Yes'],
          ['Hold API keys and secrets', 'Never', 'Yes, as server secrets only'],
          ['Deploy updates', 'No', 'Yes'],
        ]}
      />

      <H2>What is shared and what is yours</H2>
      <UL>
        <li><strong>Shared by everyone on the instance:</strong> the YouTube API key, the Instagram (Meta) app, the Cloudinary account and the server itself. These are set once by the administrator.</li>
        <li><strong>Yours alone:</strong> the accounts you connect, their access tokens and cookies, your scheduled posts and your tracked content. Other members cannot see them, and the server never sends tokens or cookies back to any browser.</li>
      </UL>

      <Callout type="tip" title="Running Twiligent just for yourself?">
        <p>Then you are both. Follow <A to="/docs/self-host">Run your own</A> once, then use the app like any member.</p>
      </Callout>
    </>
  );
}
