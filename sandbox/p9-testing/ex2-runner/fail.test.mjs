import { test } from 'node:test';
import assert from 'node:assert/strict';

test('deepStrictEqual diff', () => {
  assert.deepStrictEqual(
    { id: 1, name: 'Ada', tags: ['a', 'b'] },
    { id: 1, name: 'Ada', tags: ['a', 'c'] },
  );
});
