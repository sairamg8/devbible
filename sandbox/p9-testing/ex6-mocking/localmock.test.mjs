import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { convert as staticallyImported } from './convert.mjs';

test('TRAP — static import already resolved, mock has no effect', async () => {
  mock.module('./rates.mjs', { namedExports: { fetchRate: async () => 1.25 } });
  await assert.rejects(() => staticallyImported(100, 'EURUSD'), /real network call/);
  mock.reset();
});

test('CORRECT — dynamic import after the mock is installed', async (t) => {
  t.mock.module('./rates.mjs', { namedExports: { fetchRate: async () => 1.25 } });
  const { convert } = await import('./convert.mjs');
  assert.equal(await convert(100, 'EURUSD'), 125);
});
