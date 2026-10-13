import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greeting, greetingName, greetingTitle } from '../../../../src/features/analytics/overview/greeting.ts';

const atHour = hour => new Date(2026, 0, 1, hour, 30);

test('greeting follows the time of day', () => {
  assert.equal(greeting(atHour(6)), 'Good morning');
  assert.equal(greeting(atHour(11)), 'Good morning');
  assert.equal(greeting(atHour(12)), 'Good afternoon');
  assert.equal(greeting(atHour(17)), 'Good afternoon');
  assert.equal(greeting(atHour(18)), 'Good evening');
});

test('greeting name is the capitalised first part of the email', () => {
  assert.equal(greetingName('jane.doe@example.com'), 'Jane');
  assert.equal(greetingName('sam_lee@example.com'), 'Sam');
  assert.equal(greetingName('ox-team@example.com'), 'Ox');
  assert.equal(greetingName(''), '');
  assert.equal(greetingName(undefined), '');
  assert.equal(greetingName('.hidden@example.com'), '');
});

test('greeting title adds the name only when there is one', () => {
  assert.equal(greetingTitle('jane@example.com', atHour(9)), 'Good morning, Jane');
  assert.equal(greetingTitle(undefined, atHour(20)), 'Good evening');
});
