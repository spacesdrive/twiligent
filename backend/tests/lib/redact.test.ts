import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactSecrets } from '../../lib/redact.ts';

test('a url in an error message is replaced, since it can carry an api key', () => {
    assert.equal(redactSecrets('GET https://graph.instagram.com/me?access_token=IGQ123 failed'), 'GET [url] failed');
});

test('a bearer token is hidden but the rest of the message stays readable', () => {
    assert.equal(redactSecrets('Authorization: Bearer eyJhbGciOi.abc.def was refused'), 'Authorization: Bearer [redacted] was refused');
});

test('token-like parameters in a form body or query are hidden by name', () => {
    assert.equal(
        redactSecrets('body grant_type=ig_exchange_token&client_secret=abc123&access_token=IGQ456 rejected'),
        'body grant_type=ig_exchange_token&client_secret=[redacted]&access_token=[redacted] rejected',
    );
});

test('token-like fields in an echoed json body are hidden by name', () => {
    assert.equal(redactSecrets('{"refresh_token": "r-1", "user": "u-1"}'), '{"refresh_token":"[redacted]", "user": "u-1"}');
});

test('ordinary messages, database ones included, pass through unchanged', () => {
    const message = 'duplicate key value violates unique constraint "accounts_id_user_id_key"';
    assert.equal(redactSecrets(message), message);
    assert.equal(redactSecrets('The token has expired. Reconnect the account.'), 'The token has expired. Reconnect the account.');
});
