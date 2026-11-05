import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SUPABASE_AUTH_OPTIONS } from '../../src/lib/supabaseAuthOptions.ts';

test('the app signs in with the PKCE flow, so a session in a link fragment is never adopted', () => {
  assert.equal(SUPABASE_AUTH_OPTIONS.flowType, 'pkce');
});
