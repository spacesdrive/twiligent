// checking a reply whose answer was lost against the conversation on Instagram; nothing here ever sends

// a check waits this long after the attempt, so the conversation on Instagram has caught up
export const REVIEW_SETTLE_SECONDS = 5 * 60;
// each reply is looked for at most three times, half an hour apart, before it is left to a person
export const REVIEW_MAX_CHECKS = 3;
export const REVIEW_RECHECK_SECONDS = 30 * 60;
// each check costs two Instagram calls and one database call, and Instagram allows two conversation calls a second per account
export const REVIEW_BATCH = 4;
export const SUBREQUESTS_PER_REVIEW = 3;
// the Worker's clock and Instagram's can differ, so a message a little before the attempt still counts
const CLOCK_SLACK_MS = 2 * 60 * 1000;

export interface ConversationMessage {
    id: string;
    createdTime: string;
    fromId: string | null;
    text: string | null;
}

export interface SentReplyQuery {
    igUserId: string;
    startedAt: string;
    digest: string;
}

// the account's message with exactly the text that was sent, after the attempt started; null when there is none
export async function findSentReply(
    messages: ConversationMessage[],
    { igUserId, startedAt, digest }: SentReplyQuery,
    digestOf: (text: string) => Promise<string>,
): Promise<ConversationMessage | null> {
    const since = Date.parse(startedAt) - CLOCK_SLACK_MS;
    for (const message of messages) {
        if (message.fromId !== igUserId || message.text === null) continue;
        if (Date.parse(message.createdTime) < since) continue;
        if (await digestOf(message.text) === digest) return message;
    }
    return null;
}

// what the person sees on a reply that was looked for and not found, after this many checks
export function reviewNote(checks: number): string {
    const left = REVIEW_MAX_CHECKS - checks;
    const later = left > 0 ? ' Twiligent looks again later.' : '';
    return `Twiligent checked the conversation on Instagram and did not find this reply.${later} Check it yourself before you retry; Instagram refuses a second private reply to the same comment.`;
}
