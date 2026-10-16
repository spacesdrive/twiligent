import type {
  AutomationAccountState, AutomationActivityItem, AutomationCommentStatus, AutomationMatchMode, AutomationPublicReplyState, AutomationPublicReplyStatus,
  AutomationRule, AutomationRuleRequest, AutomationStats,
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

// a public reply is accepted only with the id Instagram gave it, so it is shown as posted
export const PUBLIC_STATUS_DISPLAY: Record<AutomationPublicReplyStatus, StatusDisplay> = {
  queued: { label: 'Waiting', tone: 'warning' },
  processing: { label: 'Posting', tone: 'info' },
  retry_wait: { label: 'Trying again', tone: 'warning' },
  sending: { label: 'Posting', tone: 'info' },
  accepted: { label: 'Posted', tone: 'success' },
  failed: { label: 'Failed', tone: 'destructive' },
  needs_review: { label: 'Checking', tone: 'warning' },
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
// the Worker's bounds for public replies: a few short texts, few hashtags and one link at most
export const MAX_PUBLIC_REPLY_TEXTS = 5;
export const MAX_PUBLIC_REPLY_CHARS = 300;
const MAX_PUBLIC_HASHTAGS = 4;
const MAX_PUBLIC_LINKS = 1;
const HASHTAG = /(^|\s)#[\p{L}\p{N}_]+/gu;
const LINK = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
// Instagram allows a message for 24 hours after the person's reply, so a follow-up can be retried only inside it
const FOLLOWUP_WINDOW_MS = 24 * HOUR_MS;

// where a followers-only rule starts; the owner edits both before saving
export const DEFAULT_FOLLOW_PROMPT = 'Thanks for your comment. Follow this account, then reply to this message and the link is on its way.';
export const DEFAULT_NOT_FOLLOWING = 'It looks like you do not follow this account yet. Follow it, then reply here again and the link is on its way.';
// where a public reply starts; it says nothing about the private reply, which can fail on its own
export const DEFAULT_PUBLIC_REPLY = 'Thanks for your comment.';

export interface AutomationSummary {
  received: number;
  matched: number;
  accepted: number;
  publicPosted: number;
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
  privateReplyEnabled: boolean;
  replyText: string;
  linkUrl: string;
  publicReplyEnabled: boolean;
  publicReplyTexts: string[];
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
  if (item.status === 'skipped' && item.statusReason === 'private_reply_off') return { label: 'Off', tone: 'secondary' };
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

export function publicStatusDisplay(reply: Pick<AutomationPublicReplyState, 'status' | 'statusReason'>): StatusDisplay {
  if (reply.status === 'queued' && reply.statusReason === 'paused') return { label: 'Held', tone: 'warning' };
  return PUBLIC_STATUS_DISPLAY[reply.status];
}

function count(counts: Partial<Record<string, number>>, statuses: string[]): number {
  return statuses.reduce((total, status) => total + (counts[status] ?? 0), 0);
}

// waiting and attention count both replies, so a failed public reply is not hidden by a private one that went out
export function summarizeStats(stats: AutomationStats): AutomationSummary {
  const received = Object.values(stats.comments).reduce((total, value) => total + (value ?? 0), 0);
  const publicReplies = stats.publicReplies ?? {};
  return {
    received,
    matched: received - (stats.comments.ignored ?? 0),
    accepted: stats.comments.accepted ?? 0,
    publicPosted: publicReplies.accepted ?? 0,
    waiting: count(stats.comments, ACTIVITY_FILTERS.waiting.statuses!) + count(publicReplies, ACTIVITY_FILTERS.waiting.statuses!),
    attention: count(stats.comments, ACTIVITY_FILTERS.attention.statuses!) + count(publicReplies, ACTIVITY_FILTERS.attention.statuses!),
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

// failed, skipped and review items can be tried again until Instagram's 7 days run out, except a private reply the rule
// does not send; on an accepted followers-only
// reply, a failed follow-up can be tried again inside the 24 hours after the person's answer
export function canRetry(
  item: Pick<AutomationActivityItem, 'status' | 'expiresAt'> & Partial<Pick<AutomationActivityItem, 'followup' | 'statusReason'>>,
  now: number,
): boolean {
  if (item.status === 'skipped' && item.statusReason === 'private_reply_off') return false;
  if (RETRYABLE.includes(item.status)) return Date.parse(item.expiresAt) > now;
  const followup = item.followup;
  return item.status === 'accepted' && !!followup && RETRYABLE.includes(followup.status) && Date.parse(followup.createdAt) + FOLLOWUP_WINDOW_MS > now;
}

// a failed, skipped or unconfirmed public reply can be posted again until 7 days after the comment, whatever the
// private reply did
export function canRetryPublic(item: Pick<AutomationActivityItem, 'publicReply' | 'expiresAt'>, now: number): boolean {
  return !!item.publicReply && RETRYABLE.includes(item.publicReply.status) && Date.parse(item.expiresAt) > now;
}

// what is wrong with one public reply text, or null; the Worker checks the same
export function publicReplyTextProblem(text: string): string | null {
  if (text.length > MAX_PUBLIC_REPLY_CHARS) return `A public reply can be at most ${MAX_PUBLIC_REPLY_CHARS} characters`;
  if ((text.match(HASHTAG) ?? []).length > MAX_PUBLIC_HASHTAGS) return `A public reply can have at most ${MAX_PUBLIC_HASHTAGS} hashtags`;
  if ((text.match(LINK) ?? []).length > MAX_PUBLIC_LINKS) return `A public reply can have at most ${MAX_PUBLIC_LINKS} link; put the rest in the private reply`;
  return null;
}

// the public texts as they will be saved: trimmed, without blanks or repeats
export function publicReplyTexts(texts: string[]): string[] {
  return [...new Set(texts.map(text => text.trim()).filter(Boolean))];
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
    privateReplyEnabled: true, replyText: '', linkUrl: '', publicReplyEnabled: false, publicReplyTexts: [DEFAULT_PUBLIC_REPLY], hourlyLimit: '', enabled: true,
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
    privateReplyEnabled: rule.privateReplyEnabled,
    replyText: rule.replyText,
    linkUrl: rule.linkUrl ?? '',
    publicReplyEnabled: rule.publicReplyEnabled,
    publicReplyTexts: rule.publicReplyTexts.length > 0 ? rule.publicReplyTexts : [DEFAULT_PUBLIC_REPLY],
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
    privateReplyEnabled: form.privateReplyEnabled,
    replyText: form.replyText.trim(),
    linkUrl: form.linkUrl.trim() || null,
    publicReplyEnabled: form.publicReplyEnabled,
    // texts kept while the public reply is off come back when it is turned on again
    publicReplyTexts: publicReplyTexts(form.publicReplyTexts),
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
  if (!form.privateReplyEnabled && !form.publicReplyEnabled) return 'Turn on the private reply, the public reply, or both';
  if (form.privateReplyEnabled && !form.replyText.trim()) return 'Write the reply to send';
  const link = linkProblem(form.linkUrl);
  if (link) return link;
  const limit = form.hourlyLimit.trim();
  if (limit && !(/^\d+$/.test(limit) && Number(limit) >= 1 && Number(limit) <= MAX_HOURLY_LIMIT)) {
    return `The hourly limit must be a whole number from 1 to ${MAX_HOURLY_LIMIT}`;
  }
  const bytes = messageBytes(composeReply(form.replyText, form.linkUrl));
  if (form.privateReplyEnabled && bytes > MAX_MESSAGE_BYTES) return `The reply with its link is ${bytes} bytes; Instagram accepts at most ${MAX_MESSAGE_BYTES}`;
  if (form.publicReplyEnabled) {
    const texts = publicReplyTexts(form.publicReplyTexts);
    if (texts.length === 0) return 'Write at least one public reply';
    if (texts.length > MAX_PUBLIC_REPLY_TEXTS) return `A rule can have at most ${MAX_PUBLIC_REPLY_TEXTS} public replies`;
    for (const text of texts) {
      const problem = publicReplyTextProblem(text);
      if (problem) return problem;
    }
  }
  if (form.requireFollow && !form.privateReplyEnabled) return 'Sending the link only to followers needs the private reply. Turn it on, or turn off the followers-only option';
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
  if (account.publicCooldownUntil && Date.parse(account.publicCooldownUntil) > now) {
    return {
      label: 'Public replies cooling down',
      tone: 'warning',
      detail: account.publicCooldownReason ?? 'Instagram is limiting comments from this account for now. Private replies still go out.',
    };
  }
  if (account.publicLimitedUntil && Date.parse(account.publicLimitedUntil) > now) {
    return { label: 'Public replies at their hourly limit', tone: 'warning', detail: 'This account posted its hourly number of public replies. The rest go out as the hour frees up.' };
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
