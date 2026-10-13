import React from 'react';
import { DocTitle, H2, P } from '../../components';

export default function TrackedContent() {
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
