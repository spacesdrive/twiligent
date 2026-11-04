import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useAppContext } from '../../context/AppContext';
import { api } from '../../services/api';
import { clearDraft, readDraft, writeDraft } from '@/lib/sessionDraft';
import { formToRequest, normalizeLink, ruleFormError } from './automationData.ts';
import type { RuleField, RuleFieldProblem, RuleForm } from './automationData.ts';
import type { AutomationTestResponse } from '@shared/types/automation.ts';
import type { InstagramMedia } from '@shared/types/instagram.ts';

// lets a keyword test run before the reply is written
const TEST_REPLY_PLACEHOLDER = 'Your reply';

// where focus goes for each field's problem
export const RULE_FIELD_IDS: Record<RuleField, string> = {
  accountId: 'rule-account',
  name: 'rule-name',
  keywordsText: 'rule-keywords',
  mediaIds: 'rule-posts',
  replies: 'rule-private',
  replyText: 'rule-reply',
  linkUrl: 'rule-link',
  hourlyLimit: 'rule-limit',
  publicReplyTexts: 'rule-public-0',
  requireFollow: 'rule-follow',
  followPromptText: 'rule-follow-prompt',
  notFollowingText: 'rule-follow-reminder',
};

interface RuleFormDeps {
  ruleId: string | null;
  initialForm: RuleForm;
  saveRule: (form: RuleForm, ruleId: string | null) => Promise<boolean>;
  onSaved: () => void;
}

function draftKey(ruleId: string | null): string {
  return `rule:${ruleId ?? 'new'}`;
}

function sameForm(a: RuleForm, b: RuleForm): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// the rule editor: its fields with a draft kept for the tab, the account's posts to aim it at, problems shown under
// their field once a save was tried, and a test that sends nothing
export function useRuleForm({ ruleId, initialForm, saveRule, onSaved }: RuleFormDeps) {
  const { showToast } = useAppContext();
  const [draft] = useState(() => {
    const stored = readDraft<RuleForm>(draftKey(ruleId));
    return stored && stored.accountId === initialForm.accountId ? stored : null;
  });
  const [form, setForm] = useState<RuleForm>(() => draft ?? initialForm);
  const [restored, setRestored] = useState(Boolean(draft) && !sameForm(draft ?? initialForm, initialForm));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [media, setMedia] = useState<InstagramMedia[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaAttempt, setMediaAttempt] = useState(0);
  const [sampleComment, setSampleComment] = useState('');
  const [testResult, setTestResult] = useState<AutomationTestResponse | null>(null);
  const [testing, setTesting] = useState(false);

  const dirty = !saved && !sameForm(form, initialForm);
  // a problem shows only after a save was tried, then follows the fields as they change, so it clears once fixed
  const problem: RuleFieldProblem | null = useMemo(() => (tried ? ruleFormError(form) : null), [tried, form]);
  const errorFor = useCallback((field: RuleField) => (problem?.field === field ? problem.message : undefined), [problem]);

  useEffect(() => {
    if (saved) return;
    if (dirty) writeDraft(draftKey(ruleId), form);
    else clearDraft(draftKey(ruleId));
  }, [dirty, form, ruleId, saved]);

  const setField = useCallback(<K extends keyof RuleForm>(key: K, value: RuleForm[K]) => {
    setForm(current => ({ ...current, [key]: value, ...(key === 'accountId' ? { mediaIds: [] } : {}) }));
    setTestResult(null);
  }, []);

  // the address is shown as it will be saved, once the person leaves the field
  const normalizeLinkField = useCallback(() => {
    setForm(current => ({ ...current, linkUrl: normalizeLink(current.linkUrl) }));
  }, []);

  const toggleMedia = useCallback((id: string) => {
    setForm(current => ({ ...current, mediaIds: current.mediaIds.includes(id) ? current.mediaIds.filter(item => item !== id) : [...current.mediaIds, id] }));
    setTestResult(null);
  }, []);

  const discardDraft = useCallback(() => {
    clearDraft(draftKey(ruleId));
    setForm(initialForm);
    setRestored(false);
    setTried(false);
  }, [initialForm, ruleId]);

  // posts load only when the rule is aimed at chosen posts
  useEffect(() => {
    if (form.scope !== 'selected' || !form.accountId) return;
    let cancelled = false;
    setMediaLoading(true);
    setMediaError(null);
    api.getIGMedia(form.accountId)
      .then(res => { if (!cancelled) setMedia(res.media); })
      .catch(err => { if (!cancelled) setMediaError(`Couldn't load the account's posts. ${(err as Error).message}`); })
      .finally(() => { if (!cancelled) setMediaLoading(false); });
    return () => { cancelled = true; };
  }, [form.scope, form.accountId, mediaAttempt]);

  const retryMedia = useCallback(() => setMediaAttempt(attempt => attempt + 1), []);

  const runTest = useCallback(async () => {
    const request = formToRequest(form);
    setTesting(true);
    try {
      // the test checks the match; which posts the rule covers applies to real comments only
      setTestResult(await api.testAutomationRule({
        keywords: request.keywords, matchMode: request.matchMode, caseSensitive: request.caseSensitive,
        privateReplyEnabled: request.privateReplyEnabled, replyText: request.replyText || TEST_REPLY_PLACEHOLDER, linkUrl: request.linkUrl, comment: sampleComment,
        requireFollow: request.requireFollow, followPromptText: request.followPromptText,
      }));
    } catch (err) {
      showToast(`Couldn't test the rule. ${(err as Error).message}`, 'error');
    } finally {
      setTesting(false);
    }
  }, [form, sampleComment, showToast]);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setTried(true);
    const found = ruleFormError(form);
    if (found) {
      document.getElementById(RULE_FIELD_IDS[found.field])?.focus();
      return;
    }
    setSaving(true);
    const ok = await saveRule(form, ruleId);
    setSaving(false);
    if (!ok) return;
    clearDraft(draftKey(ruleId));
    setSaved(true);
    onSaved();
  }, [form, onSaved, ruleId, saveRule, saving]);

  return {
    ruleId, form, setField, normalizeLinkField, toggleMedia, saving, dirty, restored, discardDraft, problem, errorFor,
    media, mediaLoading, mediaError, retryMedia, sampleComment, setSampleComment, testResult, testing, runTest, handleSubmit,
  };
}

export type RuleFormState = ReturnType<typeof useRuleForm>;
