import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function CopyChip({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-7 items-center gap-1.5 rounded-control border border-line-control bg-surface px-2.5 font-mono text-small text-ink transition-colors hover:bg-surface-hover"
      aria-label={copied ? `${text} copied` : `Copy ${text}`}
    >
      {text}
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5 text-ink-faint" />}
    </button>
  );
}
