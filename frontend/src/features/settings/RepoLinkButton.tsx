import React from 'react';
import GuideLinkButton from './GuideLinkButton';

// links into the user's own copy stay disabled until a GitHub username is entered
export default function RepoLinkButton({ base, path, label }) {
  return (
    <GuideLinkButton href={base ? `${base}${path}` : ''} disabled={!base}>
      {base ? label : 'Enter your GitHub username first'}
    </GuideLinkButton>
  );
}
