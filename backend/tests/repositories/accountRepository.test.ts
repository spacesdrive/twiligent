import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createAccountRepository } from '../../repositories/accountRepository.ts';
import { DatabaseError, NotFoundError } from '../../lib/errors.ts';
import { fakeSupabase, accountRow } from '../fixtures/fakeSupabase.ts';
import type { SupabaseClient } from '../../types/app.ts';

const ROWS = [
    accountRow({ id: 'a1', platform: 'youtube', title: 'Mine' }),
    accountRow({ id: 'a2', platform: 'reddit', username: 'theirs' }, 'user-2'),
];

describe('account repository', () => {
    test('user methods only see the user\'s rows; system methods see every row', async () => {
        const accounts = createAccountRepository(fakeSupabase(ROWS));
        assert.deepEqual((await accounts.listForUser('user-1')).map(account => account.id), ['a1']);
        assert.deepEqual((await accounts.listAll()).map(account => account.id), ['a1', 'a2']);
        assert.equal(await accounts.findForUser('a2', 'user-1'), null);
        assert.deepEqual(await accounts.findById('a2'), { id: 'a2', platform: 'reddit', username: 'theirs' });
    });

    test('an update merges into data and keeps the platform', async () => {
        const db = fakeSupabase(ROWS);
        const accounts = createAccountRepository(db);
        await accounts.updateForUser('a1', { subscriberCount: 5 }, 'user-1');
        assert.deepEqual(await accounts.findForUser('a1', 'user-1'), { id: 'a1', platform: 'youtube', title: 'Mine', subscriberCount: 5 });
        assert.deepEqual(db.calls.at(-2)?.filters, [['id', 'a1'], ['user_id', 'user-1']]);
    });

    test('updating an account the user does not own is not found', async () => {
        const accounts = createAccountRepository(fakeSupabase(ROWS));
        await assert.rejects(accounts.updateForUser('a2', { title: 'x' }, 'user-1'), NotFoundError);
    });

    test('a failing query becomes a DatabaseError that hides the driver message', async () => {
        const broken = { from() { throw new Error('relation "accounts" does not exist'); } } as unknown as SupabaseClient;
        const failure = await createAccountRepository(broken).listForUser('user-1').catch((err: unknown) => err);
        assert.ok(failure instanceof DatabaseError);
        assert.equal(failure.operation, 'accounts.listForUser');
        assert.equal(failure.message, 'The database request failed. Try again in a moment.');
        assert.equal((failure.cause as Error).message, 'relation "accounts" does not exist');
    });
});
