import type { AutomationRule } from '@shared/types/automation.ts';

export type RuleStateFilter = 'all' | 'on' | 'off';
export type RuleAppliesFilter = 'all' | 'chosen' | 'every';

export interface RuleFilters {
  query: string;
  state: RuleStateFilter;
  applies: RuleAppliesFilter;
}

export const RULE_STATE_FILTERS: readonly RuleStateFilter[] = ['all', 'on', 'off'];
export const RULE_APPLIES_FILTERS: readonly RuleAppliesFilter[] = ['all', 'chosen', 'every'];

export const RULE_STATE_LABELS: Record<RuleStateFilter, string> = { all: 'On and off', on: 'On', off: 'Off' };
export const RULE_APPLIES_LABELS: Record<RuleAppliesFilter, string> = { all: 'All posts', chosen: 'Chosen posts', every: 'Every post' };

// each scheduled post with an automation adds its own rule, so a page of 20 keeps the list short enough to scan
export const RULES_PER_PAGE = 20;
// a handful of rules reads at a glance; the search and filters appear once there are more
export const RULE_FILTERS_FROM = 6;

// a choice from the address that is not one of the options falls back to all, so an edited link still opens
export function readRuleFilters(values: { q: string; state: string; applies: string }): RuleFilters {
  return {
    query: values.q,
    state: (RULE_STATE_FILTERS as readonly string[]).includes(values.state) ? values.state as RuleStateFilter : 'all',
    applies: (RULE_APPLIES_FILTERS as readonly string[]).includes(values.applies) ? values.applies as RuleAppliesFilter : 'all',
  };
}

// people search for what they remember: the rule's name, a keyword or words from a reply, in any letter case
export function ruleMatchesQuery(rule: AutomationRule, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [rule.name, ...rule.keywords, rule.replyText, rule.linkUrl ?? '', ...rule.publicReplyTexts];
  return haystack.some(text => text.toLowerCase().includes(needle));
}

function matchesState(rule: AutomationRule, state: RuleStateFilter): boolean {
  return state === 'all' || rule.enabled === (state === 'on');
}

function matchesApplies(rule: AutomationRule, applies: RuleAppliesFilter): boolean {
  return applies === 'all' || (rule.mediaIds.length > 0) === (applies === 'chosen');
}

// keeps the rules' own order, which is the order they are listed in everywhere else
export function filterRules(rules: AutomationRule[], filters: RuleFilters): AutomationRule[] {
  return rules.filter(rule => ruleMatchesQuery(rule, filters.query) && matchesState(rule, filters.state) && matchesApplies(rule, filters.applies));
}

// each chip's count says how many rules it would show with the other filters kept
export function ruleFilterCounts(rules: AutomationRule[], filters: RuleFilters) {
  const state = {} as Record<RuleStateFilter, number>;
  const applies = {} as Record<RuleAppliesFilter, number>;
  for (const option of RULE_STATE_FILTERS) state[option] = filterRules(rules, { ...filters, state: option }).length;
  for (const option of RULE_APPLIES_FILTERS) applies[option] = filterRules(rules, { ...filters, applies: option }).length;
  return { state, applies };
}
