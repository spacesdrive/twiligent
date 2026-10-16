import type {
  AutomationAccountState, AutomationActivityItem, AutomationCommentStatus, AutomationMatchMode, AutomationRule, AutomationRuleRequest,
  AutomationStats,
} from '../../../../shared/types/automation.ts';

export type BadgeTone = 'success' | 'destructive' | 'warning' | 'info' | 'secondary';

export interface StatusDisplay {
  label: string;
  tone: BadgeTone;
}

// accepted means Instagram took the request; it does not report whether the person has read the message
export const STATUS_DISPLAY: Record<AutomationCommentStatus, StatusDisplay> = {
  ignored: { label: 'No match', tone: 'secondary' },
  queued: { label: 'Waiting', tone: 'warning' },
  processing: { label: 'Sending', tone: 'info' },
  retry_wait: { label: 'Trying again', tone: 'warning' },
  sending: { label: 'Sending', tone: 'info' },
  accepted: { label: 'Accepted by Instagram', tone: 'success' },
  failed: { label: 'Failed', tone: 'destructive' },
  needs_review: { label: 'Needs review', tone: 'warning' },
  skipped: { label: 'Skipped', tone: 'secondary' },
  expired: { label: 'Expired', tone: 'secondary' },
};

export type ActivityFilter = 'all' | 'accepted' | 'waiting' | 'attention' | 'skipped' | 'ignored';

export const ACTIVITY_FILTERS: Record<ActivityFilter, { label: string; statuses: AutomationCommentStatus[] | null }> = {
  all: { label: 'All', statuses: null },
  accepted: { label: 'Accepted', statuses: ['accepted'] },
  waiting: { label: 'Waiting', statuses: ['queued', 'processing', 'retry_wait', 'sending'] },
  attention: { label: 'Needs attention', statuses: ['failed', 'needs_review'] },
  skipped: { label: 'Skipped or expired', statuses: ['skipped', 'expired'] },
  ignored: { label: 'No match', statuses: ['ignored'] },
};

export type StatsPeriod = '24h' | '7d' | '30d';

const HOUR_MS = 60 * 60 * 1000;

export const STATS_PERIODS: Record<StatsPeriod, { label: string; ms: number }> = {
  '24h': { label: 'Last 24 hours', ms: 24 * HOUR_MS },
  '7d': { label: 'Last 7 days', ms: 7 * 24 * HOUR_MS },
  '30d': { label: 'Last 30 days', ms: 30 * 24 * HOUR_MS },
};

// Instagram refuses message text longer than 1,000 bytes; the Worker checks the same
export const MAX_MESSAGE_BYTES = 1000;
const MAX_KEYWORDS = 10;
const MAX_HOURLY_LIMIT = 750;

export interface AutomationSummary {
  received: number;
  matched: number;
  accepted: number;
  waiting: number;
  attention: number;
  rateLimited: number;
}

export type RuleScope = 'all' | 'selected';

// the rule dialog's fields, as typed; keywords and the limit stay text until saved
export interface RuleForm {
  accountId: string;
  name: string;
  keywordsText: string;
  matchMode: AutomationMatchMode;
  caseSensitive: boolean;
  scope: RuleScope;
  mediaIds: string[];
  replyText: string;
  linkUrl: string;
  hourlyLimit: string;
  enabled: boolean;
}

export function periodStart(period: StatsPeriod, now: number): string {
  return new Date(now - STATS_PERIODS[period].ms).toISOString();
}

export function statusDisplay(item: Pick<AutomationActivityItem, 'status' | 'statusReason'>): StatusDisplay {
  if (item.status === 'queued' && item.statusReason === 'paused') return { label: 'Held', tone: 'warning' };
  return STATUS_DISPLAY[item.status];
}

function count(stats: AutomationStats, statuses: AutomationCommentStatus[]): number {
  return statuses.reduce((total, status) => total + (stats.comments[status] ?? 0), 0);
}

export function summarizeStats(stats: AutomationStats): AutomationSummary {
  const received = Object.values(stats.comments).reduce((total, value) => total + (value ?? 0), 0);
  return {
    received,
    matched: received - (stats.comments.ignored ?? 0),
    accepted: stats.comments.accepted ?? 0,
    waiting: count(stats, ACTIVITY_FILTERS.waiting.statuses!),
    attention: count(stats, ACTIVITY_FILTERS.attention.statuses!),
    rateLimited: stats.attempts.rate_limited ?? 0,
  };
}

export function ruleScopeLabel(rule: Pick<AutomationRule, 'mediaIds'>): string {
  const posts = rule.mediaIds.length;
  if (posts === 0) return 'All posts and reels';
  return posts === 1 ? '1 selected post' : `${posts} selected posts`;
}

export function matchModeLabel(rule: Pick<AutomationRule, 'matchMode' | 'caseSensitive'>): string {
  const mode = rule.matchMode === 'exact' ? 'Whole comment' : 'Anywhere in the comment';
  return rule.caseSensitive ? `${mode}, same letter case` : mode;
}

// failed, skipped and review items can be tried again until Instagram's 7 days run out
export function canRetry(item: Pick<AutomationActivityItem, 'status' | 'expiresAt'>, now: number): boolean {
  return ['failed', 'needs_review', 'skipped'].includes(item.status) && Date.parse(item.expiresAt) > now;
}

// comma or line separated, trimmed, without blanks or repeats
export function parseKeywords(text: string, caseSensitive: boolean): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const keyword of text.split(/[,\n]/).map(item => item.trim()).filter(Boolean)) {
    const key = caseSensitive ? keyword : keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(keyword);
  }
  return keywords;
}

export function composeReply(replyText: string, linkUrl: string): string {
  const link = linkUrl.trim();
  return link ? `${replyText.trim()}\n\n${link}` : replyText.trim();
}

export function messageBytes(message: string): number {
  return new TextEncoder().encode(message).length;
}

export function emptyRuleForm(accountId: string): RuleForm {
  return {
    accountId, name: '', keywordsText: '', matchMode: 'contains', caseSensitive: false, scope: 'all', mediaIds: [],
    replyText: '', linkUrl: '', hourlyLimit: '', enabled: true,
  };
}

export function ruleToForm(rule: AutomationRule): RuleForm {
  return {
    accountId: rule.accountId,
    name: rule.name,
    keywordsText: rule.keywords.join(', '),
    matchMode: rule.matchMode,
    caseSensitive: rule.caseSensitive,
    scope: rule.mediaIds.length > 0 ? 'selected' : 'all',
    mediaIds: rule.mediaIds,
    replyText: rule.replyText,
    linkUrl: rule.linkUrl ?? '',
    hourlyLimit: rule.hourlyLimit === null ? '' : String(rule.hourlyLimit),
    enabled: rule.enabled,
  };
}

export function formToRequest(form: RuleForm): AutomationRuleRequest {
  return {
    accountId: form.accountId,
    name: form.name.trim(),
    keywords: parseKeywords(form.keywordsText, form.caseSensitive),
    matchMode: form.matchMode,
    caseSensitive: form.caseSensitive,
    mediaIds: form.scope === 'selected' ? form.mediaIds : [],
    replyText: form.replyText.trim(),
    linkUrl: form.linkUrl.trim() || null,
    enabled: form.enabled,
    hourlyLimit: form.hourlyLimit.trim() ? Number(form.hourlyLimit) : null,
  };
}

function linkProblem(linkUrl: string): string | null {
  const link = linkUrl.trim();
  if (!link) return null;
  try {
    const url = new URL(link);
    if (url.protocol !== 'https:') return 'The link must start with https://';
    if (url.username || url.password) return 'The link cannot contain a user name or password';
  } catch {
    return 'The link must be a full address starting with https://';
  }
  return null;
}

// the first thing to fix before the rule can be saved, or null; the Worker checks the same rules again
export function ruleFormProblem(form: RuleForm): string | null {
  if (!form.accountId) return 'Choose the Instagram account';
  if (!form.name.trim()) return 'Give the rule a name';
  const keywords = parseKeywords(form.keywordsText, form.caseSensitive);
  if (keywords.length === 0) return 'Add at least one keyword';
  if (keywords.length > MAX_KEYWORDS) return `A rule can have at most ${MAX_KEYWORDS} keywords`;
  if (form.scope === 'selected' && form.mediaIds.length === 0) return 'Choose at least one post, or answer comments on every post';
  if (!form.replyText.trim()) return 'Write the reply to send';
  const link = linkProblem(form.linkUrl);
  if (link) return link;
  const limit = form.hourlyLimit.trim();
  if (limit && !(/^\d+$/.test(limit) && Number(limit) >= 1 && Number(limit) <= MAX_HOURLY_LIMIT)) {
    return `The hourly limit must be a whole number from 1 to ${MAX_HOURLY_LIMIT}`;
  }
  const bytes = messageBytes(composeReply(form.replyText, form.linkUrl));
  if (bytes > MAX_MESSAGE_BYTES) return `The reply with its link is ${bytes} bytes; Instagram accepts at most ${MAX_MESSAGE_BYTES}`;
  return null;
}

export interface AccountStatus {
  label: string;
  tone: BadgeTone;
  detail: string;
}

// what an account's automation is doing right now, from its controls
export function accountStatus(account: AutomationAccountState, now: number): AccountStatus {
  if (account.paused && account.cooldownReason) return { label: 'Held', tone: 'destructive', detail: account.cooldownReason };
  if (account.paused) return { label: 'Paused', tone: 'secondary', detail: 'Comments are still recorded; replies wait until you resume, within Instagram\'s 7 days.' };
  if (account.cooldownUntil && Date.parse(account.cooldownUntil) > now) {
    return { label: 'Cooling down', tone: 'warning', detail: account.cooldownReason ?? 'Instagram is limiting replies from this account for now.' };
  }
  if (!account.subscribedAt) return { label: 'Not receiving comments', tone: 'warning', detail: 'Turn on comment events so Instagram sends this account\'s comments to Twiligent.' };
  return { label: 'Receiving comments', tone: 'success', detail: 'New comments that match an active rule get a reply.' };
}
