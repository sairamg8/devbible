import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

test('mock.module', async () => {
  mock.module('node:os', { namedExports: { platform: () => 'mocked-os' } });
  const os = await import('node:os');
  assert.equal(os.platform(), 'mocked-os');
});
