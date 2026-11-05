import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import SegmentedChoice from '@/components/SegmentedChoice';
import { FieldRow } from '@/components/DetailPanel';
import {
  DEFAULT_EXPIRY, EXPIRY_OPTIONS, PERMISSION_OPTIONS, TOKEN_LABEL_MAX_LENGTH, expiryDays, tokenLabelError,
} from './claudeAccessData';
import type { ExpiryChoice } from './claudeAccessData';
import type { McpAccessTokenCreateRequest, McpPermission } from '@shared/types/mcp.ts';

export interface ClaudeTokenFormProps {
  creating: boolean;
  onCreate: (input: McpAccessTokenCreateRequest) => Promise<boolean>;
}

export default function ClaudeTokenForm({ creating, onCreate }: ClaudeTokenFormProps) {
  const [label, setLabel] = useState('');
  // read only is the default, so a token that only needs to look cannot change anything
  const [permission, setPermission] = useState<McpPermission>('read');
  const [expiry, setExpiry] = useState<ExpiryChoice>(DEFAULT_EXPIRY);
  const [tried, setTried] = useState(false);
  const labelError = tried ? tokenLabelError(label) : null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (creating) return;
    setTried(true);
    if (tokenLabelError(label)) {
      document.getElementById('mcp-token-label')?.focus();
      return;
    }
    const done = await onCreate({ label: label.trim(), permission, expiresInDays: expiryDays(expiry) });
    if (done) {
      setLabel('');
      setTried(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <FieldRow label="Name" htmlFor="mcp-token-label" hint="Where you will use it, such as Work laptop." error={labelError ?? undefined}>
        <Input
          id="mcp-token-label"
          value={label}
          onChange={e => setLabel(e.target.value)}
          maxLength={TOKEN_LABEL_MAX_LENGTH}
          autoComplete="off"
          required
          className="max-w-sm"
        />
      </FieldRow>
      <FieldRow label="What Claude may do" htmlFor="mcp-token-permission" group hint="Making changes covers importing media, scheduling, editing and cancelling posts, and saving settings. Claude asks you to confirm before it schedules or cancels a post, or deletes media.">
        <SegmentedChoice<McpPermission>
          name="mcp-token-permission"
          id="mcp-token-permission"
          options={PERMISSION_OPTIONS}
          value={permission}
          onChange={setPermission}
        />
      </FieldRow>
      <FieldRow label="Expires" htmlFor="mcp-token-expiry">
        <Select value={expiry} onValueChange={value => setExpiry(value as ExpiryChoice)} items={EXPIRY_OPTIONS}>
          <SelectTrigger id="mcp-token-expiry" className="w-full max-w-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {EXPIRY_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
      </FieldRow>
      <Button type="submit" variant="outline" className="self-start" disabled={creating}>
        {creating ? <Spinner className="size-4" /> : <Plus data-icon="inline-start" />}
        {creating ? 'Creating token' : 'Create token'}
      </Button>
    </form>
  );
}
