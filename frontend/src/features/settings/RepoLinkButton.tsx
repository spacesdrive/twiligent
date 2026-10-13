import React from 'react';
import GuideLinkButton from './GuideLinkButton';

// links into the user's own copy stay disabled until a GitHub username is entered
export interface RepoLinkButtonProps {
  base: string | null;
  path: string;
  label: string;
}

export default function RepoLinkButton({ base, path, label }: RepoLinkButtonProps) {
  return (
    <GuideLinkButton href={base ? `${base}${path}` : ''} disabled={!base}>
      {base ? label : 'Enter your GitHub username first'}
    </GuideLinkButton>
  );
}
