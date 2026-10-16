import { ValidationError } from '../lib/errors.ts';
import { followTextsProblem, keywordsProblem, replyActionsProblem } from '../lib/automationRules.ts';
import { MAX_PUBLIC_REPLY_TEXTS, publicReplyTextProblem } from '../lib/automationPublicReply.ts';
import { isString, optionalArray, optionalBoolean, optionalNumber, optionalString, presentField, requiredString } from './fields.ts';
import type { Fields } from './fields.ts';
import type { ActivityCursor } from '../repositories/automationCommentRepository.ts';
import type {
    AutomationAccountRequest, AutomationCommentStatus, AutomationMatchMode, AutomationRuleRequest, AutomationRuleUpdateRequest,
    AutomationTestRequest,
} from '../../shared/types/automation.ts';

const MATCH_MODES: AutomationMatchMode[] = ['contains', 'exact', 'any'];
const STATUSES: AutomationCommentStatus[] = ['ignored', 'queued', 'processing', 'retry_wait', 'sending', 'accepted', 'failed', 'needs_review', 'skipped', 'expired'];
const MAX_NAME = 80;
const MAX_KEYWORDS = 10;
const MAX_KEYWORD = 100;
const MAX_MEDIA = 50;
const MAX_REPLY = 1000;
const MAX_URL = 2000;
// Instagram allows 750 private replies an hour per account
const MAX_HOURLY_LIMIT = 750;
const MAX_TEST_COMMENT = 2200;
const DEFAULT_PAGE = 50;
const MAX_PAGE = 100;

export interface ActivityQuery {
    accountId?: string;
    ruleId?: string;
    // one status or several, sent as a comma-separated list
    statuses?: AutomationCommentStatus[];
    from?: string;
    to?: string;
    before?: ActivityCursor;
    limit: number;
}

export interface StatsQuery {
    accountId?: string;
    ruleId?: string;
    from?: string;
    to?: string;
}

export interface WebhookVerification {
    mode?: string;
    verifyToken?: string;
    challenge?: string;
}

function name(body: Fields): string {
    const value = requiredString(body, 'name', 'Give the rule a name');
    if (value.length > MAX_NAME) throw new ValidationError(`The rule name can be at most ${MAX_NAME} characters`);
    return value;
}

// trimmed, without blanks or repeats, so "guide" and "GUIDE " count once when matching ignores case; whether the
// list may be empty depends on the match mode, checked with keywordsProblem
function keywords(body: Fields, caseSensitive: boolean): string[] {
    const list = optionalArray(body, 'keywords', isString, 'words') ?? [];
    const seen = new Set<string>();
    const kept: string[] = [];
    for (const keyword of list.map(item => item.trim()).filter(Boolean)) {
        if (keyword.length > MAX_KEYWORD) throw new ValidationError(`A keyword can be at most ${MAX_KEYWORD} characters`);
        const key = caseSensitive ? keyword : keyword.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        kept.push(keyword);
    }
    if (kept.length > MAX_KEYWORDS) throw new ValidationError(`A rule can have at most ${MAX_KEYWORDS} keywords`);
    return kept;
}

function keywordsFor(mode: AutomationMatchMode, list: string[]): string[] {
    const problem = keywordsProblem(mode, list);
    if (problem) throw new ValidationError(problem);
    return list;
}

function matchMode(body: Fields): AutomationMatchMode | undefined {
    const value = optionalString(body, 'matchMode');
    if (!value) return undefined;
    if (!MATCH_MODES.includes(value as AutomationMatchMode)) throw new ValidationError('matchMode must be contains, exact or any');
    return value as AutomationMatchMode;
}

// a followers-only message: absent leaves it as it is, empty clears it
function followText(body: Fields, field: 'followPromptText' | 'notFollowingText', label: string): string | null | undefined {
    if (!presentField(body, field)) return undefined;
    const value = optionalString(body, field)?.trim();
    if (!value) return null;
    if (value.length > MAX_REPLY) throw new ValidationError(`${label} can be at most ${MAX_REPLY} characters`);
    return value;
}

const FOLLOW_PROMPT_LABEL = 'The message asking people to follow and reply';
const NOT_FOLLOWING_LABEL = 'The reminder for people who do not follow yet';


function mediaIds(body: Fields): string[] | undefined {
    const list = optionalArray(body, 'mediaIds', isString, 'post ids');
    if (!list) return undefined;
    const ids = [...new Set(list.map(item => item.trim()).filter(Boolean))];
    if (ids.some(id => !/^\d+$/.test(id))) throw new ValidationError('mediaIds must be Instagram post ids');
    if (ids.length > MAX_MEDIA) throw new ValidationError(`A rule can name at most ${MAX_MEDIA} posts; leave the list empty to cover every post`);
    return ids;
}

// may be empty when the rule has no private reply; whether it is needed is checked with replyActionsProblem
function replyText(body: Fields): string {
    const value = optionalString(body, 'replyText') ?? '';
    if (value.length > MAX_REPLY) throw new ValidationError(`The reply can be at most ${MAX_REPLY} characters`);
    return value;
}

// trimmed, without blanks or repeats; each text must be one Instagram takes as a comment
function publicReplyTexts(body: Fields): string[] | undefined {
    const list = optionalArray(body, 'publicReplyTexts', isString, 'texts');
    if (!list) return undefined;
    const texts = [...new Set(list.map(item => item.trim()).filter(Boolean))];
    if (texts.length > MAX_PUBLIC_REPLY_TEXTS) throw new ValidationError(`A rule can have at most ${MAX_PUBLIC_REPLY_TEXTS} public replies`);
    for (const text of texts) {
        const problem = publicReplyTextProblem(text);
        if (problem) throw new ValidationError(problem);
    }
    return texts;
}

// only https links without a user name or password, since the link goes to strangers in a private message
function linkUrl(body: Fields): string | null | undefined {
    if (!presentField(body, 'linkUrl')) return undefined;
    const value = optionalString(body, 'linkUrl');
    if (!value) return null;
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new ValidationError('The link must be a full address starting with https://');
    }
    if (url.protocol !== 'https:') throw new ValidationError('The link must start with https://');
    if (url.username || url.password) throw new ValidationError('The link cannot contain a user name or password');
    if (value.length > MAX_URL) throw new ValidationError(`The link can be at most ${MAX_URL} characters`);
    return value;
}

function hourlyLimit(body: Fields): number | null | undefined {
    if (!presentField(body, 'hourlyLimit')) return undefined;
    const value = optionalNumber(body, 'hourlyLimit');
    if (value === undefined) return null;
    if (!Number.isInteger(value) || value < 1 || value > MAX_HOURLY_LIMIT) {
        throw new ValidationError(`The hourly limit must be a whole number from 1 to ${MAX_HOURLY_LIMIT}`);
    }
    return value;
}

function isoDate(query: Fields, field: string): string | undefined {
    const value = optionalString(query, field);
    if (!value) return undefined;
    const time = Date.parse(value);
    if (Number.isNaN(time)) throw new ValidationError(`${field} must be a date`);
    return new Date(time).toISOString();
}

// the cursor is "<created_at as the API sent it>|<id>"; both go back into a filter, so only their own characters are allowed
const CURSOR = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?))\|([0-9A-Za-z_-]{1,64})$/;

function cursor(query: Fields): ActivityCursor | undefined {
    const value = optionalString(query, 'before');
    if (!value) return undefined;
    const match = CURSOR.exec(value);
    if (!match) throw new ValidationError('before must be the nextBefore value of the previous page');
    return { createdAt: match[1], id: match[2] };
}

function statuses(query: Fields): AutomationCommentStatus[] | undefined {
    const value = optionalString(query, 'status');
    if (!value) return undefined;
    const list = [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))];
    if (list.some(item => !STATUSES.includes(item as AutomationCommentStatus))) throw new ValidationError(`status must be one of ${STATUSES.join(', ')}`);
    return list as AutomationCommentStatus[];
}

export function parseAutomationRule(body: Fields): AutomationRuleRequest {
    const caseSensitive = optionalBoolean(body, 'caseSensitive') ?? false;
    const mode = matchMode(body) ?? 'contains';
    const rule = {
        accountId: requiredString(body, 'accountId', 'Choose the Instagram account'),
        name: name(body),
        keywords: keywordsFor(mode, keywords(body, caseSensitive)),
        matchMode: mode,
        caseSensitive,
        mediaIds: mediaIds(body) ?? [],
        privateReplyEnabled: optionalBoolean(body, 'privateReplyEnabled') ?? true,
        replyText: replyText(body),
        linkUrl: linkUrl(body) ?? null,
        publicReplyEnabled: optionalBoolean(body, 'publicReplyEnabled') ?? false,
        publicReplyTexts: publicReplyTexts(body) ?? [],
        enabled: optionalBoolean(body, 'enabled') ?? false,
        hourlyLimit: hourlyLimit(body) ?? null,
        requireFollow: optionalBoolean(body, 'requireFollow') ?? false,
        followPromptText: followText(body, 'followPromptText', FOLLOW_PROMPT_LABEL) ?? null,
        notFollowingText: followText(body, 'notFollowingText', NOT_FOLLOWING_LABEL) ?? null,
    };
    const problem = replyActionsProblem(rule) ?? followTextsProblem(rule);
    if (problem) throw new ValidationError(problem);
    return rule;
}

// only the fields present in the body change; accountId is ignored, a rule stays on its account. Rules that span
// fields, such as keywords for the match mode, are checked by the service against the rule as it will be saved
export function parseAutomationRuleUpdate(body: Fields): AutomationRuleUpdateRequest {
    const changes: AutomationRuleUpdateRequest = {};
    const caseSensitive = optionalBoolean(body, 'caseSensitive');
    if (presentField(body, 'name')) changes.name = name(body);
    if (presentField(body, 'keywords')) changes.keywords = keywords(body, caseSensitive ?? false);
    if (presentField(body, 'matchMode')) changes.matchMode = matchMode(body);
    if (caseSensitive !== undefined) changes.caseSensitive = caseSensitive;
    if (presentField(body, 'mediaIds')) changes.mediaIds = mediaIds(body);
    if (presentField(body, 'privateReplyEnabled')) changes.privateReplyEnabled = optionalBoolean(body, 'privateReplyEnabled');
    if (presentField(body, 'replyText')) changes.replyText = replyText(body);
    if (presentField(body, 'linkUrl')) changes.linkUrl = linkUrl(body);
    if (presentField(body, 'publicReplyEnabled')) changes.publicReplyEnabled = optionalBoolean(body, 'publicReplyEnabled');
    if (presentField(body, 'publicReplyTexts')) changes.publicReplyTexts = publicReplyTexts(body);
    if (presentField(body, 'enabled')) changes.enabled = optionalBoolean(body, 'enabled');
    if (presentField(body, 'hourlyLimit')) changes.hourlyLimit = hourlyLimit(body);
    if (presentField(body, 'requireFollow')) changes.requireFollow = optionalBoolean(body, 'requireFollow');
    if (presentField(body, 'followPromptText')) changes.followPromptText = followText(body, 'followPromptText', FOLLOW_PROMPT_LABEL);
    if (presentField(body, 'notFollowingText')) changes.notFollowingText = followText(body, 'notFollowingText', NOT_FOLLOWING_LABEL);
    if (Object.keys(changes).length === 0) throw new ValidationError('Nothing to change: send at least one rule field');
    return changes;
}

export function parseAutomationTest(body: Fields): AutomationTestRequest {
    const caseSensitive = optionalBoolean(body, 'caseSensitive') ?? false;
    const comment = requiredString(body, 'comment', 'Type a sample comment to test');
    if (comment.length > MAX_TEST_COMMENT) throw new ValidationError(`A comment can be at most ${MAX_TEST_COMMENT} characters`);
    const mode = matchMode(body) ?? 'contains';
    const privateReplyEnabled = optionalBoolean(body, 'privateReplyEnabled') ?? true;
    const text = replyText(body);
    if (privateReplyEnabled && !text) throw new ValidationError('Write the reply to send');
    return {
        keywords: keywordsFor(mode, keywords(body, caseSensitive)),
        matchMode: mode,
        caseSensitive,
        mediaIds: mediaIds(body) ?? [],
        privateReplyEnabled,
        replyText: text,
        linkUrl: linkUrl(body) ?? null,
        requireFollow: optionalBoolean(body, 'requireFollow') ?? false,
        followPromptText: followText(body, 'followPromptText', FOLLOW_PROMPT_LABEL) ?? null,
        comment,
        mediaId: optionalString(body, 'mediaId') || undefined,
    };
}

export function parseActivityQuery(query: Fields): ActivityQuery {
    const limitText = optionalString(query, 'limit');
    const limit = limitText ? Number(limitText) : DEFAULT_PAGE;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE) throw new ValidationError(`limit must be a whole number from 1 to ${MAX_PAGE}`);
    return {
        accountId: optionalString(query, 'accountId') || undefined,
        ruleId: optionalString(query, 'ruleId') || undefined,
        statuses: statuses(query),
        from: isoDate(query, 'from'),
        to: isoDate(query, 'to'),
        before: cursor(query),
        limit,
    };
}

export function parseStatsQuery(query: Fields): StatsQuery {
    return {
        accountId: optionalString(query, 'accountId') || undefined,
        ruleId: optionalString(query, 'ruleId') || undefined,
        from: isoDate(query, 'from'),
        to: isoDate(query, 'to'),
    };
}

export function parseAutomationAccount(body: Fields): AutomationAccountRequest {
    const paused = optionalBoolean(body, 'paused');
    if (paused === undefined) throw new ValidationError('paused must be true or false');
    return { paused };
}

// Meta's verification request: GET with hub.mode, hub.verify_token and hub.challenge
export function parseWebhookVerification(query: Fields): WebhookVerification {
    return {
        mode: optionalString(query, 'hub.mode') || undefined,
        verifyToken: optionalString(query, 'hub.verify_token') || undefined,
        challenge: optionalString(query, 'hub.challenge') || undefined,
    };
}
