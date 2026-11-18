import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import RowAction from '@/components/RowAction';
import { cn } from '@/lib/utils';
import { MAX_MESSAGE_BYTES, MAX_REPLY_VARIANTS, composeReply, messageBytes } from './automationData.ts';

interface RuleReplyVariantsProps {
  texts: string[];
  onChange: (texts: string[]) => void;
  // the link is added after each wording only when the first message carries it
  linkUrl: string | null;
  error?: string;
}

// other wordings of the first private message, one picked per comment; the list may be empty
export default function RuleReplyVariants({ texts, onChange, linkUrl, error }: RuleReplyVariantsProps) {
  const update = (index: number, value: string) => onChange(texts.map((text, at) => (at === index ? value : text)));
  const remove = (index: number) => onChange(texts.filter((_, at) => at !== index));
  return (
    <div className="flex flex-col gap-2" role="group" aria-labelledby="rule-variants-label" aria-describedby="rule-variants-help">
      <p id="rule-variants-label" className="text-sm font-medium text-ink">Other wordings</p>
      <p id="rule-variants-help" className="max-w-prose text-body text-ink-muted">
        One wording is picked for each comment. Many identical messages to people who do not follow you can lead Instagram to block
        your private replies, so add two or three ways of saying the same thing.
      </p>
      {texts.map((text, index) => {
        const bytes = text.trim() ? messageBytes(linkUrl ? composeReply(text, linkUrl) : text.trim()) : 0;
        const id = `rule-variant-${index}`;
        return (
          <div key={index} className="flex flex-col gap-1">
            <div className="flex items-start gap-1.5">
              <Textarea
                id={id}
                rows={2}
                maxLength={MAX_MESSAGE_BYTES}
                value={text}
                onChange={e => update(index, e.target.value)}
                aria-label={`Other wording ${index + 1} of ${texts.length}`}
                aria-invalid={bytes > MAX_MESSAGE_BYTES ? true : undefined}
                aria-describedby={`${id}-size`}
              />
              <RowAction label={`Remove other wording ${index + 1}`} onClick={() => remove(index)}><X /></RowAction>
            </div>
            <p id={`${id}-size`} className={cn('text-caption', bytes > MAX_MESSAGE_BYTES ? 'text-danger' : 'text-ink-faint')}>
              {bytes} of {MAX_MESSAGE_BYTES} bytes{linkUrl ? ' with the link' : ''}
            </p>
          </div>
        );
      })}
      {error && <p className="text-sm text-danger" role="alert"><span className="sr-only">Error: </span>{error}</p>}
      {texts.length < MAX_REPLY_VARIANTS && (
        <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => onChange([...texts, ''])}>
          <Plus data-icon="inline-start" />Add a wording
        </Button>
      )}
    </div>
  );
}
