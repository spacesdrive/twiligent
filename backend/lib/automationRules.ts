import type { AutomationMatchMode } from '../../shared/types/automation.ts';

// checks a rule must pass as a whole, shared by the validators (a new rule) and the service (a rule after an update)

// a keyword rule needs a keyword and an any-comment rule takes none; null means the list fits the mode
export function keywordsProblem(matchMode: AutomationMatchMode, keywords: string[]): string | null {
    if (matchMode === 'any') return keywords.length > 0 ? 'A rule that answers any comment has no keywords. Remove them, or choose a keyword match.' : null;
    return keywords.length === 0 ? 'Add at least one keyword' : null;
}

export interface ReplyActions {
    privateReplyEnabled: boolean;
    replyText: string;
    publicReplyEnabled: boolean;
    publicReplyTexts: string[];
    requireFollow: boolean;
    linkAfterReply?: boolean;
}

// other wordings of the first message; one is picked per comment
export const MAX_REPLY_VARIANTS = 4;

// a rule made without its own texts asks the person to follow and reply YES, in three wordings, and reminds non-followers once
export const DEFAULT_FOLLOW_FIRST_MESSAGE = 'Thanks for commenting! Do you follow me? If you do, type YES here and I will send the link right away.';
export const DEFAULT_FOLLOW_VARIANTS = [
    'Hey, glad this one helped. Quick check first: are you following me? Reply YES and the link is yours.',
    'Want the link? Follow this account, then answer this message with YES and I will send it over.',
];
export const DEFAULT_FOLLOW_REMINDER = 'I cannot see a follow from you yet. Tap Follow on my profile, then type YES here once more and I will send the link.';

// a rule answers with a private reply, a public reply or both, and each one it uses needs its text; the followers-only
// wait starts with the private reply. null means the actions fit together
export function replyActionsProblem(rule: ReplyActions): string | null {
    if (!rule.privateReplyEnabled && !rule.publicReplyEnabled) return 'Turn on the private reply, the public reply, or both';
    if (rule.privateReplyEnabled && !rule.replyText) return 'Write the reply to send';
    if (rule.publicReplyEnabled && rule.publicReplyTexts.length === 0) return 'Write at least one public reply';
    if (rule.requireFollow && !rule.privateReplyEnabled) return 'Sending the link only to followers needs the private reply. Turn it on, or turn off the followers-only option.';
    if (rule.linkAfterReply && !rule.privateReplyEnabled) return 'Sending the link after a reply needs the private reply. Turn it on, or send the link right away.';
    return null;
}

// both messages are needed before a rule can ask people to follow; null means the rule is complete
export function followTextsProblem(rule: { requireFollow: boolean; linkAfterReply?: boolean; followPromptText: string | null; notFollowingText: string | null }): string | null {
    if (rule.requireFollow && !rule.followPromptText) return 'Write the message that asks people to follow you and reply';
    if (rule.requireFollow && !rule.notFollowingText) return 'Write the reminder for people who do not follow you yet';
    if (rule.linkAfterReply && !rule.followPromptText) return 'Write the first message, which asks people to reply and has no link';
    return null;
}
