import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

const clock = { now() { return 'REAL'; } };

test('top-level mock.method', () => {
  mock.method(clock, 'now', () => 'FAKE');
  assert.equal(clock.now(), 'FAKE');
});

test('is it restored?', () => {
  console.log('  clock.now() in next test =', clock.now());
});
