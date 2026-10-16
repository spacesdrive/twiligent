import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REVIEW_MAX_CHECKS, findSentReply, reviewNote } from '../../lib/automationReview.ts';
import { messageDigest } from '../../lib/automationDelivery.ts';
import type { ConversationMessage } from '../../lib/automationReview.ts';

const STARTED = '2026-10-16T10:00:00.000Z';

function message(id: string, fromId: string, text: string | null, createdTime = '2026-10-16T10:00:05+0000'): ConversationMessage {
    return { id, fromId, text, createdTime };
}

test('a lost reply is found when the account sent exactly that text after the attempt started', async () => {
    const digest = await messageDigest('Here is your guide\n\nhttps://example.com/g');
    const messages = [
        message('theirs', '77', 'Here is your guide\n\nhttps://example.com/g'),
        message('other', '1784', 'Thanks for asking'),
        message('mine', '1784', 'Here is your guide\n\nhttps://example.com/g'),
    ];
    assert.equal((await findSentReply(messages, { igUserId: '1784', startedAt: STARTED, digest }, messageDigest))?.id, 'mine');
});

test('the same text sent well before the attempt, or a different text, is not taken for the lost reply', async () => {
    const digest = await messageDigest('Here is your guide');
    const old = [message('earlier', '1784', 'Here is your guide', '2026-10-16T09:00:00+0000'), message('edited', '1784', 'Here is your guide!')];
    assert.equal(await findSentReply(old, { igUserId: '1784', startedAt: STARTED, digest }, messageDigest), null);
    // the clocks may differ a little, so a message a minute before the attempt still counts
    const close = [message('close', '1784', 'Here is your guide', '2026-10-16T09:59:00+0000')];
    assert.equal((await findSentReply(close, { igUserId: '1784', startedAt: STARTED, digest }, messageDigest))?.id, 'close');
});

test('the note says when Twiligent will look again and that Instagram refuses a second reply', () => {
    assert.match(reviewNote(1), /looks again later/);
    assert.doesNotMatch(reviewNote(REVIEW_MAX_CHECKS), /looks again later/);
    assert.match(reviewNote(REVIEW_MAX_CHECKS), /refuses a second private reply/);
});
