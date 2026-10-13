import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanCode, emailErrorNotice, isExistingAccount } from '../../src/lib/authErrors.ts';

const WORKER_LIMIT = 'Twiligent has sent all the verification emails it can today. Sign in with Google instead, or try again tomorrow.';

test('the daily cap points to Google when the Google button is on the page', () => {
  assert.deepEqual(emailErrorNotice({ message: WORKER_LIMIT, status: 429 }, true), { message: WORKER_LIMIT, emailLimitReached: true });
  assert.deepEqual(emailErrorNotice({ message: WORKER_LIMIT, status: 429 }, false), {
    message: 'Twiligent has sent all the verification emails it can today. Try again tomorrow.',
    emailLimitReached: true,
  });
});

test('Supabase\'s own email limit reads the same way', () => {
  const notice = emailErrorNotice({ message: 'email rate limit exceeded', status: 429, code: 'over_email_send_rate_limit' }, true);
  assert.deepEqual(notice, { message: WORKER_LIMIT, emailLimitReached: true });
});

test('a short wait between codes and the per-address cap keep their own messages', () => {
  const wait = { message: 'For security purposes, you can only request this after 42 seconds.', status: 429, code: 'over_email_send_rate_limit' };
  assert.deepEqual(emailErrorNotice(wait, true), { message: wait.message, emailLimitReached: false });
  const perAddress = { message: 'This address has received the most codes allowed today. Use the latest code you received, or try again tomorrow.', status: 429 };
  assert.deepEqual(emailErrorNotice(perAddress, true), { message: perAddress.message, emailLimitReached: false });
});

test('a wrong or expired code says what to do next', () => {
  assert.deepEqual(emailErrorNotice({ message: 'Token has expired or is invalid', status: 403, code: 'otp_expired' }, true), {
    message: 'The code is wrong or has expired. Check it, or send a new one.',
    emailLimitReached: false,
  });
});

test('other errors pass through', () => {
  assert.deepEqual(emailErrorNotice({ message: 'Password should be at least 6 characters.', status: 422 }, true), {
    message: 'Password should be at least 6 characters.',
    emailLimitReached: false,
  });
});

test('a sign-up answer with no identities means the address already has an account', () => {
  assert.equal(isExistingAccount({ identities: [] }), true);
  assert.equal(isExistingAccount({ identities: [{ provider: 'email' }] }), false);
  assert.equal(isExistingAccount({}), false);
  assert.equal(isExistingAccount(null), false);
});

test('a pasted code keeps its first six digits only', () => {
  assert.equal(cleanCode(' 123-456 '), '123456');
  assert.equal(cleanCode('12345678'), '123456');
  assert.equal(cleanCode('abc'), '');
});
