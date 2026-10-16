import type { AutomationMatchMode } from '../../shared/types/automation.ts';

export interface MatchableRule {
    keywords: string[];
    matchMode: AutomationMatchMode;
    caseSensitive: boolean;
    mediaIds: string[];
}

export interface RuleMatch<T extends MatchableRule> {
    rule: T;
    keyword: string;
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

export function coversMedia(rule: MatchableRule, mediaId: string | null): boolean {
    return rule.mediaIds.length === 0 || (mediaId !== null && rule.mediaIds.includes(mediaId));
}

// a rule aimed at this post wins over a rule for every post; within each group the order given (oldest first) decides
export function pickRule<T extends MatchableRule>(rules: T[], comment: string, mediaId: string | null): RuleMatch<T> | null {
    const ordered = [...rules.filter(rule => rule.mediaIds.length > 0), ...rules.filter(rule => rule.mediaIds.length === 0)];
    for (const rule of ordered) {
        if (!coversMedia(rule, mediaId)) continue;
        const keyword = matchedKeyword(comment, rule);
        if (keyword !== null) return { rule, keyword };
    }
    return null;
}
