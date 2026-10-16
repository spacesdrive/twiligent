import type { AutomationMatchMode } from '../../shared/types/automation.ts';

export interface MatchableRule {
    keywords: string[];
    matchMode: AutomationMatchMode;
    caseSensitive: boolean;
    mediaIds: string[];
}

// keyword is null when an any-comment rule answered
export interface RuleMatch<T extends MatchableRule> {
    rule: T;
    keyword: string | null;
}

// what surrounds a comment's words without changing them: spaces, punctuation and emoji
const EDGES = /^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu;

// NFKC folds look-alike characters such as full-width letters, so "ＧＵＩＤＥ" matches GUIDE
function normalize(text: string, caseSensitive: boolean): string {
    const folded = text.normalize('NFKC').replace(/\s+/g, ' ').trim();
    return caseSensitive ? folded : folded.toLowerCase();
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// the first keyword the comment carries, or null; contains means whole words only, so GUIDE never matches GUIDELINES
export function matchedKeyword(comment: string, rule: MatchableRule): string | null {
    const text = normalize(comment, rule.caseSensitive);
    for (const keyword of rule.keywords) {
        const wanted = normalize(keyword, rule.caseSensitive);
        if (!wanted) continue;
        if (rule.matchMode === 'exact') {
            if (text.replace(EDGES, '') === wanted.replace(EDGES, '')) return keyword;
            continue;
        }
        const wholeWord = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(wanted)}(?![\\p{L}\\p{N}])`, 'u');
        if (wholeWord.test(text)) return keyword;
    }
    return null;
}

// whether the rule answers this comment; an any-comment rule answers every comment with something in it
export function ruleMatch<T extends MatchableRule>(comment: string, rule: T): RuleMatch<T> | null {
    if (rule.matchMode === 'any') return normalize(comment, false) ? { rule, keyword: null } : null;
    const keyword = matchedKeyword(comment, rule);
    return keyword === null ? null : { rule, keyword };
}

export function coversMedia(rule: MatchableRule, mediaId: string | null): boolean {
    return rule.mediaIds.length === 0 || (mediaId !== null && rule.mediaIds.includes(mediaId));
}

// the more specific rule answers: rules for this post before rules for every post, and in each group keyword rules
// before any-comment rules
function rank(rule: MatchableRule): number {
    return (rule.mediaIds.length > 0 ? 0 : 2) + (rule.matchMode === 'any' ? 1 : 0);
}

// one rule answers a comment, so one comment never gets two replies; inside a rank the order given (oldest first) decides
export function pickRule<T extends MatchableRule>(rules: T[], comment: string, mediaId: string | null): RuleMatch<T> | null {
    const ordered = rules.map((rule, index) => ({ rule, index })).sort((a, b) => rank(a.rule) - rank(b.rule) || a.index - b.index);
    for (const { rule } of ordered) {
        if (!coversMedia(rule, mediaId)) continue;
        const match = ruleMatch(comment, rule);
        if (match) return match;
    }
    return null;
}
