import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';

test('always passes', () => { throw new Error('I am broken now'); });
test('passes on the second run', () => {
  const marker = new URL('./.attempted', import.meta.url).pathname;
  const first = !existsSync(marker);
  writeFileSync(marker, 'x');
  assert.ok(!first, 'failed on the first attempt');
});
test('also always passes', () => {});
