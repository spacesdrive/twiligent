import React, { useState } from 'react';
import { KeyRound, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ConfirmDialog from '@/components/ConfirmDialog';
import RelativeTime from '@/components/RelativeTime';
import RowAction from '@/components/RowAction';
import { EmptyState } from '@/components/StateViews';
import { fmtDateTime } from '@/utils/formatters';
import { isExpired, permissionLabel } from './claudeAccessData';
import type { McpAccessTokenSummary } from '@shared/types/mcp.ts';

export interface ClaudeTokenListProps {
  tokens: McpAccessTokenSummary[];
  revokingId: string | null;
  onRevoke: (token: McpAccessTokenSummary) => Promise<boolean>;
}

function TokenRow({ token, onAskRevoke }: { token: McpAccessTokenSummary; onAskRevoke: () => void }) {
  const expired = isExpired(token);
  return (
    <li className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-ink">{token.label}</p>
          <Badge variant={token.permission === 'write' ? 'warning' : 'secondary'}>{permissionLabel(token.permission)}</Badge>
          {expired && <Badge variant="outline">Expired</Badge>}
        </div>
        <p className="text-caption text-ink-muted">
          <span className="font-mono">twl_...{token.hint}</span>
          <span aria-hidden="true"> · </span><span className="sr-only">, </span>
          {token.lastUsedAt ? <RelativeTime date={token.lastUsedAt} prefix="Used " /> : 'Never used'}
          <span aria-hidden="true"> · </span><span className="sr-only">, </span>
          {token.expiresAt ? `${expired ? 'Expired' : 'Expires'} ${fmtDateTime(token.expiresAt)}` : 'Does not expire'}
        </p>
      </div>
      <RowAction label="Revoke" target={token.label} onClick={onAskRevoke} danger>
        <Trash2 />
      </RowAction>
    </li>
  );
}

export default function ClaudeTokenList({ tokens, revokingId, onRevoke }: ClaudeTokenListProps) {
  const [pending, setPending] = useState<McpAccessTokenSummary | null>(null);

  if (tokens.length === 0) {
    return (
      <EmptyState
        compact
        icon={<KeyRound />}
        title="No access tokens yet"
        description="Create one above to connect Claude Code, or any client that sends a token."
      />
    );
  }

  return (
    <>
      <ul className="divide-y divide-divider">
        {tokens.map(token => <TokenRow key={token.id} token={token} onAskRevoke={() => setPending(token)} />)}
      </ul>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={open => { if (!open) setPending(null); }}
        title={`Revoke ${pending?.label ?? 'this token'}?`}
        description="Every Claude client that uses this token loses access at once. Revoking can't be undone; create a new token to connect again."
        confirmLabel="Revoke token"
        busyLabel="Revoking"
        busy={pending !== null && revokingId === pending.id}
        onConfirm={() => {
          if (pending) void onRevoke(pending).then(done => { if (done) setPending(null); });
        }}
      />
    </>
  );
}
