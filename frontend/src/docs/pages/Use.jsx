import React from 'react';
import { ADMIN_EMAIL, adminMailto, INSTAGRAM_TESTER_INVITES_URL } from '@/lib/contact';
import { DocTitle, H2, H3, P, UL, OL, A, Code, Callout, Steps, Step, Table } from '../components';

function AdminLink({ subject }) {
  return <A href={adminMailto(subject)}>{ADMIN_EMAIL}</A>;
}

export function GettingStarted() {
  return (
    <>
      <DocTitle title="Sign in and first steps" lead="Everything a member does in the first ten minutes. No installation or setup needed." />

      <Callout type="note" title="This guide is for members">
        <p>You are a member if someone gave you a Twiligent link to sign in to. The server, keys and scheduling are already handled by the administrator.</p>
      </Callout>

      <Steps>
        <Step title="Create your account">
          <P>Open your instance's link and choose <strong>Create an account</strong>. Use your email and a password of at least 6 characters, then sign in.</P>
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

export function ConnectAccounts() {
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

export function Analytics() {
  return (
    <>
      <DocTitle title="Read your analytics" lead="What each number means and where it comes from." />

      <H2>Overview</H2>
      <P>The Overview has six tiles: <strong>Audience</strong>, <strong>Views</strong>, <strong>Content</strong>, <strong>Accounts</strong>, <strong>Comments</strong> and <strong>Likes</strong>. Select a tile to see its detail below. The first time you open it, Twiligent loads recent posts for each account in the background; the numbers fill in after a short wait.</P>
      <Table
        head={['Metric', 'How it is counted']}
        rows={[
          ['Audience', 'YouTube subscribers plus Instagram followers plus Reddit karma.'],
          ['Views', 'YouTube channel views, Instagram views where Instagram reports them, and views on tracked content.'],
          ['Likes', 'YouTube likes, Instagram likes and Reddit karma.'],
          ['Karma', 'Reddit calls a post\'s upvotes "score"; Twiligent always shows it as karma.'],
        ]}
      />

      <H2>Account pages</H2>
      <P>Select an account in the sidebar to open its own page. YouTube channels have tabs for videos, engagement, publishing times, growth, Shorts and tags. Instagram and Reddit pages show posting patterns, best days and hours, and top posts.</P>

      <H2>Why a number looks wrong</H2>
      <UL>
        <li><strong>Instagram views show a dash.</strong> Instagram does not report views for some older posts or when insights are unavailable. A dash means "not reported", not zero.</li>
        <li><strong>Reddit has no view counts.</strong> Reddit stopped publishing views in 2018. You can enter them by hand for tracked Reddit posts.</li>
        <li><strong>Numbers are a little old.</strong> Use <strong>Refresh</strong> on an account, or <strong>Refresh all</strong> in the top bar.</li>
      </UL>
    </>
  );
}

export function Publishing() {
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

export function TrackedContent() {
  return (
    <>
      <DocTitle title="Track content" lead="Follow any Reddit post or YouTube video by its link, even ones you did not make." />
      <H2>Add an item</H2>
      <P>Open <strong>Tracked content</strong> and choose <strong>Track content</strong>. Paste a Reddit post link or a YouTube video or Shorts link. Add an optional label and category, then choose <strong>Track</strong>.</P>
      <H2>Categories</H2>
      <P>Categories group items, for example by campaign. Each category gets its own page in the sidebar with combined views, karma and comments. To set a category on many items, select them with the checkboxes and use <strong>Assign category</strong>.</P>
      <H2>Views and images for Reddit posts</H2>
      <P>Reddit does not report views, so use <strong>Edit</strong> to enter the number from the post's insights page. Reddit posts also have no thumbnail; you can upload a screenshot so you recognise the post at a glance.</P>
      <H2>Keep numbers current</H2>
      <P>Use the refresh button on a row to fetch the latest karma, likes and comments for that item.</P>
    </>
  );
}

export function Troubleshooting() {
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
