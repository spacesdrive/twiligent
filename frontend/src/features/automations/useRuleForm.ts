import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAppContext } from '../../context/AppContext';
import { api } from '../../services/api';
import { emptyRuleForm, formToRequest, ruleFormProblem, ruleToForm } from './automationData.ts';
import type { RuleForm } from './automationData.ts';
import type { AutomationRule, AutomationTestResponse } from '@shared/types/automation.ts';
import type { InstagramMedia } from '@shared/types/instagram.ts';

// lets a keyword test run before the reply is written
const TEST_REPLY_PLACEHOLDER = 'Your reply';

interface RuleFormDeps {
  saveRule: (form: RuleForm, ruleId: string | null) => Promise<boolean>;
}

// the rule dialog: which rule is open, its fields, the account's posts to aim it at, and a test that sends nothing
export function useRuleForm({ saveRule }: RuleFormDeps) {
  const { showToast } = useAppContext();
  const [open, setOpen] = useState(false);
  const [ruleId, setRuleId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleForm>(emptyRuleForm(''));
  const [saving, setSaving] = useState(false);
  const [media, setMedia] = useState<InstagramMedia[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [sampleComment, setSampleComment] = useState('');
  const [testResult, setTestResult] = useState<AutomationTestResponse | null>(null);
  const [testing, setTesting] = useState(false);

  const openNew = useCallback((accountId: string) => {
    setRuleId(null);
    setForm(emptyRuleForm(accountId));
    setSampleComment('');
    setTestResult(null);
    setOpen(true);
  }, []);

  const openEdit = useCallback((rule: AutomationRule) => {
    setRuleId(rule.id);
    setForm(ruleToForm(rule));
    setSampleComment('');
    setTestResult(null);
    setOpen(true);
  }, []);

  const setField = useCallback(<K extends keyof RuleForm>(key: K, value: RuleForm[K]) => {
    setForm(current => ({ ...current, [key]: value, ...(key === 'accountId' ? { mediaIds: [] } : {}) }));
    setTestResult(null);
  }, []);

  const toggleMedia = useCallback((id: string) => {
    setForm(current => ({ ...current, mediaIds: current.mediaIds.includes(id) ? current.mediaIds.filter(item => item !== id) : [...current.mediaIds, id] }));
    setTestResult(null);
  }, []);

  // posts load only when the rule is aimed at chosen posts
  useEffect(() => {
    if (!open || form.scope !== 'selected' || !form.accountId) return;
    let cancelled = false;
    setMediaLoading(true);
    api.getIGMedia(form.accountId)
      .then(res => { if (!cancelled) setMedia(res.media); })
      .catch(err => { if (!cancelled) showToast(`Couldn't load the account's posts. ${(err as Error).message}`, 'error'); })
      .finally(() => { if (!cancelled) setMediaLoading(false); });
    return () => { cancelled = true; };
  }, [open, form.scope, form.accountId, showToast]);

  const runTest = useCallback(async () => {
    const request = formToRequest(form);
    setTesting(true);
    try {
      // the test checks the match; which posts the rule covers applies to real comments only
      setTestResult(await api.testAutomationRule({
        keywords: request.keywords, matchMode: request.matchMode, caseSensitive: request.caseSensitive,
        replyText: request.replyText || TEST_REPLY_PLACEHOLDER, linkUrl: request.linkUrl, comment: sampleComment,
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
    const problem = ruleFormProblem(form);
    if (problem) {
      showToast(`Couldn't save the rule. ${problem}.`, 'error');
      return;
    }
    setSaving(true);
    const saved = await saveRule(form, ruleId);
    setSaving(false);
    if (saved) setOpen(false);
  }, [form, ruleId, saveRule, showToast]);

  return {
    open, setOpen, ruleId, form, setField, toggleMedia, saving, media, mediaLoading,
    sampleComment, setSampleComment, testResult, testing, runTest, openNew, openEdit, handleSubmit,
  };
}

export type RuleFormState = ReturnType<typeof useRuleForm>;
