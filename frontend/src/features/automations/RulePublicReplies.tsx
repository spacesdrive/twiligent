import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import RowAction from '@/components/RowAction';
import { cn } from '@/lib/utils';
import { MAX_PUBLIC_REPLY_CHARS, MAX_PUBLIC_REPLY_TEXTS, publicReplyTextProblem } from './automationData.ts';

interface RulePublicRepliesProps {
  texts: string[];
  onChange: (texts: string[]) => void;
}

// the public reply's texts, one picked for each comment; at least one field always stays
export default function RulePublicReplies({ texts, onChange }: RulePublicRepliesProps) {
  const update = (index: number, value: string) => onChange(texts.map((text, at) => (at === index ? value : text)));
  const remove = (index: number) => onChange(texts.filter((_, at) => at !== index));
  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Public reply texts">
      {texts.map((text, index) => {
        const problem = text.trim() ? publicReplyTextProblem(text.trim()) : null;
        const id = `rule-public-${index}`;
        return (
          <div key={index} className="flex flex-col gap-1">
            <div className="flex items-start gap-1.5">
              <Textarea
                id={id}
                rows={2}
                maxLength={MAX_PUBLIC_REPLY_CHARS}
                value={text}
                onChange={e => update(index, e.target.value)}
                aria-label={texts.length > 1 ? `Public reply ${index + 1} of ${texts.length}` : 'Public reply'}
                aria-invalid={problem ? true : undefined}
                aria-describedby={problem ? `${id}-problem` : undefined}
                placeholder="Thanks for your comment."
              />
              {texts.length > 1 && <RowAction label={`Remove public reply ${index + 1}`} onClick={() => remove(index)}><X /></RowAction>}
            </div>
            <p id={`${id}-problem`} className={cn('text-caption', problem ? 'text-danger' : 'text-ink-faint')}>
              {problem ?? `${text.trim().length} of ${MAX_PUBLIC_REPLY_CHARS} characters`}
            </p>
          </div>
        );
      })}
      {texts.length < MAX_PUBLIC_REPLY_TEXTS && (
        <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => onChange([...texts, ''])}>
          <Plus data-icon="inline-start" />Add another wording
        </Button>
      )}
    </div>
  );
}
