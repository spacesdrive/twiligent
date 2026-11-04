import { useCallback, useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { api } from '../../services/api';
import { deleteWithUndo } from '@/lib/undoToast';
import { formToRequest } from './automationData.ts';
import type { RuleForm } from './automationData.ts';
import type { AutomationAccountState, AutomationOverviewResponse, AutomationRule } from '@shared/types/automation.ts';

// the rules, the account controls and the server's settings, with every action that changes them
export function useAutomations() {
  const { showToast } = useAppContext();
  const [overview, setOverview] = useState<AutomationOverviewResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // the time the overview was read, so cooldowns are compared with a fixed moment during render
  const [checkedAt, setCheckedAt] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      setOverview(await api.getAutomations());
      setCheckedAt(Date.now());
      setLoadError(null);
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const replaceRule = useCallback((rule: AutomationRule) => {
    setOverview(current => current && { ...current, rules: current.rules.some(item => item.id === rule.id)
      ? current.rules.map(item => (item.id === rule.id ? rule : item))
      : [...current.rules, rule] });
  }, []);

  const replaceAccount = useCallback((account: AutomationAccountState) => {
    setOverview(current => current && { ...current, accounts: current.accounts.map(item => (item.accountId === account.accountId ? account : item)) });
  }, []);

  // saving can also subscribe the account, so the overview is read again to show it
  const saveRule = useCallback(async (form: RuleForm, ruleId: string | null): Promise<boolean> => {
    try {
      const { accountId, ...changes } = formToRequest(form);
      const { rule } = ruleId ? await api.updateAutomationRule(ruleId, changes) : await api.createAutomationRule({ accountId, ...changes });
      replaceRule(rule);
      showToast(ruleId ? 'Rule saved' : 'Rule created');
      load();
      return true;
    } catch (err) {
      showToast(`Couldn't save the rule. ${(err as Error).message}`, 'error');
      return false;
    }
  }, [load, replaceRule, showToast]);

  // the switch moves at once and moves back if the server refuses
  const setRuleEnabled = useCallback(async (rule: AutomationRule, enabled: boolean) => {
    replaceRule({ ...rule, enabled });
    try {
      replaceRule((await api.updateAutomationRule(rule.id, { enabled })).rule);
      showToast(enabled ? `${rule.name} turned on` : `${rule.name} turned off`);
      if (enabled) load();
    } catch (err) {
      replaceRule(rule);
      showToast(`Couldn't ${enabled ? 'turn on' : 'turn off'} ${rule.name}. ${(err as Error).message}`, 'error');
    }
  }, [load, replaceRule, showToast]);

  const duplicateRule = useCallback(async (rule: AutomationRule) => {
    setBusyId(rule.id);
    try {
      replaceRule((await api.duplicateAutomationRule(rule.id)).rule);
      showToast('Rule copied; the copy is off until you turn it on');
    } catch (err) {
      showToast(`Couldn't copy the rule. ${(err as Error).message}`, 'error');
    } finally {
      setBusyId(null);
    }
  }, [replaceRule, showToast]);

  // the rule leaves the list at once; the server delete waits out the Undo window, so Undo needs no restore call
  const deleteRule = useCallback((rule: AutomationRule) => {
    const position = overview?.rules.findIndex(item => item.id === rule.id) ?? -1;
    const restore = () => setOverview(current => {
      if (!current || current.rules.some(item => item.id === rule.id)) return current;
      const rules = [...current.rules];
      rules.splice(position < 0 ? rules.length : Math.min(position, rules.length), 0, rule);
      return { ...current, rules };
    });
    setOverview(current => current && { ...current, rules: current.rules.filter(item => item.id !== rule.id) });
    deleteWithUndo({
      id: `rule:${rule.id}`,
      message: `${rule.name} deleted`,
      commit: () => api.deleteAutomationRule(rule.id).then(() => undefined),
      onUndo: restore,
      onFailure: err => {
        restore();
        showToast(`Couldn't delete ${rule.name}. ${err.message}`, 'error');
      },
    });
  }, [overview, showToast]);

  const setAccountPaused = useCallback(async (account: AutomationAccountState, paused: boolean) => {
    replaceAccount({ ...account, paused });
    try {
      replaceAccount((await api.setAutomationAccountPaused(account.accountId, paused)).account);
      showToast(paused ? `Replies paused for @${account.username}` : `Replies resumed for @${account.username}`);
    } catch (err) {
      replaceAccount(account);
      showToast(`Couldn't ${paused ? 'pause' : 'resume'} replies for @${account.username}. ${(err as Error).message}`, 'error');
    }
  }, [replaceAccount, showToast]);

  const subscribeAccount = useCallback(async (account: AutomationAccountState) => {
    setBusyId(account.accountId);
    try {
      replaceAccount((await api.subscribeAutomationAccount(account.accountId)).account);
      showToast(`Comment events turned on for @${account.username}`);
    } catch (err) {
      showToast(`Couldn't turn on comment events. ${(err as Error).message}`, 'error');
    } finally {
      setBusyId(null);
    }
  }, [replaceAccount, showToast]);

  return { overview, loadError, busyId, checkedAt, load, saveRule, setRuleEnabled, duplicateRule, deleteRule, setAccountPaused, subscribeAccount };
}

export type AutomationsState = ReturnType<typeof useAutomations>;
