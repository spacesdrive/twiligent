import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeAuthEmails } from '../../../services/email/authEmails.ts';
import { hook } from '../../fixtures/authHook.ts';

const SUPABASE_URL = 'https://project.supabase.co';

test('a sign-up email carries the code and a link to Supabase Auth\'s verify endpoint', () => {
    const [email, ...rest] = composeAuthEmails(hook(), SUPABASE_URL);
    assert.equal(rest.length, 0);
    assert.equal(email.to, 'new@example.com');
    assert.equal(email.subject, 'Your Twiligent verification code');
    assert.equal(email.notice, false);
    const link = 'https://project.supabase.co/auth/v1/verify?token=hash-abc&type=signup&redirect_to=https%3A%2F%2Fapp.example.com%2F';
    assert.ok(email.text.includes('\n123456\n'));
    assert.ok(email.text.includes(link));
    assert.ok(email.html.includes('>123456<'));
    assert.ok(email.html.includes(link.replace(/&/g, '&amp;')));
});

test('without a redirect the link leaves redirect_to out, and without a hash there is no link', () => {
    const [noRedirect] = composeAuthEmails(hook({ action: 'recovery', redirectTo: '' }), SUPABASE_URL);
    assert.ok(noRedirect.text.includes('verify?token=hash-abc&type=recovery\n'));
    assert.equal(noRedirect.subject, 'Reset your Twiligent password');
    assert.ok(noRedirect.text.startsWith('Enter this code on the sign-in page, with the new password you want to use.'));
    const [reauth] = composeAuthEmails(hook({ action: 'reauthentication', tokenHash: '' }), SUPABASE_URL);
    assert.equal(reauth.text.includes('http'), false);
    assert.equal(reauth.subject, 'Your Twiligent confirmation code');
});

test('values from the payload are escaped in the HTML', () => {
    const [email] = composeAuthEmails(hook({ action: 'email_change', email: 'old@example.com', newEmail: '<b>@example.com', token: '111111', tokenNew: '222222', tokenHashNew: 'h"1' }), SUPABASE_URL);
    assert.ok(email.html.includes('&lt;b&gt;@example.com'));
    assert.equal(email.html.includes('<b>@'), false);
    assert.ok(email.html.includes('token=h%221'));
});

test('Secure Email Change sends one code to each address, pairing the hashes the way Supabase names them', () => {
    const emails = composeAuthEmails(hook({
        action: 'email_change', email: 'old@example.com', newEmail: 'next@example.com',
        token: '111111', tokenHash: 'hash-for-new', tokenNew: '222222', tokenHashNew: 'hash-for-current',
    }), SUPABASE_URL);
    assert.deepEqual(emails.map(email => email.to), ['old@example.com', 'next@example.com']);
    assert.ok(emails[0].text.includes('111111') && emails[0].text.includes('token=hash-for-current'));
    assert.ok(emails[1].text.includes('222222') && emails[1].text.includes('token=hash-for-new'));
});

test('an email change without Secure Email Change sends one email to the new address', () => {
    const emails = composeAuthEmails(hook({ action: 'email_change', email: 'old@example.com', newEmail: 'next@example.com', token: '333333' }), SUPABASE_URL);
    assert.deepEqual(emails.map(email => [email.to, email.text.includes('333333')]), [['next@example.com', true]]);
});

test('a notification is a notice without a code, and an unknown action or a missing code sends nothing', () => {
    const [notice] = composeAuthEmails(hook({ action: 'password_changed_notification', token: '', tokenHash: '' }), SUPABASE_URL);
    assert.equal(notice.notice, true);
    assert.ok(notice.text.startsWith('The password for your Twiligent account was changed.'));
    assert.deepEqual(composeAuthEmails(hook({ action: 'something_new' }), SUPABASE_URL), []);
    assert.deepEqual(composeAuthEmails(hook({ token: '' }), SUPABASE_URL), []);
});
