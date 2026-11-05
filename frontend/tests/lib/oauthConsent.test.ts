import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONSENT_ABILITIES, isSafeRedirect, redirectHost } from '../../src/lib/oauthConsent.ts';

test('an https return address is safe', () => {
  assert.equal(isSafeRedirect('https://claude.ai/api/mcp/auth_callback?code=a&state=b'), true);
});

test('an http return address is safe only on this computer', () => {
  assert.equal(isSafeRedirect('http://localhost:33418/callback?code=a'), true);
  assert.equal(isSafeRedirect('http://127.0.0.1:8080/cb'), true);
  assert.equal(isSafeRedirect('http://[::1]:8080/cb'), true);
  assert.equal(isSafeRedirect('http://evil.example/cb'), false);
});

test('other schemes and broken addresses are refused', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'not a url', '']) {
    assert.equal(isSafeRedirect(url), false, url);
  }
});

test('the return host is shown as the site name', () => {
  assert.equal(redirectHost('https://claude.ai/api/mcp/auth_callback'), 'claude.ai');
  assert.equal(redirectHost('http://localhost:33418/callback'), 'localhost:33418');
  assert.equal(redirectHost('nonsense'), 'nonsense');
});

test('each permission explains what it allows', () => {
  assert.ok(CONSENT_ABILITIES.read.length > 0);
  assert.ok(CONSENT_ABILITIES.write.some(line => line.includes('confirm')));
});
