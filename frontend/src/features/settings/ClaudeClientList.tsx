import React, { useState } from 'react';
import { AppWindow, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ConfirmDialog from '@/components/ConfirmDialog';
import RelativeTime from '@/components/RelativeTime';
import RowAction from '@/components/RowAction';
import { EmptyState } from '@/components/StateViews';
import { permissionLabel } from './claudeAccessData';
import type { McpClientGrantSummary } from '@shared/types/mcp.ts';

export interface ClaudeClientListProps {
  clients: McpClientGrantSummary[];
  oauthEnabled: boolean;
  revokingId: string | null;
  onRemove: (client: McpClientGrantSummary) => Promise<boolean>;
}

function ClientRow({ client, onAskRemove }: { client: McpClientGrantSummary; onAskRemove: () => void }) {
  return (
    <li className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-ink">{client.clientName}</p>
          <Badge variant={client.permission === 'write' ? 'warning' : 'secondary'}>{permissionLabel(client.permission)}</Badge>
        </div>
        <p className="text-caption text-ink-muted">
          <RelativeTime date={client.createdAt} prefix="Approved " />
          <span aria-hidden="true"> · </span><span className="sr-only">, </span>
          {client.lastUsedAt ? <RelativeTime date={client.lastUsedAt} prefix="Used " /> : 'Never used'}
        </p>
      </div>
      <RowAction label="Remove" target={client.clientName} onClick={onAskRemove} danger>
        <Trash2 />
      </RowAction>
    </li>
  );
}

export default function ClaudeClientList({ clients, oauthEnabled, revokingId, onRemove }: ClaudeClientListProps) {
  const [pending, setPending] = useState<McpClientGrantSummary | null>(null);

  if (clients.length === 0) {
    return (
      <EmptyState
        compact
        icon={<AppWindow />}
        title="No apps approved yet"
        description={oauthEnabled
          ? 'Add Twiligent as a custom connector in Claude. You approve it here when Claude asks.'
          : 'Claude on the web, desktop and mobile can connect once the instance owner turns on connector sign-in.'}
      />
    );
  }

  return (
    <>
      <ul className="divide-y divide-divider">
        {clients.map(client => <ClientRow key={client.id} client={client} onAskRemove={() => setPending(client)} />)}
      </ul>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={open => { if (!open) setPending(null); }}
        title={`Remove ${pending?.clientName ?? 'this app'}?`}
        description="It loses access to your account at its next request. To use it again, connect it in Claude and approve it here."
        confirmLabel="Remove app"
        busyLabel="Removing"
        busy={pending !== null && revokingId === pending.id}
        onConfirm={() => {
          if (pending) void onRemove(pending).then(done => { if (done) setPending(null); });
        }}
      />
    </>
  );
}
