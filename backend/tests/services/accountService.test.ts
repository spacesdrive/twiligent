import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createAccountService } from '../../services/accountService.ts';
import { ConflictError, DatabaseError } from '../../lib/errors.ts';
import { readConfig } from '../../lib/config.ts';
import { createLogger } from '../../lib/logger.ts';
import type { AccountRepository } from '../../repositories/accountRepository.ts';
import type { AnalyticsCacheRepository } from '../../repositories/analyticsCacheRepository.ts';
import type { AuditRepository } from '../../repositories/auditRepository.ts';
import type { Env } from '../../types/env.ts';

// an account list that is still empty and an insert that fails the way Postgres does
function accountsFailingWith(cause: unknown): AccountRepository {
    return {
        listForUser: async () => [],
        create: async () => { throw new DatabaseError('accounts.create', cause); },
    } as unknown as AccountRepository;
}

const CHANNEL_ID = 'UCabcdefghijklmnopqrstuv';

function service(accounts: AccountRepository) {
    return createAccountService({
        accounts,
        cache: {} as AnalyticsCacheRepository,
        audit: {} as AuditRepository,
        config: readConfig({ YOUTUBE_API_KEY: 'KEY' } as Env),
        context: { requestId: 'req-test', signal: new AbortController().signal, log: createLogger() },
    });
}

// a channel id needs no lookup, so one channels.list answer is the whole conversation with YouTube
function youtubeAnswers(t: { after(fn: () => void): void }) {
    const channel = { id: CHANNEL_ID, snippet: { title: 'Cooking', publishedAt: '2020-01-01T00:00:00Z' }, statistics: {}, contentDetails: { relatedPlaylists: { uploads: 'UUabc' } } };
    const fetch = mock.method(globalThis, 'fetch', async () => Response.json({ items: [channel] }));
    t.after(() => fetch.mock.restore());
}

test('an add that loses a race to the same account gets the usual already added answer, not a database error', async t => {
    youtubeAnswers(t);
    const accounts = accountsFailingWith({ code: '23505', message: 'duplicate key value violates unique constraint "accounts_identity_key"' });
    await assert.rejects(service(accounts).addYouTube('user-1', CHANNEL_ID), (err: Error) => {
        assert.ok(err instanceof ConflictError);
        assert.equal(err.message, 'This channel is already added');
        return true;
    });
});

test('any other failed insert stays a database error', async t => {
    youtubeAnswers(t);
    const accounts = accountsFailingWith({ code: '08006', message: 'connection failure' });
    await assert.rejects(service(accounts).addYouTube('user-1', CHANNEL_ID), DatabaseError);
});

test('removing a YouTube account turns off its publishing first; removing an Instagram account does not touch YouTube', async () => {
    const owned = [{ id: 'yt1', platform: 'youtube', channelId: CHANNEL_ID }, { id: 'ig1', platform: 'instagram' }];
    const steps: string[] = [];
    const accounts = {
        findForUser: async (id: string) => owned.find(account => account.id === id) ?? null,
        deleteForUser: async (id: string) => { steps.push(`deleted ${id}`); },
    } as unknown as AccountRepository;
    const removing = createAccountService({
        accounts,
        cache: { deleteAllForAccount: async () => undefined } as unknown as AnalyticsCacheRepository,
        audit: { recordForUser: async () => undefined } as unknown as AuditRepository,
        config: readConfig({ YOUTUBE_API_KEY: 'KEY' } as Env),
        context: { requestId: 'req-test', signal: new AbortController().signal, log: createLogger() },
        youtubePublishing: { disconnectChannel: async (_userId, channelId) => { steps.push(`publishing off ${channelId}`); } },
    });
    await removing.remove('user-1', 'yt1');
    await removing.remove('user-1', 'ig1');
    assert.deepEqual(steps, [`publishing off ${CHANNEL_ID}`, 'deleted yt1', 'deleted ig1']);
});
