import React from 'react';
import { DocTitle, H2, P, UL, Table } from '../../components';

export default function Analytics() {
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
