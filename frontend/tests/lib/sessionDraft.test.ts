import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearDraft, readDraft, writeDraft } from '../../src/lib/sessionDraft.ts';
import type { DraftStorage } from '../../src/lib/sessionDraft.ts';

function memoryStorage(): DraftStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: key => { data.delete(key); },
  };
}

test('a written draft reads back the same and clears', () => {
  const storage = memoryStorage();
  writeDraft('rule:new', { name: 'Free guide' }, storage);
  assert.deepEqual(readDraft('rule:new', storage), { name: 'Free guide' });
  clearDraft('rule:new', storage);
  assert.equal(readDraft('rule:new', storage), null);
});

test('a missing, broken or blocked storage gives no draft instead of an error', () => {
  assert.equal(readDraft('rule:new', null), null);
  const storage = memoryStorage();
  storage.data.set('twiligent:draft:rule:new', '{not json');
  assert.equal(readDraft('rule:new', storage), null);
  const full: DraftStorage = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} };
  assert.doesNotThrow(() => writeDraft('rule:new', { name: 'x' }, full));
});
