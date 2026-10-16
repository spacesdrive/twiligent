import { Megaphone, UserCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { FieldRow } from '@/components/DetailPanel';
import AccountSelect from '@/components/AccountSelect';
import RuleMediaPicker from './RuleMediaPicker';
import RulePreview from './RulePreview';
import type { AutomationMatchMode } from '@shared/types/automation.ts';
import type { AppAccount } from '../../utils/formatters';
import type { RuleScope } from './automationData.ts';
import type { RuleFormState } from './useRuleForm';

interface RuleDialogProps {
  rule: RuleFormState;
  igAccounts: AppAccount[];
}

const MATCH_MODES: { value: AutomationMatchMode; label: string }[] = [
  { value: 'contains', label: 'Anywhere in the comment, as a whole word' },
  { value: 'exact', label: 'The whole comment, nothing else' },
  { value: 'any', label: 'Any comment, no keyword needed' },
];

const SCOPES: { value: RuleScope; label: string }[] = [
  { value: 'all', label: 'Every post and reel' },
  { value: 'selected', label: 'Only the posts I choose' },
];

export default function RuleDialog({ rule, igAccounts }: RuleDialogProps) {
  const { form, setField, saving } = rule;
  return (
    <Dialog open={rule.open} onOpenChange={open => !saving && rule.setOpen(open)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{rule.ruleId ? 'Edit rule' : 'New rule'}</DialogTitle>
          <DialogDescription>When a comment matches, Twiligent sends its author this private reply on Instagram.</DialogDescription>
        </DialogHeader>
        <form id="automation-rule-form" onSubmit={rule.handleSubmit} className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="flex flex-col gap-5">
            <FieldRow label="Instagram account">
              <AccountSelect accounts={igAccounts} value={form.accountId} onChange={value => setField('accountId', value)} disabled={Boolean(rule.ruleId)} />
            </FieldRow>
            <FieldRow label="Name" htmlFor="rule-name" hint="Only you see this.">
              <Input id="rule-name" value={form.name} maxLength={80} onChange={e => setField('name', e.target.value)} placeholder="Free guide" />
            </FieldRow>
            <FieldRow label="Match">
              <Select value={form.matchMode} onValueChange={value => value && setField('matchMode', value as AutomationMatchMode)} items={MATCH_MODES}>
                <SelectTrigger className="w-full" aria-label="Match"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {MATCH_MODES.map(mode => <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {form.matchMode !== 'any' && (
                <label htmlFor="rule-case" className="flex items-center justify-between gap-3 text-small text-ink-muted">
                  Match the letter case exactly
                  <Switch id="rule-case" checked={form.caseSensitive} onCheckedChange={checked => setField('caseSensitive', checked)} />
                </label>
              )}
            </FieldRow>
            {form.matchMode === 'any' ? (
              <Alert variant="warning">
                <Megaphone />
                <AlertTitle>Every comment gets this reply</AlertTitle>
                <AlertDescription>
                  Everyone who comments receives a private message, including people who did not ask for one, and a busy post reaches the
                  hourly limits sooner. Each person gets at most a few replies a day. Aim the rule at chosen posts to keep it small. A
                  keyword rule for the same post still answers first.
                </AlertDescription>
              </Alert>
            ) : (
              <FieldRow label="Keywords" htmlFor="rule-keywords" hint="Separate keywords with commas. Up to 10.">
                <Input id="rule-keywords" value={form.keywordsText} onChange={e => setField('keywordsText', e.target.value)} placeholder="GUIDE, LINK" />
              </FieldRow>
            )}
            <FieldRow label="Posts">
              <Select value={form.scope} onValueChange={value => value && setField('scope', value as RuleScope)} items={SCOPES}>
                <SelectTrigger className="w-full" aria-label="Posts"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {SCOPES.map(scope => <SelectItem key={scope.value} value={scope.value}>{scope.label}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {form.scope === 'selected' && <RuleMediaPicker media={rule.media} loading={rule.mediaLoading} selected={form.mediaIds} onToggle={rule.toggleMedia} />}
            </FieldRow>
            <div className="flex flex-col gap-3 rounded-card border border-line p-4">
              <label htmlFor="rule-follow" className="flex items-center justify-between gap-3 text-sm font-medium text-ink">
                <span className="flex items-center gap-2">
                  <UserCheck className="size-4 text-ink-muted" />Send the link only to followers
                  <Badge variant="warning">Testing</Badge>
                </span>
                <Switch id="rule-follow" checked={form.requireFollow} onCheckedChange={checked => setField('requireFollow', checked)} />
              </label>
              <p className="text-small text-ink-muted">
                Instagram tells Twiligent whether someone follows you only after they message you. With this on, the first reply asks them
                to follow and reply. When they reply, Twiligent asks Instagram, then sends the reply and link to followers and a reminder to
                everyone else, twice at most. If Instagram cannot say, nothing is sent.
              </p>
              <p className="text-small text-warning">
                This option is still being tested and may or may not work. It needs Instagram to send your account&apos;s messages to
                Twiligent, which Meta may not allow without extra app approval. Use a keyword rule when the link must arrive.
              </p>
              {form.requireFollow && (
                <>
                  <FieldRow label="First reply" htmlFor="rule-follow-prompt" hint="Sent to everyone who comments. It has no link.">
                    <Textarea id="rule-follow-prompt" rows={3} maxLength={1000} value={form.followPromptText} onChange={e => setField('followPromptText', e.target.value)} />
                  </FieldRow>
                  <FieldRow label="Reminder" htmlFor="rule-follow-reminder" hint="Sent when they reply but do not follow yet.">
                    <Textarea id="rule-follow-reminder" rows={3} maxLength={1000} value={form.notFollowingText} onChange={e => setField('notFollowingText', e.target.value)} />
                  </FieldRow>
                </>
              )}
            </div>
            <FieldRow label={form.requireFollow ? 'Reply for followers' : 'Reply'} htmlFor="rule-reply">
              <Textarea id="rule-reply" rows={4} maxLength={1000} value={form.replyText} onChange={e => setField('replyText', e.target.value)} placeholder="Here is your guide. Enjoy it." />
            </FieldRow>
            <FieldRow label="Link" htmlFor="rule-link" hint="Optional. Added on its own line after the reply. Must start with https://">
              <Input id="rule-link" type="url" inputMode="url" value={form.linkUrl} onChange={e => setField('linkUrl', e.target.value)} placeholder="https://example.com/guide" />
            </FieldRow>
            <FieldRow label="Replies an hour" htmlFor="rule-limit" hint="Optional. The account's own limit still applies; Instagram allows 750 an hour.">
              <Input id="rule-limit" type="number" min={1} max={750} step={1} inputMode="numeric" value={form.hourlyLimit} onChange={e => setField('hourlyLimit', e.target.value)} placeholder="No limit for this rule" />
            </FieldRow>
            <label htmlFor="rule-enabled" className="flex items-center justify-between gap-3 text-sm font-medium text-ink">
              Turn the rule on when saved
              <Switch id="rule-enabled" checked={form.enabled} onCheckedChange={checked => setField('enabled', checked)} />
            </label>
          </div>
          <RulePreview rule={rule} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => rule.setOpen(false)} disabled={saving}>Cancel</Button>
          <Button type="submit" form="automation-rule-form" disabled={saving}>
            {saving && <Spinner className="size-4" />}
            {saving ? 'Saving' : rule.ruleId ? 'Save rule' : 'Create rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
