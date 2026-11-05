import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';

export interface CopyFieldProps {
  id: string;
  // what the value is, for the copy button's name ("Copy access token")
  label: string;
  value: string;
}

// a value too long for CopyChip (a token, a command): the whole text stays selectable, and one button copies it
export default function CopyField({ id, label, value }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // without clipboard access the text is still selectable, so select it for a manual copy
      (document.getElementById(id) as HTMLInputElement | null)?.select();
    }
  };

  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        value={value}
        readOnly
        spellCheck={false}
        onFocus={e => e.currentTarget.select()}
        className="font-mono text-sm"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton onClick={handleCopy} aria-label={copied ? `${label} copied` : `Copy ${label}`}>
          {copied ? <Check className="text-success" /> : <Copy />}
          {copied ? 'Copied' : 'Copy'}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
