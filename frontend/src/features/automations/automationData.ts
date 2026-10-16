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
// Instagram allows a message for 24 hours after the person's reply, so a follow-up can be retried only inside it
const FOLLOWUP_WINDOW_MS = 24 * HOUR_MS;

// where a followers-only rule starts; the owner edits both before saving
export const DEFAULT_FOLLOW_PROMPT = 'Thanks for your comment. Follow this account, then reply to this message and the link is on its way.';
export const DEFAULT_NOT_FOLLOWING = 'It looks like you do not follow this account yet. Follow it, then reply here again and the link is on its way.';

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
  requireFollow: boolean;
  followPromptText: string;
  notFollowingText: string;
}

export function periodStart(period: StatsPeriod, now: number): string {
  return new Date(now - STATS_PERIODS[period].ms).toISOString();
}

type ActivityStatus = Pick<AutomationActivityItem, 'status' | 'statusReason'> & Partial<Pick<AutomationActivityItem, 'gateStatus' | 'followup'>>;

// a followers-only reply that Instagram accepted shows where the wait for the person stands, not just the first message
export function statusDisplay(item: ActivityStatus): StatusDisplay {
  if (item.status === 'queued' && item.statusReason === 'paused') return { label: 'Held', tone: 'warning' };
  if (item.status !== 'accepted' || !item.gateStatus) return STATUS_DISPLAY[item.status];
  if (item.gateStatus === 'completed') return { label: 'Link sent', tone: 'success' };
  if (item.gateStatus === 'closed') return { label: 'Not following', tone: 'secondary' };
  if (item.followup?.status === 'needs_review') return { label: 'Needs review', tone: 'warning' };
  if (item.followup?.status === 'failed') return { label: 'Follow-up failed', tone: 'destructive' };
  return { label: 'Asked to follow', tone: 'info' };
}

// the sentence under a followers-only reply; null for any other item
export function gateDetail(item: Pick<AutomationActivityItem, 'status' | 'gateStatus' | 'followup'>): string | null {
  if (item.status !== 'accepted' || !item.gateStatus) return null;
  if (item.gateStatus === 'completed') return 'Instagram confirmed they follow the account, and accepted the reply with the link.';
  if (item.gateStatus === 'closed') return 'They did not follow after the reminders, so the link was not sent.';
  if (item.followup?.errorMessage) return item.followup.errorMessage;
  if (item.followup?.kind === 'reminder') return 'Reminded them to follow. Their next reply is checked again.';
  return 'Asked them to follow and reply. When they reply, Instagram says whether they follow, and the link goes out if they do.';
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
  if (rule.matchMode === 'any') return 'Any comment';
  const mode = rule.matchMode === 'exact' ? 'Whole comment' : 'Anywhere in the comment';
  return rule.caseSensitive ? `${mode}, same letter case` : mode;
}

const RETRYABLE = ['failed', 'needs_review', 'skipped'];

// failed, skipped and review items can be tried again until Instagram's 7 days run out; on an accepted followers-only
// reply, a failed follow-up can be tried again inside the 24 hours after the person's answer
export function canRetry(item: Pick<AutomationActivityItem, 'status' | 'expiresAt'> & Partial<Pick<AutomationActivityItem, 'followup'>>, now: number): boolean {
  if (RETRYABLE.includes(item.status)) return Date.parse(item.expiresAt) > now;
  const followup = item.followup;
  return item.status === 'accepted' && !!followup && RETRYABLE.includes(followup.status) && Date.parse(followup.createdAt) + FOLLOWUP_WINDOW_MS > now;
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
    requireFollow: false, followPromptText: DEFAULT_FOLLOW_PROMPT, notFollowingText: DEFAULT_NOT_FOLLOWING,
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
    requireFollow: rule.requireFollow,
    followPromptText: rule.followPromptText ?? DEFAULT_FOLLOW_PROMPT,
    notFollowingText: rule.notFollowingText ?? DEFAULT_NOT_FOLLOWING,
  };
}

export function formToRequest(form: RuleForm): AutomationRuleRequest {
  return {
    accountId: form.accountId,
    name: form.name.trim(),
    // an any-comment rule takes no keywords, so ones typed before switching to it are not sent
    keywords: form.matchMode === 'any' ? [] : parseKeywords(form.keywordsText, form.caseSensitive),
    matchMode: form.matchMode,
    caseSensitive: form.caseSensitive,
    mediaIds: form.scope === 'selected' ? form.mediaIds : [],
    replyText: form.replyText.trim(),
    linkUrl: form.linkUrl.trim() || null,
    enabled: form.enabled,
    hourlyLimit: form.hourlyLimit.trim() ? Number(form.hourlyLimit) : null,
    requireFollow: form.requireFollow,
    followPromptText: form.followPromptText.trim() || null,
    notFollowingText: form.notFollowingText.trim() || null,
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
  if (form.matchMode !== 'any') {
    const keywords = parseKeywords(form.keywordsText, form.caseSensitive);
    if (keywords.length === 0) return 'Add at least one keyword';
    if (keywords.length > MAX_KEYWORDS) return `A rule can have at most ${MAX_KEYWORDS} keywords`;
  }
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
  if (form.requireFollow) {
    if (!form.followPromptText.trim()) return 'Write the message that asks people to follow you and reply';
    if (!form.notFollowingText.trim()) return 'Write the reminder for people who do not follow you yet';
    const longest = Math.max(messageBytes(form.followPromptText.trim()), messageBytes(form.notFollowingText.trim()));
    if (longest > MAX_MESSAGE_BYTES) return `A followers-only message is ${longest} bytes; Instagram accepts at most ${MAX_MESSAGE_BYTES}`;
  }
  return null;
}

// a followers-only rule that is on needs Instagram to send the account's messages as well as its comments
export function needsMessageEvents(rules: Pick<AutomationRule, 'accountId' | 'enabled' | 'requireFollow'>[], accountId: string): boolean {
  return rules.some(rule => rule.accountId === accountId && rule.enabled && rule.requireFollow);
}

export interface AccountStatus {
  label: string;
  tone: BadgeTone;
  detail: string;
}

// what an account's automation is doing right now, from its controls; needsMessages when a followers-only rule is on
export function accountStatus(account: AutomationAccountState, now: number, needsMessages = false): AccountStatus {
  if (account.paused && account.cooldownReason) return { label: 'Held', tone: 'destructive', detail: account.cooldownReason };
  if (account.paused) return { label: 'Paused', tone: 'secondary', detail: 'Comments are still recorded; replies wait until you resume, within Instagram\'s 7 days.' };
  if (account.cooldownUntil && Date.parse(account.cooldownUntil) > now) {
    return { label: 'Cooling down', tone: 'warning', detail: account.cooldownReason ?? 'Instagram is limiting replies from this account for now.' };
  }
  if (account.limitedUntil && Date.parse(account.limitedUntil) > now) {
    return { label: 'At its hourly limit', tone: 'warning', detail: 'This account sent its hourly number of replies. The rest go out as the hour frees up, within Instagram\'s 7 days.' };
  }
  if (!account.subscribedAt) return { label: 'Not receiving comments', tone: 'warning', detail: 'Turn on comment events so Instagram sends this account\'s comments to Twiligent.' };
  if (needsMessages && !account.messagesSubscribed) {
    return {
      label: 'Follow checks off',
      tone: 'warning',
      detail: 'A followers-only rule needs this account\'s messages. Select messages in the Meta dashboard webhook settings, then turn on message events. Until then, people who reply never get the link.',
    };
  }
  return { label: 'Receiving comments', tone: 'success', detail: 'New comments that match an active rule get a reply.' };
}
