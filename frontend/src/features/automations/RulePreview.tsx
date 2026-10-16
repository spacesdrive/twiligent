import { FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { MAX_MESSAGE_BYTES, composeReply, messageBytes, publicReplyTexts } from './automationData.ts';
import type { RuleFormState } from './useRuleForm';

interface RulePreviewProps {
  rule: RuleFormState;
}

function Bubble({ text, placeholder }: { text: string; placeholder: string }) {
  return (
    <div className="max-w-[85%] self-start rounded-card rounded-bl-row bg-surface-raised px-3.5 py-2.5 text-sm whitespace-pre-wrap text-ink shadow-xs">
      {text || <span className="text-ink-faint">{placeholder}</span>}
    </div>
  );
}

// the comment and the public reply under it, as they would read in the thread
function Thread({ comment, reply }: { comment: string; reply: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-card bg-surface-raised px-3.5 py-3 text-sm shadow-xs">
      <p className="text-ink"><span className="font-semibold">commenter</span> {comment || <span className="text-ink-faint">Their comment</span>}</p>
      <p className="border-l-2 border-line pl-3 text-ink">
        <span className="font-semibold">you</span> {reply || <span className="text-ink-faint">Your public reply appears here</span>}
      </p>
    </div>
  );
}

// what the commenter would see in private and under their comment, and a match test that sends nothing
export default function RulePreview({ rule }: RulePreviewProps) {
  const { form, testResult } = rule;
  const message = composeReply(form.replyText, form.linkUrl);
  const bytes = messageBytes(message);
  const publicTexts = publicReplyTexts(form.publicReplyTexts);
  const canTest = rule.sampleComment.trim() && (form.matchMode === 'any' || form.keywordsText.trim());
  const answers = [form.privateReplyEnabled && (form.requireFollow ? 'the first private reply' : 'the private reply'), form.publicReplyEnabled && 'the public reply']
    .filter(Boolean)
    .join(' and ');
  return (
    <div className="flex flex-col gap-4 self-start rounded-card border border-line bg-surface-sunken p-4 md:sticky md:top-0">
      {form.publicReplyEnabled && (
        <div className="flex flex-col gap-2">
          <p className="text-small font-medium text-ink">Under the comment</p>
          <Thread comment={rule.sampleComment.trim()} reply={publicTexts[0] ?? ''} />
          {publicTexts.length > 1 && <p className="text-caption text-ink-faint">One of {publicTexts.length} wordings, picked for each comment.</p>}
        </div>
      )}
      {form.privateReplyEnabled && (
        <div className="flex flex-col gap-2">
          <p className="text-small font-medium text-ink">Private message</p>
          {form.requireFollow && (
            <>
              <p className="text-caption text-ink-faint">First reply, to everyone who comments</p>
              <Bubble text={form.followPromptText.trim()} placeholder="Your request to follow appears here" />
              <p className="text-caption text-ink-faint">After they reply, if Instagram says they follow</p>
            </>
          )}
          <Bubble text={message} placeholder="Your reply appears here" />
          <p className={cn('text-caption', bytes > MAX_MESSAGE_BYTES ? 'text-danger' : 'text-ink-faint')}>
            {bytes} of {MAX_MESSAGE_BYTES} bytes. Instagram sends one private reply per comment, within 7 days of it.
          </p>
        </div>
      )}
      {!form.privateReplyEnabled && !form.publicReplyEnabled && (
        <p className="text-small text-ink-muted">Turn on the private reply, the public reply, or both, to see them here.</p>
      )}
      <div className="flex flex-col gap-2">
        <label htmlFor="rule-test" className="text-small font-medium text-ink">Test a comment</label>
        <div className="flex gap-2">
          <Input id="rule-test" value={rule.sampleComment} onChange={e => rule.setSampleComment(e.target.value)} placeholder="Send me the guide" />
          <Button type="button" variant="outline" onClick={rule.runTest} disabled={rule.testing || !canTest}>
            {rule.testing ? <Spinner className="size-4" /> : <FlaskConical data-icon="inline-start" />}
            Test
          </Button>
        </div>
        {testResult && (
          <p role="status" className={cn('text-small', testResult.matched ? 'text-success' : 'text-ink-muted')}>
            {testResult.matched
              ? `${testResult.keyword ? `Matches the keyword ${testResult.keyword}.` : 'This rule answers any comment.'} This comment would get ${answers || 'no answer'}.`
              : 'No keyword matches this comment, so it would get no answer.'}
          </p>
        )}
        <p className="text-caption text-ink-faint">The test checks the match only. Nothing is sent or posted.</p>
      </div>
    </div>
  );
}
