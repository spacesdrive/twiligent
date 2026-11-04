import React from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import type { AddAccountFlow } from './useAddAccount';

export interface AddAccountFooterProps {
  flow: AddAccountFlow;
}

// the main button stays enabled: pressing it with a field missing says which one, instead of greying out silently
export default function AddAccountFooter({ flow }: AddAccountFooterProps) {
  const { platform, channelAdd, redditAdd, instagram } = flow;
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
        <Button onClick={channelAdd.handleAdd} disabled={adding}>
          {adding && <Spinner className="size-4" />}
          {adding ? 'Adding channel' : 'Add channel'}
        </Button>
      )}
      {platform === 'instagram' && (
        <Button id="add-account-primary" onClick={instagram.handleConnectInstagram} disabled={connecting}>
          {connecting ? <Spinner className="size-4" /> : <ExternalLink data-icon="inline-start" />}
          {connecting ? 'Opening Instagram' : 'Continue to Instagram'}
        </Button>
      )}
      {platform === 'reddit' && (
        <Button type="submit" form="add-account-form" disabled={addingReddit}>
          {addingReddit && <Spinner className="size-4" />}
          {addingReddit ? 'Adding account' : 'Add Reddit account'}
        </Button>
      )}
    </DialogFooter>
  );
}
