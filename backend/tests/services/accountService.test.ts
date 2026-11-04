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

function service(accounts: AccountRepository) {
    return createAccountService({
        accounts,
        cache: {} as AnalyticsCacheRepository,
        audit: {} as AuditRepository,
        config: readConfig({} as Env),
        context: { requestId: 'req-test', signal: new AbortController().signal, log: createLogger() },
    });
}

function instagramAnswers(t: { after(fn: () => void): void }) {
    const fetch = mock.method(globalThis, 'fetch', async () => Response.json({ user_id: '1789', username: 'ribbon' }));
    t.after(() => fetch.mock.restore());
}

test('an add that loses a race to the same account gets the usual already added answer, not a database error', async t => {
    instagramAnswers(t);
    const accounts = accountsFailingWith({ code: '23505', message: 'duplicate key value violates unique constraint "accounts_identity_key"' });
    await assert.rejects(service(accounts).addInstagram('user-1', 'IGTOKEN'), (err: Error) => {
        assert.ok(err instanceof ConflictError);
        assert.equal(err.message, 'This Instagram account is already added');
        return true;
    });
});

test('any other failed insert stays a database error', async t => {
    instagramAnswers(t);
    const accounts = accountsFailingWith({ code: '08006', message: 'connection failure' });
    await assert.rejects(service(accounts).addInstagram('user-1', 'IGTOKEN'), DatabaseError);
});
