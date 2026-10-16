import type { AutomationMatchMode } from '../../shared/types/automation.ts';

// checks a rule must pass as a whole, shared by the validators (a new rule) and the service (a rule after an update)

// a keyword rule needs a keyword and an any-comment rule takes none; null means the list fits the mode
export function keywordsProblem(matchMode: AutomationMatchMode, keywords: string[]): string | null {
    if (matchMode === 'any') return keywords.length > 0 ? 'A rule that answers any comment has no keywords. Remove them, or choose a keyword match.' : null;
    return keywords.length === 0 ? 'Add at least one keyword' : null;
}

// both messages are needed before a rule can ask people to follow; null means the rule is complete
export function followTextsProblem(rule: { requireFollow: boolean; followPromptText: string | null; notFollowingText: string | null }): string | null {
    if (!rule.requireFollow) return null;
    if (!rule.followPromptText) return 'Write the message that asks people to follow you and reply';
    if (!rule.notFollowingText) return 'Write the reminder for people who do not follow you yet';
    return null;
}
