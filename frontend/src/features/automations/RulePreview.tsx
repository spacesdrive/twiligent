import { FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { MAX_MESSAGE_BYTES, composeReply, messageBytes } from './automationData.ts';
import type { RuleFormState } from './useRuleForm';

interface RulePreviewProps {
  rule: RuleFormState;
}

// the private reply as the commenter would see it, and a keyword test that sends nothing
export default function RulePreview({ rule }: RulePreviewProps) {
  const { form, testResult } = rule;
  const message = composeReply(form.replyText, form.linkUrl);
  const bytes = messageBytes(message);
  return (
    <div className="flex flex-col gap-4 self-start rounded-card border border-line bg-surface-sunken p-4 md:sticky md:top-0">
      <div className="flex flex-col gap-2">
        <p className="text-small font-medium text-ink">Preview</p>
        <div className="max-w-[85%] self-start rounded-card rounded-bl-row bg-surface-raised px-3.5 py-2.5 text-sm whitespace-pre-wrap text-ink shadow-xs">
          {message || <span className="text-ink-faint">Your reply appears here</span>}
        </div>
        <p className={cn('text-caption', bytes > MAX_MESSAGE_BYTES ? 'text-danger' : 'text-ink-faint')}>
          {bytes} of {MAX_MESSAGE_BYTES} bytes. Instagram sends one private reply per comment, within 7 days of it.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="rule-test" className="text-small font-medium text-ink">Test a comment</label>
        <div className="flex gap-2">
          <Input id="rule-test" value={rule.sampleComment} onChange={e => rule.setSampleComment(e.target.value)} placeholder="Send me the guide" />
          <Button type="button" variant="outline" onClick={rule.runTest} disabled={rule.testing || !rule.sampleComment.trim() || !form.keywordsText.trim()}>
            {rule.testing ? <Spinner className="size-4" /> : <FlaskConical data-icon="inline-start" />}
            Test
          </Button>
        </div>
        {testResult && (
          <p role="status" className={cn('text-small', testResult.matched ? 'text-success' : 'text-ink-muted')}>
            {testResult.matched
              ? `Matches the keyword ${testResult.keyword}. This comment would get the reply above.`
              : 'No keyword matches this comment, so it would get no reply.'}
          </p>
        )}
        <p className="text-caption text-ink-faint">The test checks the keywords only. Nothing is sent.</p>
      </div>
    </div>
  );
}
