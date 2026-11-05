import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { History, Megaphone, MessageCircle, Send, UserCheck } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { FieldRow } from '@/components/DetailPanel';
import { fieldErrorId } from '@/lib/fieldIds';
import AccountSelect from '@/components/AccountSelect';
import ConfirmDialog from '@/components/ConfirmDialog';
import PageHeader from '@/components/PageHeader';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/StateViews';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useAppContext } from '../../context/AppContext';
import RuleMediaPicker from './RuleMediaPicker';
import RulePreview from './RulePreview';
import RulePublicReplies from './RulePublicReplies';
import { emptyRuleForm, ruleToForm } from './automationData.ts';
import { useAutomations } from './useAutomations';
import { useRuleForm } from './useRuleForm';
import type { AutomationMatchMode } from '@shared/types/automation.ts';
import type { ReactNode } from 'react';
import type { AppAccount } from '../../utils/formatters';
import type { RuleForm, RuleScope } from './automationData.ts';

interface ReplySectionProps {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  error?: string;
  children: ReactNode;
}

interface RuleEditorProps {
  ruleId: string | null;
  initialForm: RuleForm;
  igAccounts: AppAccount[];
  saveRule: (form: RuleForm, ruleId: string | null) => Promise<boolean>;
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

// one way of answering, switched on and off on its own; its fields show only while it is on
function ReplySection({ id, icon, title, description, checked, onCheckedChange, error, children }: ReplySectionProps) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line p-4">
      <label htmlFor={id} className="flex items-center justify-between gap-3 text-sm font-medium text-ink">
        <span className="flex items-center gap-2 [&_svg]:size-4 [&_svg]:text-ink-muted">{icon}{title}</span>
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-describedby={[`${id}-description`, error ? fieldErrorId(id) : ''].filter(Boolean).join(' ')}
          aria-invalid={error ? true : undefined}
        />
      </label>
      <p id={`${id}-description`} className="max-w-prose text-body text-ink-muted">{description}</p>
      {error && <p id={fieldErrorId(id)} className="text-sm text-danger"><span className="sr-only">Error: </span>{error}</p>}
      {checked && children}
    </div>
  );
}

// the editor once the rule (or the account for a new one) is known, so the form starts from fixed values
function RuleEditor({ ruleId, initialForm, igAccounts, saveRule }: RuleEditorProps) {
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const rule = useRuleForm({ ruleId, initialForm, saveRule, onSaved: useCallback(() => setDone(true), []) });
  const { form, setField, saving, errorFor } = rule;
  const guard = useUnsavedChanges(rule.dirty && !saving);

  // leaving waits for the render in which the saved form no longer counts as unsaved work
  useEffect(() => {
    if (done) navigate('/automations');
  }, [done, navigate]);

  return (
    <>
      {rule.restored && (
        <Alert variant="info">
          <History />
          <AlertTitle>Your unsaved changes are back</AlertTitle>
          <AlertDescription>They were kept from your last visit to this rule in this tab.</AlertDescription>
          <AlertAction><Button size="sm" variant="outline" onClick={rule.discardDraft}>Discard them</Button></AlertAction>
        </Alert>
      )}
      <form id="automation-rule-form" onSubmit={rule.handleSubmit} noValidate className="flex flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
          <div className="flex flex-col gap-5">
            <FieldRow label="Instagram account" htmlFor="rule-account" error={errorFor('accountId')} hint={ruleId ? 'A saved rule stays with its account.' : undefined}>
              <AccountSelect id="rule-account" accounts={igAccounts} value={form.accountId} onChange={value => setField('accountId', value)} disabled={Boolean(ruleId)} />
            </FieldRow>
            <FieldRow label="Name" htmlFor="rule-name" hint="Only you see this." error={errorFor('name')}>
              <Input id="rule-name" value={form.name} maxLength={80} onChange={e => setField('name', e.target.value)} placeholder="Free guide" />
            </FieldRow>
            <FieldRow label="Match" htmlFor="rule-match">
              <Select value={form.matchMode} onValueChange={value => value && setField('matchMode', value as AutomationMatchMode)} items={MATCH_MODES}>
                <SelectTrigger id="rule-match" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {MATCH_MODES.map(mode => <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FieldRow>
            {form.matchMode !== 'any' && (
              <label htmlFor="rule-case" className="-mt-2 flex items-center justify-between gap-3 text-small text-ink-muted">
                Match the letter case exactly
                <Switch id="rule-case" checked={form.caseSensitive} onCheckedChange={checked => setField('caseSensitive', checked)} />
              </label>
            )}
            {form.matchMode === 'any' ? (
              <Alert variant="warning">
                <Megaphone />
                <AlertTitle>Every comment gets this answer</AlertTitle>
                <AlertDescription>
                  Everyone who comments is answered, including people who did not ask, and a busy post reaches the hourly limits sooner.
                  Each person gets at most a few private replies a day and one public reply per post a day. Aim the rule at chosen posts to
                  keep it small. A keyword rule for the same post still answers first.
                </AlertDescription>
              </Alert>
            ) : (
              <FieldRow label="Keywords" htmlFor="rule-keywords" hint="Separate keywords with commas or new lines. Up to 10." error={errorFor('keywordsText')}>
                <Input id="rule-keywords" value={form.keywordsText} onChange={e => setField('keywordsText', e.target.value)} placeholder="GUIDE, LINK" />
              </FieldRow>
            )}
            <FieldRow label="Posts" htmlFor="rule-scope">
              <Select value={form.scope} onValueChange={value => value && setField('scope', value as RuleScope)} items={SCOPES}>
                <SelectTrigger id="rule-scope" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {SCOPES.map(scope => <SelectItem key={scope.value} value={scope.value}>{scope.label}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FieldRow>
            {form.scope === 'selected' && (
              <FieldRow label="Posts and reels to answer on" htmlFor="rule-posts" error={errorFor('mediaIds')}>
                <RuleMediaPicker
                  id="rule-posts"
                  media={rule.media}
                  loading={rule.mediaLoading}
                  error={rule.mediaError}
                  onRetry={rule.retryMedia}
                  selected={form.mediaIds}
                  onToggle={rule.toggleMedia}
                />
              </FieldRow>
            )}
            <ReplySection
              id="rule-private"
              icon={<Send />}
              title="Send a private reply"
              description="Instagram allows one private message per comment, within 7 days of it."
              checked={form.privateReplyEnabled}
              onCheckedChange={checked => setField('privateReplyEnabled', checked)}
              error={errorFor('replies')}
            >
              <div className="flex flex-col gap-3 border-t border-divider pt-3">
                <label htmlFor="rule-follow" className="flex items-center justify-between gap-3 text-sm font-medium text-ink">
                  <span className="flex items-center gap-2">
                    <UserCheck className="size-4 text-ink-muted" />Send the link only to followers
                    <Badge variant="warning">Testing</Badge>
                  </span>
                  <Switch
                    id="rule-follow"
                    checked={form.requireFollow}
                    onCheckedChange={checked => setField('requireFollow', checked)}
                    aria-describedby={errorFor('requireFollow') ? fieldErrorId('rule-follow') : 'rule-follow-help'}
                    aria-invalid={errorFor('requireFollow') ? true : undefined}
                  />
                </label>
                {errorFor('requireFollow') && <p id={fieldErrorId('rule-follow')} className="text-sm text-danger"><span className="sr-only">Error: </span>{errorFor('requireFollow')}</p>}
                <p id="rule-follow-help" className="max-w-prose text-body text-ink-muted">
                  Instagram tells Twiligent whether someone follows you only after they message you. With this on, the first reply asks them
                  to follow and reply. When they reply, Twiligent asks Instagram, then sends the reply and link to followers and a reminder to
                  everyone else, twice at most. If Instagram cannot say, nothing is sent.
                </p>
                <p className="max-w-prose text-body text-warning">
                  This option is still being tested and may or may not work. It needs Instagram to send your account&apos;s messages to
                  Twiligent, which Meta may not allow without extra app approval. Use a keyword rule when the link must arrive.
                </p>
                {form.requireFollow && (
                  <>
                    <FieldRow label="First reply" htmlFor="rule-follow-prompt" hint="Sent to everyone who comments. It has no link." error={errorFor('followPromptText')}>
                      <Textarea id="rule-follow-prompt" rows={3} maxLength={1000} value={form.followPromptText} onChange={e => setField('followPromptText', e.target.value)} />
                    </FieldRow>
                    <FieldRow label="Reminder" htmlFor="rule-follow-reminder" hint="Sent when they reply but do not follow yet." error={errorFor('notFollowingText')}>
                      <Textarea id="rule-follow-reminder" rows={3} maxLength={1000} value={form.notFollowingText} onChange={e => setField('notFollowingText', e.target.value)} />
                    </FieldRow>
                  </>
                )}
              </div>
              <FieldRow label={form.requireFollow ? 'Reply for followers' : 'Reply'} htmlFor="rule-reply" error={errorFor('replyText')}>
                <Textarea id="rule-reply" rows={4} maxLength={1000} value={form.replyText} onChange={e => setField('replyText', e.target.value)} placeholder="Here is your guide. Enjoy it." />
              </FieldRow>
              <FieldRow label="Link" htmlFor="rule-link" optional hint="Added on its own line after the reply. An address without https:// gets it added." error={errorFor('linkUrl')}>
                <Input
                  id="rule-link"
                  type="url"
                  inputMode="url"
                  value={form.linkUrl}
                  onChange={e => setField('linkUrl', e.target.value)}
                  onBlur={rule.normalizeLinkField}
                  placeholder="https://example.com/guide"
                />
              </FieldRow>
              <FieldRow label="Private replies an hour" htmlFor="rule-limit" optional hint="The account's own limit still applies; Instagram allows 750 an hour." error={errorFor('hourlyLimit')}>
                <Input id="rule-limit" type="text" inputMode="numeric" value={form.hourlyLimit} onChange={e => setField('hourlyLimit', e.target.value.replace(/[\s,]/g, ''))} placeholder="No limit for this rule" />
              </FieldRow>
            </ReplySection>
            <ReplySection
              id="rule-public"
              icon={<MessageCircle />}
              title="Reply publicly under the comment"
              description="Everyone can see it. One wording is picked for each comment, so a busy post does not fill with the same words, and each person gets at most one public reply per post a day."
              checked={form.publicReplyEnabled}
              onCheckedChange={checked => setField('publicReplyEnabled', checked)}
            >
              <RulePublicReplies texts={form.publicReplyTexts} onChange={texts => setField('publicReplyTexts', texts)} />
              {errorFor('publicReplyTexts') && (
                <p className="text-sm text-danger" role="alert"><span className="sr-only">Error: </span>{errorFor('publicReplyTexts')}</p>
              )}
              <p className="max-w-prose text-body text-ink-muted">
                Keep it short and friendly, and leave the link for the private reply. The two are sent apart, so avoid promising a message:
                the private reply can fail on its own, for example when the person does not accept messages.
              </p>
            </ReplySection>
            <label htmlFor="rule-enabled" className="flex items-center justify-between gap-3 text-sm font-medium text-ink">
              Turn the rule on when saved
              <Switch id="rule-enabled" checked={form.enabled} onCheckedChange={checked => setField('enabled', checked)} />
            </label>
          </div>
          <RulePreview rule={rule} />
        </div>
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface/95 px-1 py-3 backdrop-blur">
          {rule.problem && (
            <p className="mr-auto text-sm text-danger" role="alert">
              <span className="sr-only">Error: </span>Fix the highlighted field: {rule.problem.message}.
            </p>
          )}
          <Button variant="outline" render={<Link to="/automations" />}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Spinner className="size-4" />}
            {saving ? 'Saving' : ruleId ? 'Save rule' : 'Create rule'}
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={guard.blocked}
        onOpenChange={open => { if (!open) guard.stay(); }}
        title="Leave without saving the rule?"
        description="Your changes are kept as a draft in this tab, so they come back if you open this rule again before closing the tab."
        cancelLabel="Keep editing"
        confirmLabel="Leave"
        onConfirm={guard.leave}
      />
    </>
  );
}

// a full page rather than a dialog, so a long rule has room, keeps its address and survives a stray click outside it
export default function RuleEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { accounts } = useAppContext();
  const igAccounts = useMemo(() => accounts.filter(account => account.platform === 'instagram'), [accounts]);
  const automations = useAutomations();
  const { overview } = automations;
  const ruleId = id ?? null;
  const existing = ruleId ? overview?.rules.find(rule => rule.id === ruleId) : undefined;
  const title = ruleId ? (existing ? `Edit ${existing.name}` : 'Edit rule') : 'New rule';
  useDocumentTitle(title);

  const initialForm = useMemo(() => {
    if (!overview) return null;
    if (ruleId) return existing ? ruleToForm(existing) : null;
    const requested = params.get('account');
    const accountId = overview.accounts.some(account => account.accountId === requested) ? requested : overview.accounts[0]?.accountId;
    return accountId ? emptyRuleForm(accountId) : null;
  }, [existing, overview, params, ruleId]);

  const header = (
    <PageHeader
      back={{ to: '/automations', label: 'Instagram automation' }}
      title={title}
      description="When a comment matches, Twiligent answers its author in a private message, publicly under the comment, or both."
    />
  );

  if (!overview && !automations.loadError) return <PageSkeleton metrics={0} />;

  if (!overview) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <ErrorState title="The rule could not load" description={automations.loadError} onRetry={automations.load} />
      </div>
    );
  }

  if (!initialForm) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <EmptyState
          icon={<Send />}
          title={ruleId ? 'This rule no longer exists' : 'Connect an Instagram account first'}
          description={ruleId ? 'It may have been deleted in another tab.' : 'Rules reply from an Instagram professional account connected with Instagram sign-in.'}
          action={ruleId
            ? <Button variant="outline" render={<Link to="/automations" />}>Back to automations</Button>
            : <Button render={<Link to="/accounts?add=1" />}>Add account</Button>}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}
      <RuleEditor key={ruleId ?? 'new'} ruleId={ruleId} initialForm={initialForm} igAccounts={igAccounts} saveRule={automations.saveRule} />
    </div>
  );
}
