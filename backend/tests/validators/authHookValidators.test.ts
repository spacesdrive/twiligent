import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAuthEmailHook } from '../../validators/authHookValidators.ts';
import { ValidationError } from '../../lib/errors.ts';
import { signupPayload } from '../fixtures/authHook.ts';

test('reads the user and email data Supabase sends', () => {
    const payload = signupPayload();
    (payload.user as Record<string, unknown>).new_email = 'next@example.com';
    assert.deepEqual(parseAuthEmailHook(payload), {
        email: 'new@example.com',
        newEmail: 'next@example.com',
        action: 'signup',
        token: '123456',
        tokenHash: 'hash-abc',
        tokenNew: '',
        tokenHashNew: '',
        redirectTo: 'https://app.example.com/',
        siteUrl: 'https://app.example.com',
    });
});

test('optional fields default to empty and a blank new email counts as none', () => {
    const parsed = parseAuthEmailHook({ user: { email: 'a@example.com', new_email: '' }, email_data: { email_action_type: 'password_changed_notification' } });
    assert.equal(parsed.newEmail, undefined);
    assert.equal(parsed.token, '');
    assert.equal(parsed.redirectTo, '');
});

test('a payload without a user email, an email action or the two objects is a validation error', () => {
    assert.throws(() => parseAuthEmailHook({ email_data: {} }), ValidationError);
    assert.throws(() => parseAuthEmailHook({ user: {}, email_data: { email_action_type: 'signup' } }), /no user email/);
    assert.throws(() => parseAuthEmailHook({ user: { email: 'a@example.com' }, email_data: {} }), /no email action/);
    assert.throws(() => parseAuthEmailHook({ user: { email: 'a@example.com' }, email_data: { email_action_type: 'signup', token: 5 } }), /token must be text/);
});
