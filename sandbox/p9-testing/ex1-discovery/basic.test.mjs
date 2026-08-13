import { test, describe, it, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('shapes', () => {
  before(() => console.log('  [before] once'));
  beforeEach(() => console.log('  [beforeEach]'));
  it('passes', () => assert.equal(1, 1));
  it('nested', async (t) => {
    await t.test('subtest', () => assert.ok(true));
  });
  it.skip('skipped', () => {});
  it.todo('todo');
  after(() => console.log('  [after] once'));
});

test('assert.strict catches type coercion', () => {
  assert.equal(1, 1);
  assert.throws(() => assert.equal(1, '1'), /Expected values to be strictly equal/);
});

test('deepStrictEqual vs deepEqual', () => {
  assert.deepStrictEqual({ a: 1 }, { a: 1 });
  assert.throws(() => assert.deepStrictEqual({ a: 1 }, { a: '1' }));
});

test('rejects and throws', async () => {
  await assert.rejects(async () => { throw new TypeError('nope'); }, TypeError);
  assert.throws(() => { throw new RangeError('r'); }, { name: 'RangeError' });
});

test('THE TRAP: a forgotten await passes silently', () => {
  // no await, no return -> the promise rejection is unobserved by this test
  Promise.reject(new Error('never seen')).catch(() => {});
  assert.ok(true);
});
