import { test } from 'node:test';
import assert from 'node:assert/strict';
// NOTE: convert.mjs is deliberately NOT imported at the top.

test('mock the dependency, then import the module under test', async (t) => {
  t.mock.module('./rates.mjs', { exports: { fetchRate: async () => 1.25 } });
  const { convert } = await import('./convert.mjs');
  assert.equal(await convert(100, 'EURUSD'), 125);
});
