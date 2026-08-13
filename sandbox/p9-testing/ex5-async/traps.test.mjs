import { test } from 'node:test';
import assert from 'node:assert/strict';

const failsLater = async () => { throw new Error('the real failure'); };
const ok = async () => 42;

test('TRAP 1 — forgotten await on assert.rejects', () => {
  // no await: returns a promise nobody observes
  assert.rejects(ok, /never/);
});

test('TRAP 2 — forgotten await on a plain assertion inside async fn', async () => {
  const p = failsLater();
  p.catch(() => {});          // swallowed
  assert.ok(true);
});

test('TRAP 3 — assertion inside a callback that never runs', () => {
  setTimeout(() => { assert.equal(1, 2); }, 0);
});

test('CORRECT — await assert.rejects', async () => {
  await assert.rejects(failsLater, { message: 'the real failure' });
});

test('CORRECT — returning the promise', () => {
  return assert.rejects(failsLater, { message: 'the real failure' });
});
