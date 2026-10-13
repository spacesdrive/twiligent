import React from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';

export default function AddAccountFooter({ flow }) {
  const { platform, channel, reddit, channelAdd, redditAdd, instagram } = flow;
  const { adding } = channelAdd;
  const { connecting } = instagram;
  const { addingReddit } = redditAdd;

  return (
    <DialogFooter>
      {platform ? (
        <Button variant="ghost" onClick={flow.goBack} className="sm:mr-auto">
          <ArrowLeft data-icon="inline-start" />
          Back
        </Button>
      ) : null}
      <Button variant="outline" onClick={flow.closeDialog}>Cancel</Button>
      {platform === 'youtube' && (
        <Button onClick={channelAdd.handleAdd} disabled={!channel.input.trim() || adding}>
          {adding && <Spinner className="size-4" />}
          {adding ? 'Adding channel' : 'Add channel'}
        </Button>
      )}
      {platform === 'instagram' && (
        <Button onClick={instagram.handleConnectInstagram} disabled={connecting}>
          {connecting ? <Spinner className="size-4" /> : <ExternalLink data-icon="inline-start" />}
          {connecting ? 'Opening Instagram' : 'Continue to Instagram'}
        </Button>
      )}
      {platform === 'reddit' && (
        <Button onClick={redditAdd.handleAddReddit} disabled={!reddit.username.trim() || !reddit.cookie.trim() || addingReddit}>
          {addingReddit && <Spinner className="size-4" />}
          {addingReddit ? 'Adding account' : 'Add Reddit account'}
        </Button>
      )}
    </DialogFooter>
  );
}
